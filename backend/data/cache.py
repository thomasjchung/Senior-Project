from datetime import datetime, timezone
from database import get_db


def to_ts(date_str: str) -> int:
    dt = datetime.fromisoformat(date_str)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return int(dt.timestamp())


def get_cache_status(symbol: str, timeframe: str) -> dict | None:
    db = get_db()
    row = db.execute(
        """
        SELECT MIN(ts) AS earliest, MAX(ts) AS latest, COUNT(*) AS bar_count
        FROM ohlcv_cache
        WHERE symbol = ? AND timeframe = ?
        """,
        (symbol.upper(), timeframe),
    ).fetchone()

    if row["bar_count"] == 0:
        return None

    return {
        "symbol": symbol.upper(),
        "timeframe": timeframe,
        "earliest_ts": row["earliest"],
        "latest_ts": row["latest"],
        "bar_count": row["bar_count"],
    }


def get_missing_ranges(symbol: str, timeframe: str, start_ts: int, end_ts: int) -> list[tuple[int, int]]:
    """Return the sub-ranges of [start_ts, end_ts] that have not been fetched yet."""
    db = get_db()
    rows = db.execute(
        """
        SELECT start_ts, end_ts FROM ohlcv_fetched_ranges
        WHERE symbol = ? AND timeframe = ? AND end_ts >= ? AND start_ts <= ?
        ORDER BY start_ts ASC
        """,
        (symbol.upper(), timeframe, start_ts, end_ts),
    ).fetchall()

    gaps = []
    cursor = start_ts
    for r in rows:
        if r["start_ts"] > cursor:
            gaps.append((cursor, r["start_ts"]))
        cursor = max(cursor, r["end_ts"])
        if cursor >= end_ts:
            break
    if cursor < end_ts:
        gaps.append((cursor, end_ts))
    return gaps


def record_fetched_range(symbol: str, timeframe: str, start_ts: int, end_ts: int) -> None:
    """Mark [start_ts, end_ts] as fetched, merging with overlapping/adjacent ranges."""
    db = get_db()
    symbol = symbol.upper()
    overlapping = db.execute(
        """
        SELECT id, start_ts, end_ts FROM ohlcv_fetched_ranges
        WHERE symbol = ? AND timeframe = ? AND end_ts >= ? AND start_ts <= ?
        """,
        (symbol, timeframe, start_ts, end_ts),
    ).fetchall()

    for r in overlapping:
        start_ts = min(start_ts, r["start_ts"])
        end_ts = max(end_ts, r["end_ts"])

    db.executemany("DELETE FROM ohlcv_fetched_ranges WHERE id = ?", [(r["id"],) for r in overlapping])
    db.execute(
        "INSERT INTO ohlcv_fetched_ranges (symbol, timeframe, start_ts, end_ts) VALUES (?, ?, ?, ?)",
        (symbol, timeframe, start_ts, end_ts),
    )
    db.commit()


def get_cached_bars(symbol: str, timeframe: str, start_ts: int, end_ts: int) -> list[dict]:
    db = get_db()
    rows = db.execute(
        """
        SELECT ts, open, high, low, close, volume, vwap, trade_count, source
        FROM ohlcv_cache
        WHERE symbol = ? AND timeframe = ? AND ts BETWEEN ? AND ?
        ORDER BY ts ASC
        """,
        (symbol.upper(), timeframe, start_ts, end_ts),
    ).fetchall()

    return [
        {
            "t": r["ts"],
            "o": r["open"],
            "h": r["high"],
            "l": r["low"],
            "c": r["close"],
            "v": r["volume"],
            "vwap": r["vwap"],
            "trade_count": r["trade_count"],
            "source": r["source"],
        }
        for r in rows
    ]


def store_bars(symbol: str, timeframe: str, bars: list[dict]) -> None:
    """Bulk-insert bars into cache, ignoring duplicates."""
    if not bars:
        return

    db = get_db()
    rows = [
        (
            symbol.upper(),
            timeframe,
            b["t"],
            b["o"],
            b["h"],
            b["l"],
            b["c"],
            b["v"],
            b.get("vwap"),
            b.get("trade_count"),
            b.get("source", "alpaca"),
        )
        for b in bars
    ]

    db.executemany(
        """
        INSERT OR IGNORE INTO ohlcv_cache
            (symbol, timeframe, ts, open, high, low, close, volume, vwap, trade_count, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        rows,
    )
    db.commit()
