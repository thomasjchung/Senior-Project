import pandas as pd
from strategies.models import StrategyConfig
from indicators.calculator import compute_indicators
from indicators.definitions import make_col_name, get_warmup_bars
from backtest.evaluator import evaluate_conditions
from backtest.metrics import compute_metrics


def run_backtest(strategy: StrategyConfig, bars: list[dict], initial_capital: float, timeframe: str) -> dict:
    if len(bars) < 10:
        raise ValueError("Not enough bars to run a backtest (minimum 10 required)")

    df = pd.DataFrame(bars)
    df.rename(columns={"t": "ts", "o": "open", "h": "high", "l": "low", "c": "close", "v": "volume"}, inplace=True)
    df.sort_values("ts", inplace=True)
    df.reset_index(drop=True, inplace=True)

    all_conditions = strategy.entry_conditions + strategy.exit_conditions
    df = compute_indicators(df, [{"indicator": c.indicator, "params": c.params} for c in all_conditions])

    # Calculate warmup period
    warmup = max(
        (get_warmup_bars(c.indicator, c.params) for c in all_conditions),
        default=0,
    ) + 1  # +1 for crossover detection needing prev bar

    if warmup >= len(df):
        raise ValueError(
            f"Not enough bars for indicator warmup: need {warmup + 1} bars, have {len(df)}"
        )

    # Simulation state
    cash = initial_capital
    position = None  # dict when open: {direction, entry_price, shares, entry_ts, stop_price, tp_price}
    trades = []
    equity_curve = []

    def open_position(direction, entry_price, bar_ts):
        nonlocal cash, position
        shares = (cash * strategy.position_size_pct / 100) / entry_price
        if direction == "long":
            cash -= shares * entry_price
            stop_price = entry_price * (1 - strategy.stop_loss_pct / 100) if strategy.stop_loss_pct else None
            tp_price = entry_price * (1 + strategy.take_profit_pct / 100) if strategy.take_profit_pct else None
        else:  # short
            cash += shares * entry_price
            stop_price = entry_price * (1 + strategy.stop_loss_pct / 100) if strategy.stop_loss_pct else None
            tp_price = entry_price * (1 - strategy.take_profit_pct / 100) if strategy.take_profit_pct else None
        position = {
            "direction": direction,
            "entry_price": entry_price,
            "shares": shares,
            "entry_ts": bar_ts,
            "stop_price": stop_price,
            "tp_price": tp_price,
        }

    def close_position(exit_price, exit_ts, exit_reason):
        nonlocal cash, position, trades
        p = position
        if p["direction"] == "long":
            cash += p["shares"] * exit_price
            pnl = (exit_price - p["entry_price"]) * p["shares"]
        else:  # short
            cash -= p["shares"] * exit_price
            pnl = (p["entry_price"] - exit_price) * p["shares"]

        pnl_pct = pnl / (p["entry_price"] * p["shares"]) * 100

        trades.append({
            "entry_ts": p["entry_ts"],
            "exit_ts": exit_ts,
            "direction": p["direction"],
            "entry_price": round(p["entry_price"], 4),
            "exit_price": round(exit_price, 4),
            "shares": round(p["shares"], 4),
            "pnl": round(pnl, 2),
            "pnl_pct": round(pnl_pct, 2),
            "exit_reason": exit_reason,
        })
        position = None

    def current_equity(bar_close):
        if position is None:
            return cash
        if position["direction"] == "long":
            return cash + position["shares"] * bar_close
        else:  # short
            return cash - position["shares"] * (bar_close - position["entry_price"])

    for i in range(warmup, len(df)):
        row = df.iloc[i]
        prev_row = df.iloc[i - 1]
        bar_ts = int(row["ts"])

        equity_curve.append({"t": bar_ts, "equity": round(current_equity(row["close"]), 2)})

        # Stop-loss and take-profit checks (uses bar high/low for realistic fills)
        if position is not None:
            if position["direction"] == "long":
                if position["stop_price"] and row["low"] <= position["stop_price"]:
                    close_position(position["stop_price"], bar_ts, "stop_loss")
                    continue
                if position["tp_price"] and row["high"] >= position["tp_price"]:
                    close_position(position["tp_price"], bar_ts, "take_profit")
                    continue
            else:  # short
                if position["stop_price"] and row["high"] >= position["stop_price"]:
                    close_position(position["stop_price"], bar_ts, "stop_loss")
                    continue
                if position["tp_price"] and row["low"] <= position["tp_price"]:
                    close_position(position["tp_price"], bar_ts, "take_profit")
                    continue

        # Exit signal check
        if position is not None and strategy.exit_conditions:
            if evaluate_conditions(strategy.exit_conditions, strategy.logic, row, prev_row):
                close_position(float(row["close"]), bar_ts, "signal")

        # Entry signal check
        if position is None:
            if evaluate_conditions(strategy.entry_conditions, strategy.logic, row, prev_row):
                direction = _resolve_direction(strategy)
                open_position(direction, float(row["close"]), bar_ts)

    # Close any open position at end of data
    if position is not None:
        last_row = df.iloc[-1]
        close_position(float(last_row["close"]), int(last_row["ts"]), "end_of_data")

    metrics = compute_metrics(trades, equity_curve, initial_capital, timeframe)

    return {
        "metrics": metrics,
        "equity_curve": equity_curve,
        "trades": trades,
    }


def _resolve_direction(strategy: StrategyConfig) -> str:
    if strategy.direction in ("long", "short"):
        return strategy.direction
    # "both" defaults to long (could be extended with a direction indicator)
    return "long"
