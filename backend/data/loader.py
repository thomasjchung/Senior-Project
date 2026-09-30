import time
from datetime import datetime, timezone
from data.cache import get_cached_bars, get_missing_ranges, record_fetched_range, store_bars
from data.alpaca_client import fetch_bars
from data.yfinance_client import fetch_bars_daily


class BarFetchError(Exception):
    def __init__(self, message: str, detail: str):
        super().__init__(message)
        self.detail = detail


def _alpaca_error_message(e: Exception) -> str:
    msg = str(e)
    if "401" in msg or "403" in msg or "forbidden" in msg.lower():
        return "Alpaca rejected the API credentials — check ALPACA_API_KEY / ALPACA_SECRET_KEY in .env"
    return "alpaca fetch failed"


def load_bars(symbol: str, timeframe: str, start_ts: int, end_ts: int) -> tuple[list[dict], bool]:
    """
    Return (bars, fully_cached) for [start_ts, end_ts]. Only the sub-ranges that
    have never been fetched hit the network; everything is persisted to SQLite.
    """
    # Never mark the future as fetched, or bars that appear later would never be loaded.
    fetch_end_ts = min(end_ts, int(time.time()))
    gaps = get_missing_ranges(symbol, timeframe, start_ts, fetch_end_ts) if start_ts < fetch_end_ts else []

    for gap_start, gap_end in gaps:
        gap_start_dt = datetime.fromtimestamp(gap_start, timezone.utc)
        gap_end_dt = datetime.fromtimestamp(gap_end, timezone.utc)
        try:
            bars = fetch_bars(symbol, timeframe, gap_start_dt, gap_end_dt)
        except Exception as e:
            # Fallback to yfinance for daily data only
            if timeframe != "1Day":
                raise BarFetchError(_alpaca_error_message(e), str(e)) from e
            try:
                bars = fetch_bars_daily(symbol, gap_start_dt, gap_end_dt)
            except Exception as yf_e:
                raise BarFetchError("fetch failed", str(yf_e)) from yf_e

        store_bars(symbol, timeframe, bars)
        record_fetched_range(symbol, timeframe, gap_start, gap_end)

    return get_cached_bars(symbol, timeframe, start_ts, end_ts), not gaps
