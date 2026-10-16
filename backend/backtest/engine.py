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

    book = Book(strategy, initial_capital)
    equity_curve = []

    for i in range(warmup, len(df)):
        row = df.iloc[i]
        prev_row = df.iloc[i - 1]
        bar_ts = int(row["ts"])

        equity_curve.append({"t": bar_ts, "equity": round(book.equity(row["close"]), 2)})

        if book.check_stops(row, bar_ts):
            continue

        # Exit signal check
        if book.position is not None and strategy.exit_conditions:
            if evaluate_conditions(strategy.exit_conditions, strategy.logic, row, prev_row):
                book.close(float(row["close"]), bar_ts, "signal")

        # Entry signal check
        if book.position is None:
            if evaluate_conditions(strategy.entry_conditions, strategy.logic, row, prev_row):
                book.open(resolve_direction(strategy), float(row["close"]), bar_ts)

    # Close any open position at end of data
    if book.position is not None:
        last_row = df.iloc[-1]
        book.close(float(last_row["close"]), int(last_row["ts"]), "end_of_data")

    metrics = compute_metrics(book.trades, equity_curve, initial_capital, timeframe)

    return {
        "metrics": metrics,
        "equity_curve": equity_curve,
        "trades": book.trades,
    }


class Book:
    """Cash, the single open position, and closed trades."""

    def __init__(self, strategy: StrategyConfig, initial_capital: float):
        self.strategy = strategy
        self.cash = initial_capital
        self.position = None  # dict when open: {direction, entry_price, shares, entry_ts, stop_price, tp_price, symbol}
        self.trades = []

    def open(self, direction: str, entry_price: float, bar_ts: int, symbol: str | None = None):
        strategy = self.strategy
        shares = (self.cash * strategy.position_size_pct / 100) / entry_price
        if direction == "long":
            self.cash -= shares * entry_price
            stop_price = entry_price * (1 - strategy.stop_loss_pct / 100) if strategy.stop_loss_pct else None
            tp_price = entry_price * (1 + strategy.take_profit_pct / 100) if strategy.take_profit_pct else None
        else:  # short
            self.cash += shares * entry_price
            stop_price = entry_price * (1 + strategy.stop_loss_pct / 100) if strategy.stop_loss_pct else None
            tp_price = entry_price * (1 - strategy.take_profit_pct / 100) if strategy.take_profit_pct else None
        self.position = {
            "direction": direction,
            "entry_price": entry_price,
            "shares": shares,
            "entry_ts": bar_ts,
            "stop_price": stop_price,
            "tp_price": tp_price,
            "symbol": symbol,
        }

    def close(self, exit_price: float, exit_ts: int, exit_reason: str):
        p = self.position
        if p["direction"] == "long":
            self.cash += p["shares"] * exit_price
            pnl = (exit_price - p["entry_price"]) * p["shares"]
        else:  # short
            self.cash -= p["shares"] * exit_price
            pnl = (p["entry_price"] - exit_price) * p["shares"]

        pnl_pct = pnl / (p["entry_price"] * p["shares"]) * 100

        trade = {
            "entry_ts": p["entry_ts"],
            "exit_ts": exit_ts,
            "direction": p["direction"],
            "entry_price": round(p["entry_price"], 4),
            "exit_price": round(exit_price, 4),
            "shares": round(p["shares"], 4),
            "pnl": round(pnl, 2),
            "pnl_pct": round(pnl_pct, 2),
            "exit_reason": exit_reason,
        }
        if p["symbol"]:
            trade["symbol"] = p["symbol"]
        self.trades.append(trade)
        self.position = None

    def equity(self, bar_close: float) -> float:
        p = self.position
        if p is None:
            return self.cash
        if p["direction"] == "long":
            return self.cash + p["shares"] * bar_close
        else:  # short
            return self.cash - p["shares"] * (bar_close - p["entry_price"])

    def check_stops(self, row, bar_ts: int) -> bool:
        """Stop-loss and take-profit checks (uses bar high/low for realistic fills). True if closed."""
        p = self.position
        if p is None:
            return False
        if p["direction"] == "long":
            if p["stop_price"] and row["low"] <= p["stop_price"]:
                self.close(p["stop_price"], bar_ts, "stop_loss")
                return True
            if p["tp_price"] and row["high"] >= p["tp_price"]:
                self.close(p["tp_price"], bar_ts, "take_profit")
                return True
        else:  # short
            if p["stop_price"] and row["high"] >= p["stop_price"]:
                self.close(p["stop_price"], bar_ts, "stop_loss")
                return True
            if p["tp_price"] and row["low"] <= p["tp_price"]:
                self.close(p["tp_price"], bar_ts, "take_profit")
                return True
        return False


def resolve_direction(strategy: StrategyConfig) -> str:
    if strategy.direction in ("long", "short"):
        return strategy.direction
    # "both" defaults to long (could be extended with a direction indicator)
    return "long"
