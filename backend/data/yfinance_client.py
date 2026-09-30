import yfinance as yf
from datetime import datetime


def fetch_bars_daily(symbol: str, start: datetime, end: datetime) -> list[dict]:
    """
    Fallback daily bar fetcher using yfinance. Returns same dict shape as alpaca_client.
    Note: yfinance returns split+dividend adjusted prices by default.
    """
    ticker = yf.Ticker(symbol)
    df = ticker.history(start=start, end=end, interval="1d", auto_adjust=True)

    if df.empty:
        return []

    result = []
    for ts, row in df.iterrows():
        result.append({
            "t": int(ts.timestamp()),
            "o": float(row["Open"]),
            "h": float(row["High"]),
            "l": float(row["Low"]),
            "c": float(row["Close"]),
            "v": float(row["Volume"]),
            "vwap": None,
            "trade_count": None,
            "source": "yfinance",
        })

    return result
