from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing

import pandas as pd

from scanner.alpaca_market import fetch_intraday_bars
from scanner.market_db import connect

SYMBOLS_PER_REQUEST = 200
WORKERS = 6


def _fetch_day(timeframe: str, day: str, symbols: list[str]) -> tuple[str, list[str], dict]:
    bars = {}
    for i in range(0, len(symbols), SYMBOLS_PER_REQUEST):
        bars.update(fetch_intraday_bars(symbols[i:i + SYMBOLS_PER_REQUEST], timeframe, day))
    return day, symbols, bars


def load_intraday(pairs: list[tuple[str, str]], timeframe: str) -> dict[tuple[str, str], pd.DataFrame]:
    """
    Raw SIP bars for each (symbol, day), downloading uncached days one multi-symbol
    request per day. Returns DataFrames with ts, open, high, low, close, volume.
    """
    with closing(connect()) as conn:
        fetched = {
            (r["symbol"], r["day"])
            for r in conn.execute("SELECT symbol, day FROM intraday_fetched WHERE timeframe = ?", (timeframe,))
        }
        by_day = defaultdict(list)
        for symbol, day in pairs:
            if (symbol, day) not in fetched:
                by_day[day].append(symbol)

        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            for day, symbols, bars in pool.map(lambda item: _fetch_day(timeframe, *item), by_day.items()):
                conn.executemany(
                    "INSERT OR REPLACE INTO intraday_bars (symbol, timeframe, ts, open, high, low, close, volume) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    [(sym, timeframe, *bar) for sym, rows in bars.items() for bar in rows],
                )
                conn.executemany(
                    "INSERT OR REPLACE INTO intraday_fetched (symbol, timeframe, day) VALUES (?, ?, ?)",
                    [(sym, timeframe, day) for sym in symbols],
                )
                conn.commit()

        result = {}
        for symbol, day in pairs:
            # 4:00-20:00 ET always falls within 08:00 UTC that day and 01:00 UTC the next
            start = pd.Timestamp(f"{day} 08:00", tz="UTC").timestamp()
            df = pd.read_sql_query(
                "SELECT ts, open, high, low, close, volume FROM intraday_bars "
                "WHERE symbol = ? AND timeframe = ? AND ts BETWEEN ? AND ? ORDER BY ts",
                conn,
                params=(symbol, timeframe, int(start), int(start) + 17 * 3600),
            )
            result[(symbol, day)] = df
    return result
