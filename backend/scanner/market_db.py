"""
Whole-market data used by the scanner and universe backtests. Kept in its own
SQLite file (market.db) because it is large (~3M daily rows per year of history)
and is written by a background sync thread, so it does not use Flask's `g`.
"""
import sqlite3
from contextlib import closing
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "market.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT
);

-- Listed (non-OTC) US equities, including delisted ones to limit survivorship bias
CREATE TABLE IF NOT EXISTS assets (
    symbol   TEXT PRIMARY KEY,
    name     TEXT,
    exchange TEXT,
    active   INTEGER NOT NULL
);

-- Raw (unadjusted) SIP daily bars; `day` is the America/New_York trading date
CREATE TABLE IF NOT EXISTS daily_bars (
    symbol TEXT NOT NULL,
    day    TEXT NOT NULL,
    open   REAL NOT NULL,
    high   REAL NOT NULL,
    low    REAL NOT NULL,
    close  REAL NOT NULL,
    volume REAL NOT NULL,
    PRIMARY KEY (symbol, day)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_daily_day ON daily_bars(day);

-- How far each calendar month (YYYY-MM) of daily_bars has been downloaded
CREATE TABLE IF NOT EXISTS synced_months (
    month       TEXT PRIMARY KEY,
    through_day TEXT NOT NULL
);

-- Share multiplier on ex_date: 2.0 for a 2:1 split, 0.1 for a 1:10 reverse split
CREATE TABLE IF NOT EXISTS splits (
    symbol  TEXT NOT NULL,
    ex_date TEXT NOT NULL,
    ratio   REAL NOT NULL,
    PRIMARY KEY (symbol, ex_date)
) WITHOUT ROWID;

-- Raw SIP intraday bars for scanner candidates, fetched one trading day at a time
CREATE TABLE IF NOT EXISTS intraday_bars (
    symbol    TEXT    NOT NULL,
    timeframe TEXT    NOT NULL,
    ts        INTEGER NOT NULL,
    open      REAL    NOT NULL,
    high      REAL    NOT NULL,
    low       REAL    NOT NULL,
    close     REAL    NOT NULL,
    volume    REAL    NOT NULL,
    PRIMARY KEY (symbol, timeframe, ts)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS intraday_fetched (
    symbol    TEXT NOT NULL,
    timeframe TEXT NOT NULL,
    day       TEXT NOT NULL,
    PRIMARY KEY (symbol, timeframe, day)
) WITHOUT ROWID;

-- Shares available to trade. NULL = looked up but unknown (e.g. delisted).
CREATE TABLE IF NOT EXISTS floats (
    symbol       TEXT PRIMARY KEY,
    float_shares REAL,
    fetched_at   INTEGER NOT NULL
);
"""


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=30, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    # WAL lets scans read while the sync thread writes
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_market_db() -> None:
    with closing(connect()) as conn:
        conn.executescript(SCHEMA)
        conn.commit()


def get_meta(conn: sqlite3.Connection, key: str) -> str | None:
    row = conn.execute("SELECT value FROM meta WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else None


def set_meta(conn: sqlite3.Connection, key: str, value: str) -> None:
    conn.execute("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", (key, value))
    conn.commit()
