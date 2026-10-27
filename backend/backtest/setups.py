"""
Pattern rules and entry triggers.

A strategy's entry signal on a bar is: its indicator conditions (AND/OR) AND
every pattern rule. Rules are long setups, evaluated on completed candles only.

The trigger decides when and at what price the trade is entered:
  close            at the signal candle's close
  break_high       on the next candle, once price trades above the signal candle's high
  confirmed_break  like break_high, but the signal candle must also close above
                   the previous candle's high (a confirmation candle)
"""
import numpy as np
import pandas as pd
from numpy.lib.stride_tricks import sliding_window_view

from backtest.evaluator import conditions_mask
from indicators.calculator import compute_indicators
from indicators.definitions import make_col_name

# Parameter defaults and allowed (min, max) per rule type
RULE_PARAMS = {
    # The move up, then a pullback that keeps most of the gain
    "pullback": {
        "lookback": (20, 3, 60),          # candles to look back for the move up
        "min_move_pct": (3.0, 0, 1000),   # size of the move up, % from its low
        "min_retrace_pct": (0.0, 0, 100),
        "max_retrace_pct": (50.0, 0, 100),
        "min_bars": (1, 1, 60),           # pullback length in candles
        "max_bars": (6, 1, 60),
    },
    # Green candles trade more volume than red ones
    "green_volume": {"lookback": (10, 2, 100), "ratio": (1.0, 0, 100)},
    # Price stays above a line (VWAP / EMA / SMA) for the last N candles
    "holds_above": {"line": ("VWAP", None, None), "length": (9, 1, 500), "bars": (5, 1, 100), "use": ("close", None, None)},
    # No candle with a long upper wick in the last N candles
    "no_topping_tail": {"bars": (3, 1, 100), "max_wick_pct": (50.0, 0, 100)},
    # Close above the highest high of the previous N candles
    "breakout": {"lookback": (20, 2, 500)},
    # Volume at least N× the average of the previous candles
    "volume_spike": {"lookback": (20, 2, 500), "multiple": (2.0, 0, 1000)},
    "candle_pattern": {"pattern": ("bullish_engulfing", None, None)},
    # Dips to a moving line and closes back above it (dynamic support)
    "line_bounce": {"line": ("EMA", None, None), "length": (20, 1, 500), "tolerance_pct": (0.5, 0, 50)},
    # Dips to the lowest low of the previous N candles and closes green
    "support_bounce": {"lookback": (50, 5, 500), "tolerance_pct": (1.0, 0, 50)},
}
CHOICES = {
    "line": {"VWAP", "EMA", "SMA"},
    "use": {"close", "low"},
    "pattern": {"bullish_engulfing", "hammer", "three_green"},
}
TRIGGERS = {"close", "break_high", "confirmed_break"}
STOP_TYPES = {"percent", "pullback_low", "signal_low"}


def rule_params(rule) -> dict:
    p = {k: d for k, (d, _, _) in RULE_PARAMS[rule.type].items()}
    p.update(rule.params or {})
    return p


def validate_rules(rules: list) -> list[str]:
    errors = []
    for i, r in enumerate(rules):
        if not isinstance(r, dict) or r.get("type") not in RULE_PARAMS:
            errors.append(f"rule[{i}] unknown type '{r.get('type') if isinstance(r, dict) else r}'")
            continue
        for k, v in (r.get("params") or {}).items():
            spec = RULE_PARAMS[r["type"]].get(k)
            if spec is None:
                errors.append(f"rule[{i}] unknown parameter '{k}'")
            elif k in CHOICES:
                if v not in CHOICES[k]:
                    errors.append(f"rule[{i}] {k} must be one of {sorted(CHOICES[k])}")
            elif not isinstance(v, (int, float)) or not spec[1] <= v <= spec[2]:
                errors.append(f"rule[{i}] {k} must be a number from {spec[1]} to {spec[2]}")
    return errors


def _line(df: pd.DataFrame, p: dict) -> pd.Series:
    spec = {"indicator": p["line"], "params": {} if p["line"] == "VWAP" else {"length": int(p["length"])}}
    compute_indicators(df, [spec])
    return df[make_col_name(spec["indicator"], spec["params"])]


def _pullback(df: pd.DataFrame, p: dict) -> tuple[np.ndarray, np.ndarray]:
    """(passes, pullback low) per candle."""
    L = int(p["lookback"])
    hi, lo = df["high"].to_numpy(float), df["low"].to_numpy(float)
    n = len(hi)
    ok, pull_low = np.zeros(n, bool), np.full(n, np.nan)
    if n < L:
        return ok, pull_low

    wh, wl = sliding_window_view(hi, L), sliding_window_view(lo, L)  # row j covers candles j..j+L-1
    rows = np.arange(len(wh))
    h = L - 1 - np.argmax(wh[:, ::-1], axis=1)                       # latest candle at the high
    high = wh[rows, h]
    low_before = np.minimum.accumulate(wl, axis=1)[rows, h]          # start of the move up
    low_after = np.minimum.accumulate(wl[:, ::-1], axis=1)[:, ::-1]  # [:, k] = min low from k on
    bars = L - 1 - h
    low = np.where(bars > 0, low_after[rows, np.minimum(h + 1, L - 1)], np.nan)

    move = high - low_before
    with np.errstate(divide="ignore", invalid="ignore"):
        move_pct = move / low_before * 100
        retrace = (high - low) / move * 100
        passes = (
            (bars >= p["min_bars"]) & (bars <= p["max_bars"])
            & (move > 0) & (move_pct >= p["min_move_pct"])
            & (retrace >= p["min_retrace_pct"]) & (retrace <= p["max_retrace_pct"])
        )
    ok[L - 1:] = passes
    pull_low[L - 1:] = low
    return ok, pull_low


def _rule_mask(df: pd.DataFrame, rule) -> tuple[pd.Series, np.ndarray | None]:
    """(passes per candle, pullback low or None)."""
    p = rule_params(rule)
    o, h, l, c, v = df["open"], df["high"], df["low"], df["close"], df["volume"]
    green, red = c > o, c < o
    rng = h - l

    if rule.type == "pullback":
        ok, pull_low = _pullback(df, p)
        return pd.Series(ok, index=df.index), pull_low

    if rule.type == "green_volume":
        n = int(p["lookback"])
        g_vol, g_n = (v * green).rolling(n).sum(), green.rolling(n).sum()
        r_vol, r_n = (v * red).rolling(n).sum(), red.rolling(n).sum()
        ok = (r_n == 0) | ((g_n > 0) & (g_vol / g_n.where(g_n > 0) >= p["ratio"] * r_vol / r_n.where(r_n > 0)))
        return ok & g_n.notna(), None

    if rule.type == "holds_above":
        n = int(p["bars"])
        above = (df[p["use"]] >= _line(df, p)).astype(float)
        return above.rolling(n).sum() == n, None

    if rule.type == "no_topping_tail":
        wick = h - np.maximum(o, c)
        tail = ((rng > 0) & (wick / rng.where(rng > 0) * 100 > p["max_wick_pct"])).astype(float)
        return tail.rolling(int(p["bars"])).sum() == 0, None

    if rule.type == "breakout":
        return c > h.shift(1).rolling(int(p["lookback"])).max(), None

    if rule.type == "volume_spike":
        return v >= p["multiple"] * v.shift(1).rolling(int(p["lookback"])).mean(), None

    if rule.type == "candle_pattern":
        po, pc = o.shift(1), c.shift(1)
        if p["pattern"] == "bullish_engulfing":
            return (pc < po) & green & (o <= pc) & (c >= po), None
        if p["pattern"] == "hammer":
            r = rng.where(rng > 0)
            return ((np.minimum(o, c) - l) / r >= 0.6) & ((h - np.maximum(o, c)) / r <= 0.15), None
        # three_green: three green candles, each closing higher
        return green & green.shift(1, fill_value=False) & green.shift(2, fill_value=False) & (c > pc) & (pc > c.shift(2)), None

    if rule.type == "line_bounce":
        line = _line(df, p)
        return (l <= line * (1 + p["tolerance_pct"] / 100)) & (c > line) & green, None

    if rule.type == "support_bounce":
        support = l.shift(1).rolling(int(p["lookback"])).min()
        tol = p["tolerance_pct"] / 100
        return (l <= support * (1 + tol)) & (l >= support * (1 - tol)) & green, None

    raise ValueError(f"unknown rule type {rule.type}")


def add_entry_columns(df: pd.DataFrame, strategy, gate: pd.Series | None = None) -> pd.DataFrame:
    """
    Adds `enter` (open a position on this candle), `enter_price` and
    `enter_stop` (stop-loss level from the setup, NaN for a percent stop).
    `gate` limits which candles may be signal candles (e.g. scanner matches).
    """
    if strategy.entry_conditions:
        signal = conditions_mask(df, strategy.entry_conditions, strategy.logic)
    else:
        signal = pd.Series(True, index=df.index)

    pull_low = None
    for rule in strategy.entry_rules:
        ok, low = _rule_mask(df, rule)
        signal &= ok.fillna(False).astype(bool)
        if low is not None:
            pull_low = low

    if strategy.entry_trigger == "confirmed_break":
        signal &= df["close"] > df["high"].shift(1)
    if gate is not None:
        signal &= gate

    if strategy.stop_type == "pullback_low" and pull_low is not None:
        stop = pd.Series(pull_low, index=df.index)
    elif strategy.stop_type == "signal_low":
        stop = df["low"]
    else:
        stop = pd.Series(np.nan, index=df.index)

    if strategy.entry_trigger == "close":
        df["enter"] = signal
        df["enter_price"] = df["close"]
        df["enter_stop"] = stop
    else:
        level = df["high"].shift(1)
        df["enter"] = signal.shift(1, fill_value=False) & (df["high"] > level)
        df["enter_price"] = np.maximum(df["open"], level)  # gap above the level fills at the open
        df["enter_stop"] = stop.shift(1)
    return df
