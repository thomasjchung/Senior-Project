import time
from datetime import datetime
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest
from alpaca.data.timeframe import TimeFrame, TimeFrameUnit
from alpaca.data.enums import Adjustment, DataFeed
from config import config

_client = None


def get_client() -> StockHistoricalDataClient:
    global _client
    if _client is None:
        _client = StockHistoricalDataClient(
            api_key=config.ALPACA_API_KEY,
            secret_key=config.ALPACA_SECRET_KEY,
        )
    return _client


TIMEFRAME_MAP = {
    "1Min":  TimeFrame(1,  TimeFrameUnit.Minute),
    "5Min":  TimeFrame(5,  TimeFrameUnit.Minute),
    "15Min": TimeFrame(15, TimeFrameUnit.Minute),
    "1Hour": TimeFrame(1,  TimeFrameUnit.Hour),
    "1Day":  TimeFrame(1,  TimeFrameUnit.Day),
}


def fetch_bars(symbol: str, timeframe: str, start: datetime, end: datetime) -> list[dict]:
    """
    Fetch OHLCV bars from Alpaca. Returns list of dicts with keys:
    t (unix int), o, h, l, c, v, vwap, trade_count, source='alpaca'
    """
    tf = TIMEFRAME_MAP.get(timeframe)
    if tf is None:
        raise ValueError(f"Unsupported timeframe: {timeframe}")

    request = StockBarsRequest(
        symbol_or_symbols=symbol,
        timeframe=tf,
        start=start,
        end=end,
        adjustment=Adjustment.SPLIT,
        feed=DataFeed.IEX,
    )

    client = get_client()
    bars_response = client.get_stock_bars(request)
    bars = bars_response.data.get(symbol, [])

    result = []
    for bar in bars:
        result.append({
            "t": int(bar.timestamp.timestamp()),
            "o": float(bar.open),
            "h": float(bar.high),
            "l": float(bar.low),
            "c": float(bar.close),
            "v": float(bar.volume),
            "vwap": float(bar.vwap) if bar.vwap else None,
            "trade_count": int(bar.trade_count) if bar.trade_count else None,
            "source": "alpaca",
        })

    return result


def search_symbols(query: str) -> list[dict]:
    """Return a static list of popular symbols filtered by query."""
    POPULAR = [
        ("AAPL", "Apple Inc.", "NASDAQ"),
        ("MSFT", "Microsoft Corporation", "NASDAQ"),
        ("GOOGL", "Alphabet Inc.", "NASDAQ"),
        ("AMZN", "Amazon.com Inc.", "NASDAQ"),
        ("META", "Meta Platforms Inc.", "NASDAQ"),
        ("TSLA", "Tesla Inc.", "NASDAQ"),
        ("NVDA", "NVIDIA Corporation", "NASDAQ"),
        ("SPY", "SPDR S&P 500 ETF", "NYSE"),
        ("QQQ", "Invesco QQQ Trust", "NASDAQ"),
        ("AMD", "Advanced Micro Devices", "NASDAQ"),
        ("NFLX", "Netflix Inc.", "NASDAQ"),
        ("JPM", "JPMorgan Chase & Co.", "NYSE"),
        ("BAC", "Bank of America Corp.", "NYSE"),
        ("GS", "Goldman Sachs Group Inc.", "NYSE"),
        ("V", "Visa Inc.", "NYSE"),
        ("MA", "Mastercard Inc.", "NYSE"),
        ("DIS", "The Walt Disney Company", "NYSE"),
        ("INTC", "Intel Corporation", "NASDAQ"),
        ("IBM", "International Business Machines", "NYSE"),
        ("WMT", "Walmart Inc.", "NYSE"),
        ("BTC/USD", "Bitcoin / US Dollar", "CRYPTO"),
        ("ETH/USD", "Ethereum / US Dollar", "CRYPTO"),
    ]
    q = query.upper()
    return [
        {"symbol": sym, "name": name, "exchange": exch}
        for sym, name, exch in POPULAR
        if q in sym or q in name.upper()
    ][:10]
