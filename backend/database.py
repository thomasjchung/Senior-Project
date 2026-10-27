import sqlite3
from flask import g
from config import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS ohlcv_cache (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol      TEXT    NOT NULL,
    timeframe   TEXT    NOT NULL,
    ts          INTEGER NOT NULL,
    open        REAL    NOT NULL,
    high        REAL    NOT NULL,
    low         REAL    NOT NULL,
    close       REAL    NOT NULL,
    volume      REAL    NOT NULL,
    vwap        REAL,
    trade_count INTEGER,
    source      TEXT    NOT NULL DEFAULT 'alpaca',
    UNIQUE(symbol, timeframe, ts)
);

CREATE INDEX IF NOT EXISTS idx_ohlcv ON ohlcv_cache(symbol, timeframe, ts);

-- Time ranges already requested from a provider, so gaps with no bars
-- (weekends, holidays, overnight) are not re-fetched.
CREATE TABLE IF NOT EXISTS ohlcv_fetched_ranges (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol    TEXT    NOT NULL,
    timeframe TEXT    NOT NULL,
    start_ts  INTEGER NOT NULL,
    end_ts    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fetched_ranges ON ohlcv_fetched_ranges(symbol, timeframe, start_ts);

CREATE TABLE IF NOT EXISTS strategies (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL UNIQUE,
    config     TEXT    NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

-- Every backtest run, with the exact settings used, so results can be reviewed later.
-- strategy_id is informational: runs outlive the saved strategy they came from.
CREATE TABLE IF NOT EXISTS backtest_runs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL,
    strategy_id     INTEGER,
    symbol          TEXT,               -- NULL for scanner-universe runs
    timeframe       TEXT    NOT NULL,
    start_date      TEXT    NOT NULL,
    end_date        TEXT    NOT NULL,
    initial_capital REAL    NOT NULL,
    config_json     TEXT    NOT NULL,
    metrics_json    TEXT    NOT NULL,   -- copy of result.metrics, so listing runs skips the big result
    result_json     TEXT    NOT NULL,
    notes           TEXT    NOT NULL DEFAULT '',
    ran_at          INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
"""


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(
            config.DB_PATH,
            check_same_thread=False,
            detect_types=sqlite3.PARSE_DECLTYPES,
        )
        g.db.row_factory = sqlite3.Row
    return g.db


def close_db(e=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    conn = sqlite3.connect(config.DB_PATH, check_same_thread=False)
    conn.executescript(SCHEMA)
    conn.commit()
    conn.close()


def init_app(app):
    app.teardown_appcontext(close_db)
