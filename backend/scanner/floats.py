"""
Shares available to trade ("float"). Alpaca has no fundamentals, so this comes
from yfinance and is cached for a week. Only the current float is available, so
historical scans use today's float for past dates.
"""
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing

import yfinance as yf

from scanner.market_db import connect

MAX_AGE_S = 7 * 24 * 3600


def _lookup(symbol: str) -> float | None:
    try:
        value = yf.Ticker(symbol).info.get("floatShares")
        return float(value) if value else None
    except Exception:
        return None  # unknown symbols (often delisted) raise 404s


def get_floats(symbols: list[str]) -> dict[str, float | None]:
    symbols = sorted(set(symbols))
    if not symbols:
        return {}

    with closing(connect()) as conn:
        cutoff = time.time() - MAX_AGE_S
        result = {}
        for i in range(0, len(symbols), 500):
            chunk = symbols[i:i + 500]
            rows = conn.execute(
                f"SELECT symbol, float_shares, fetched_at FROM floats WHERE symbol IN ({','.join('?' * len(chunk))})",
                chunk,
            ).fetchall()
            result.update({r["symbol"]: r["float_shares"] for r in rows if r["fetched_at"] >= cutoff})

        missing = [s for s in symbols if s not in result]
        if missing:
            with ThreadPoolExecutor(max_workers=8) as pool:
                fetched = dict(zip(missing, pool.map(_lookup, missing)))
            now = int(time.time())
            conn.executemany(
                "INSERT OR REPLACE INTO floats (symbol, float_shares, fetched_at) VALUES (?, ?, ?)",
                [(s, v, now) for s, v in fetched.items()],
            )
            conn.commit()
            result.update(fetched)

    return result
