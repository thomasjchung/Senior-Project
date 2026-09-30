import math
import pandas as pd


TIMEFRAME_BARS_PER_DAY = {
    "1Min":  390,
    "5Min":  78,
    "15Min": 26,
    "1Hour": 6.5,
    "1Day":  1,
}


def compute_metrics(trades: list[dict], equity_curve: list[dict], initial_capital: float, timeframe: str) -> dict:
    if not equity_curve:
        return _empty_metrics()

    final_equity = equity_curve[-1]["equity"]
    total_return_pct = (final_equity / initial_capital - 1) * 100

    # CAGR
    start_ts = equity_curve[0]["t"]
    end_ts = equity_curve[-1]["t"]
    years = max((end_ts - start_ts) / (365.25 * 24 * 3600), 1 / 365)
    cagr_pct = ((final_equity / initial_capital) ** (1 / years) - 1) * 100

    # Sharpe from equity curve returns
    equities = pd.Series([p["equity"] for p in equity_curve])
    returns = equities.pct_change().dropna()
    bars_per_day = TIMEFRAME_BARS_PER_DAY.get(timeframe, 1)
    annualization = math.sqrt(252 * bars_per_day)
    sharpe = (returns.mean() / returns.std() * annualization) if returns.std() > 0 else 0.0

    # Max drawdown
    peak = equities.cummax()
    drawdown = (equities - peak) / peak * 100
    max_drawdown_pct = float(drawdown.min())

    # Trade stats
    total_trades = len(trades)
    if total_trades == 0:
        win_rate_pct = 0.0
        avg_trade_pct = 0.0
        profit_factor = 0.0
    else:
        wins = [t for t in trades if t["pnl"] > 0]
        losses = [t for t in trades if t["pnl"] <= 0]
        win_rate_pct = len(wins) / total_trades * 100
        avg_trade_pct = sum(t["pnl_pct"] for t in trades) / total_trades
        gross_profit = sum(t["pnl"] for t in wins)
        gross_loss = abs(sum(t["pnl"] for t in losses))
        profit_factor = gross_profit / gross_loss if gross_loss > 0 else 0.0

    return {
        "total_return_pct": round(total_return_pct, 2),
        "cagr_pct": round(cagr_pct, 2),
        "sharpe_ratio": round(float(sharpe), 3),
        "max_drawdown_pct": round(max_drawdown_pct, 2),
        "win_rate_pct": round(win_rate_pct, 1),
        "total_trades": total_trades,
        "avg_trade_pct": round(avg_trade_pct, 2),
        "profit_factor": round(profit_factor, 2),
        "final_equity": round(final_equity, 2),
        "initial_capital": initial_capital,
    }


def _empty_metrics() -> dict:
    return {
        "total_return_pct": 0.0,
        "cagr_pct": 0.0,
        "sharpe_ratio": 0.0,
        "max_drawdown_pct": 0.0,
        "win_rate_pct": 0.0,
        "total_trades": 0,
        "avg_trade_pct": 0.0,
        "profit_factor": 0.0,
        "final_equity": 0.0,
        "initial_capital": 0.0,
    }
