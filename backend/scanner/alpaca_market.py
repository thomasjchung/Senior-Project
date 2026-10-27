"""
Alpaca calls used by the scanner. Historical data uses the SIP (full market) feed,
which the free plan allows for anything older than 15 minutes, with RAW prices so
price filters see what a stock actually traded at on that day. Live data uses IEX,
since recent SIP data needs a paid subscription.
"""
import re
import time
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import requests
from alpaca.data.enums import Adjustment, DataFeed
from alpaca.data.historical.screener import ScreenerClient
from alpaca.data.requests import MarketMoversRequest, StockBarsRequest, StockSnapshotRequest
from alpaca.data.timeframe import TimeFrame
from alpaca.trading.client import TradingClient

from config import config
from data.alpaca_client import TIMEFRAME_MAP, get_client
from scanner.market_db import get_meta, set_meta

ET = ZoneInfo("America/New_York")
SIP_DELAY = timedelta(minutes=16)

# Warrants, units and rights trade like penny stocks and would swamp the scanner
_DERIVATIVE_NAME = re.compile(r"\b(warrants?|units?|rights?)\b", re.IGNORECASE)
# Delisted assets are often renamed (e.g. "ARII_DELISTED"), which the bars API rejects
_TICKER = re.compile(r"^[A-Z]{1,5}(\.[A-Z]{1,2})?$")

_screener = None
_trading = None


def _screener_client() -> ScreenerClient:
    global _screener
    if _screener is None:
        _screener = ScreenerClient(config.ALPACA_API_KEY, config.ALPACA_SECRET_KEY)
    return _screener


def _trading_client() -> TradingClient:
    global _trading
    if _trading is None:
        _trading = TradingClient(config.ALPACA_API_KEY, config.ALPACA_SECRET_KEY, paper=True)
    return _trading


def et_day(dt: datetime) -> str:
    return dt.astimezone(ET).strftime("%Y-%m-%d")


def et_datetime(day: str, hour: int, minute: int = 0) -> datetime:
    return datetime.strptime(day, "%Y-%m-%d").replace(hour=hour, minute=minute, tzinfo=ET)


def refresh_assets(conn, max_age_s: int = 24 * 3600) -> None:
    """Refresh the listed-equity universe at most once a day."""
    updated = get_meta(conn, "assets_updated_at")
    if updated and time.time() - float(updated) < max_age_s:
        return

    client = _trading_client()
    rows = {}
    # Inactive first so a reused ticker ends up described by its active asset.
    # Raw JSON rather than alpaca-py's Asset model: its exchange enum rejects
    # exchanges newer than the library (e.g. TXSE), failing the whole list.
    for status, active in (("inactive", 0), ("active", 1)):
        for a in client.get("/assets", {"asset_class": "us_equity", "status": status}):
            symbol, name, exchange = a.get("symbol", ""), a.get("name") or "", a.get("exchange") or ""
            if exchange == "OTC" or not _TICKER.match(symbol) or _DERIVATIVE_NAME.search(name):
                continue
            rows[symbol] = (symbol, name, exchange, active)

    conn.execute("DELETE FROM assets")
    conn.executemany("INSERT INTO assets (symbol, name, exchange, active) VALUES (?, ?, ?, ?)", rows.values())
    conn.commit()
    set_meta(conn, "assets_updated_at", str(time.time()))


def fetch_daily_bars(symbols: list[str], start_day: str, end_day: str) -> list[tuple]:
    """Raw SIP daily bars as (symbol, day, o, h, l, c, v) rows."""
    end = min(et_datetime(end_day, 23, 59), datetime.now(timezone.utc) - SIP_DELAY)
    resp = get_client().get_stock_bars(StockBarsRequest(
        symbol_or_symbols=symbols,
        timeframe=TimeFrame.Day,
        start=et_datetime(start_day, 0),
        end=end,
        feed=DataFeed.SIP,
        adjustment=Adjustment.RAW,
    ))
    return [
        (sym, et_day(b.timestamp), b.open, b.high, b.low, b.close, b.volume)
        for sym, bars in resp.data.items()
        for b in bars
    ]


def fetch_splits(start_day: str, end_day: str) -> list[tuple]:
    """Forward and reverse splits as (symbol, ex_date, share_ratio) rows."""
    headers = {"APCA-API-KEY-ID": config.ALPACA_API_KEY, "APCA-API-SECRET-KEY": config.ALPACA_SECRET_KEY}
    params = {"types": "forward_split,reverse_split", "start": start_day, "end": end_day, "limit": 1000}
    rows = []
    while True:
        r = requests.get(f"{config.ALPACA_DATA_URL}/v1/corporate-actions", headers=headers, params=params, timeout=30)
        r.raise_for_status()
        data = r.json()
        for kind in ("forward_splits", "reverse_splits"):
            for s in data["corporate_actions"].get(kind, []):
                if s.get("old_rate") and s.get("new_rate"):
                    rows.append((s["symbol"], s["ex_date"], float(s["new_rate"]) / float(s["old_rate"])))
        token = data.get("next_page_token")
        if not token:
            return rows
        params["page_token"] = token


def fetch_intraday_bars(symbols: list[str], timeframe: str, day: str) -> dict[str, list[tuple]]:
    """Raw SIP bars for one trading day, 4:00-20:00 ET (pre-market through after-hours)."""
    end = min(et_datetime(day, 20), datetime.now(timezone.utc) - SIP_DELAY)
    resp = get_client().get_stock_bars(StockBarsRequest(
        symbol_or_symbols=symbols,
        timeframe=TIMEFRAME_MAP[timeframe],
        start=et_datetime(day, 4),
        end=end,
        feed=DataFeed.SIP,
        adjustment=Adjustment.RAW,
    ))
    return {
        sym: [(int(b.timestamp.timestamp()), b.open, b.high, b.low, b.close, b.volume) for b in bars]
        for sym, bars in resp.data.items()
    }


def fetch_top_gainers() -> tuple[list, datetime]:
    """Alpaca's market movers screener (max 50 gainers)."""
    movers = _screener_client().get_market_movers(MarketMoversRequest(top=50))
    return movers.gainers, movers.last_updated


def fetch_iex_snapshots(symbols: list[str]) -> dict:
    return get_client().get_stock_snapshot(StockSnapshotRequest(symbol_or_symbols=symbols, feed=DataFeed.IEX))


def fetch_iex_daily_volumes(symbols: list[str], start_day: str, end_day: str) -> dict[str, list[float]]:
    resp = get_client().get_stock_bars(StockBarsRequest(
        symbol_or_symbols=symbols,
        timeframe=TimeFrame.Day,
        start=et_datetime(start_day, 0),
        end=et_datetime(end_day, 23, 59),
        feed=DataFeed.IEX,
    ))
    return {sym: [b.volume for b in bars] for sym, bars in resp.data.items()}
