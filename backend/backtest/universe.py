"""
Backtest a strategy on whichever stocks met the scanner criteria at the time.

Point-in-time rules, so the backtest only knows what a trader could have known:
  1. Daily bars find (stock, day) pairs that *could* have qualified at some point
     that day (e.g. the day's high reached the % gain). This is only a prefilter.
  2. On those days' intraday bars, the criteria are re-checked at every bar using
     only data up to that bar: price at that bar, % change from the previous
     close, and volume so far today (including pre-market) vs. the average
     daily volume.
  3. Entries are only allowed on bars where the stock qualified and the
     strategy's entry conditions hold. One position at a time across all stocks;
     positions are closed by the end of the day.
Float is the exception: only today's float is available, so it is applied as of now.
"""
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd

from backtest.engine import Book
from backtest.evaluator import conditions_mask
from backtest.metrics import compute_metrics
from backtest.setups import add_entry_columns
from indicators.calculator import compute_indicators
from scanner.criteria import ScanCriteria
from scanner.floats import get_floats
from scanner.history import daily_metrics, lookback_start, missing_history_message, trading_days
from scanner.intraday import load_intraday

ET = ZoneInfo("America/New_York")
INTRADAY_TIMEFRAMES = {"1Min", "5Min", "15Min", "1Hour"}
MAX_CANDIDATE_DAYS = 3000


class MarketHistoryMissing(Exception):
    def __init__(self, start: str, end: str, message: str):
        super().__init__(message)
        self.start = start
        self.end = end


def _candidate_days(criteria: ScanCriteria, start: str, end: str) -> pd.DataFrame:
    df = daily_metrics(start, end, criteria.avg_volume_days)
    if df.empty:
        return df
    df = df[df["prev_close"] > 0]
    # Each test is the most favourable the day could have been, so no stock that
    # qualified intraday is dropped; the bar-by-bar check below does the real filtering.
    mask = pd.Series(True, index=df.index)
    if criteria.min_price is not None:
        mask &= df["high"] >= criteria.min_price
    if criteria.max_price is not None:
        mask &= df["low"] <= criteria.max_price
    if criteria.min_change_pct is not None:
        mask &= (df["high"] / df["prev_close"] - 1) * 100 >= criteria.min_change_pct
    if criteria.min_volume is not None:
        mask &= df["volume"] >= criteria.min_volume
    if criteria.min_rvol is not None:
        mask &= df["volume"] >= criteria.min_rvol * df["avg_volume"]
    return df[mask]


def _gate(df: pd.DataFrame, day: str, prev_close: float, avg_volume: float,
          criteria: ScanCriteria, regular_hours_only: bool) -> pd.DataFrame:
    """Add `tradable` (bar is in the session) and `qualifies` (criteria met as of this bar)."""
    et = pd.to_datetime(df["ts"], unit="s", utc=True).dt.tz_convert(ET)
    minutes = et.dt.hour * 60 + et.dt.minute
    on_day = et.dt.strftime("%Y-%m-%d") == day
    session = (minutes >= 9 * 60 + 30) & (minutes < 16 * 60) if regular_hours_only else (minutes >= 4 * 60)
    df["tradable"] = on_day & session

    # Daily volume (and so the average) includes pre/after-market, so count from 4:00 ET
    volume_so_far = df["volume"].where(on_day, 0).cumsum()
    change_pct = (df["close"] / prev_close - 1) * 100
    ok = df["tradable"].copy()
    if criteria.min_price is not None:
        ok &= df["close"] >= criteria.min_price
    if criteria.max_price is not None:
        ok &= df["close"] <= criteria.max_price
    if criteria.min_change_pct is not None:
        ok &= change_pct >= criteria.min_change_pct
    if criteria.min_volume is not None:
        ok &= volume_so_far >= criteria.min_volume
    if criteria.min_rvol is not None:
        ok &= volume_so_far >= criteria.min_rvol * avg_volume
    df["qualifies"] = ok
    df["change_pct"] = change_pct
    return df


def run_universe_backtest(strategy, criteria: ScanCriteria, regular_hours_only: bool,
                          timeframe: str, start: str, end: str, initial_capital: float) -> dict:
    if timeframe not in INTRADAY_TIMEFRAMES:
        raise ValueError("Scanner backtests need an intraday timeframe (1Min, 5Min, 15Min or 1Hour)")

    message = missing_history_message(start, end, criteria.avg_volume_days)
    if message:
        raise MarketHistoryMissing(lookback_start(start, criteria.avg_volume_days), end, message)

    cands = _candidate_days(criteria, start, end)
    floats = {}
    if criteria.needs_float() and not cands.empty:
        floats = get_floats(cands["symbol"].unique().tolist())
        cands = cands[[criteria.passes_float(floats.get(s)) for s in cands["symbol"]]]
    if len(cands) > MAX_CANDIDATE_DAYS:
        raise ValueError(
            f"{len(cands)} stock-days could match these criteria (limit {MAX_CANDIDATE_DAYS}); "
            "tighten the criteria or shorten the date range"
        )

    bars = load_intraday(list(zip(cands["symbol"], cands["day"])), timeframe)
    conditions = strategy.entry_conditions + strategy.exit_conditions

    # Per stock-day: bar records plus the indices of bars inside the trading session
    sessions = []
    for c in cands.itertuples():
        df = bars.get((c.symbol, c.day))
        if df is None or df.empty:
            continue
        df = compute_indicators(df, [{"indicator": x.indicator, "params": x.params} for x in conditions])
        df = _gate(df, c.day, c.prev_close, c.avg_volume, criteria, regular_hours_only)
        # Signal candles must be scanner matches; a breakout entry fills on the candle after
        df = add_entry_columns(df, strategy, gate=df["qualifies"])
        df["exit_signal"] = conditions_mask(df, strategy.exit_conditions, strategy.logic)
        tradable = np.flatnonzero(df["tradable"].to_numpy())
        if len(tradable) < 2:
            continue
        sessions.append({"symbol": c.symbol, "day": c.day, "rows": df.to_dict("records"), "tradable": tradable})

    # All bars in time order; at equal times, the stronger mover is considered first
    events = sorted(
        ((s["rows"][i]["ts"], -s["rows"][i]["change_pct"], k, i) for k, s in enumerate(sessions) for i in s["tradable"]),
    )

    book = Book(strategy, initial_capital)
    held = None  # index into sessions of the open position
    days = trading_days(start, end)
    equity_by_day = {}

    for ts, _, k, i in events:
        s = sessions[k]
        row = s["rows"][i]
        last_bar = i == s["tradable"][-1]

        if held == k:
            stopped = book.check_stops(row, ts)
            if not stopped:
                if row["exit_signal"]:
                    book.close(float(row["close"]), ts, "signal")
                elif last_bar:
                    book.close(float(row["close"]), ts, "end_of_day")
            if book.position is None:
                held = None
                equity_by_day[s["day"]] = book.cash  # cash only changes when a position closes
            if stopped or (book.position is None and strategy.entry_trigger != "close"):
                continue

        if book.position is None and not last_bar and row["enter"]:
            if book.enter(row, ts, symbol=s["symbol"]):
                held = k
                if book.position is None:  # stopped out on the entry candle
                    held = None
                    equity_by_day[s["day"]] = book.cash

    # Daily equity (every position is flat by each day's close)
    equity_curve = []
    equity = initial_capital
    for day in days:
        equity = equity_by_day.get(day, equity)
        ts = int(pd.Timestamp(f"{day} 16:00", tz=ET).timestamp())
        equity_curve.append({"t": ts, "equity": round(equity, 2)})

    return {
        "metrics": compute_metrics(book.trades, equity_curve, initial_capital, "1Day"),
        "equity_curve": equity_curve,
        "trades": book.trades,
        "universe": {
            "candidate_days": len(cands),
            "sessions": len(sessions),
            "symbols": int(cands["symbol"].nunique()) if not cands.empty else 0,
            # Stocks dropped because their float couldn't be found
            "float_unknown": 0 if criteria.include_unknown_float else sum(1 for v in floats.values() if v is None),
        },
    }
