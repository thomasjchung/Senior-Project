"""
Whole-market daily history for point-in-time scans.

Downloading every listed stock's daily bars is slow (~2 min per month of history
on one connection), so it runs as a background job the UI polls, split into
month x symbol-chunk requests run in parallel. A month is recorded in
synced_months only once all of its chunks are stored.
"""
import calendar
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from contextlib import closing
from datetime import date, datetime, timedelta

import pandas as pd

from scanner.alpaca_market import ET, fetch_daily_bars, fetch_splits, refresh_assets
from scanner.market_db import connect

SYMBOLS_PER_REQUEST = 1000
WORKERS = 6

_lock = threading.Lock()
_job = {"running": False, "done": 0, "total": 0, "start": None, "end": None, "error": None, "finished_at": None}


def _yesterday() -> str:
    return (datetime.now(ET).date() - timedelta(days=1)).isoformat()


def lookback_start(start_day: str, trading_days: int) -> str:
    """Calendar date far enough back to cover `trading_days` sessions before start_day."""
    calendar_days = int(trading_days * 1.5) + 10
    return (date.fromisoformat(start_day) - timedelta(days=calendar_days)).isoformat()


def _months(start_day: str, end_day: str) -> list[tuple[str, str, str]]:
    """(YYYY-MM, first day, last day) for each month overlapping [start_day, end_day]."""
    out = []
    d = date.fromisoformat(start_day).replace(day=1)
    end = date.fromisoformat(end_day)
    while d <= end:
        last = d.replace(day=calendar.monthrange(d.year, d.month)[1])
        out.append((d.strftime("%Y-%m"), max(d, date.fromisoformat(start_day)).isoformat(), min(last, end).isoformat()))
        d = last + timedelta(days=1)
    return out


def missing_months(start_day: str, end_day: str) -> list[tuple[str, str, str]]:
    """Months in the range that aren't downloaded through the needed day."""
    end_day = min(end_day, _yesterday())
    if start_day > end_day:
        return []
    with closing(connect()) as conn:
        synced = {r["month"]: r["through_day"] for r in conn.execute("SELECT month, through_day FROM synced_months")}
    out = []
    for month, _, last in _months(start_day, end_day):
        if synced.get(month, "") < last:
            # Always re-download whole months so partial months don't leave holes
            out.append((month, f"{month}-01", last))
    return out


def coverage() -> dict:
    with closing(connect()) as conn:
        rows = conn.execute("SELECT month, through_day FROM synced_months ORDER BY month").fetchall()
    return {"months": [{"month": r["month"], "through_day": r["through_day"]} for r in rows]}


def status() -> dict:
    with _lock:
        return {**_job, **coverage()}


def start_sync(start_day: str, end_day: str) -> bool:
    """Start downloading [start_day, end_day]; returns False if a sync is already running."""
    with _lock:
        if _job["running"]:
            return False
        _job.update(running=True, done=0, total=0, start=start_day, end=end_day, error=None, finished_at=None)
    threading.Thread(target=_run_sync, args=(start_day, end_day), daemon=True).start()
    return True


def _run_sync(start_day: str, end_day: str) -> None:
    try:
        with closing(connect()) as conn:
            refresh_assets(conn)
            symbols = [r["symbol"] for r in conn.execute("SELECT symbol FROM assets ORDER BY symbol")]

            months = missing_months(start_day, end_day)
            chunks = [symbols[i:i + SYMBOLS_PER_REQUEST] for i in range(0, len(symbols), SYMBOLS_PER_REQUEST)]
            with _lock:
                _job["total"] = len(months) * len(chunks) + 1

            conn.executemany(
                "INSERT OR REPLACE INTO splits (symbol, ex_date, ratio) VALUES (?, ?, ?)",
                fetch_splits(start_day, min(end_day, _yesterday())),
            )
            conn.commit()
            with _lock:
                _job["done"] += 1

            remaining = {month: len(chunks) for month, _, _ in months}
            with ThreadPoolExecutor(max_workers=WORKERS) as pool:
                futures = {
                    pool.submit(fetch_daily_bars, chunk, first, last): (month, last)
                    for month, first, last in months
                    for chunk in chunks
                }
                for fut in as_completed(futures):
                    month, last = futures[fut]
                    conn.executemany(
                        "INSERT OR REPLACE INTO daily_bars (symbol, day, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        fut.result(),
                    )
                    remaining[month] -= 1
                    if remaining[month] == 0:
                        conn.execute(
                            "INSERT OR REPLACE INTO synced_months (month, through_day) VALUES (?, ?)", (month, last)
                        )
                    conn.commit()
                    with _lock:
                        _job["done"] += 1
    except Exception as e:  # surfaced to the UI through status()
        with _lock:
            _job["error"] = str(e)
    finally:
        with _lock:
            _job["running"] = False
            _job["finished_at"] = time.time()


def daily_metrics(start_day: str, end_day: str, avg_days: int) -> pd.DataFrame:
    """
    Every stock's daily bars in [start_day, end_day] plus, in that day's own share
    basis: prev_close and avg_volume (mean of the previous `avg_days` sessions).
    Bars are raw, so splits are applied here: without that, a 1:10 reverse split
    would look like a +900% day with a 90% drop in volume.
    """
    with closing(connect()) as conn:
        df = pd.read_sql_query(
            "SELECT symbol, day, open, high, low, close, volume FROM daily_bars WHERE day BETWEEN ? AND ?",
            conn,
            params=(lookback_start(start_day, avg_days), end_day),
        )
        splits = pd.read_sql_query(
            "SELECT symbol, ex_date, ratio FROM splits WHERE ex_date BETWEEN ? AND ?",
            conn,
            params=(lookback_start(start_day, avg_days), end_day),
        )
    if df.empty:
        return df

    df.sort_values(["symbol", "day"], inplace=True, ignore_index=True)

    # factor = product of split ratios on or before each day, so close * factor
    # and volume / factor are comparable across a split
    factor = pd.Series(1.0, index=df.index)
    rows_by_symbol = df.groupby("symbol").indices
    days = df["day"].to_numpy()
    for s in splits.itertuples():
        idx = rows_by_symbol.get(s.symbol)
        if idx is not None:
            after = idx[days[idx] >= s.ex_date]
            factor.iloc[after] *= s.ratio

    adj_close = df["close"] * factor
    adj_volume = df["volume"] / factor
    by_symbol = df["symbol"]
    df["prev_day"] = df.groupby("symbol")["day"].shift(1)
    df["prev_close"] = adj_close.groupby(by_symbol).shift(1) / factor
    prev_volume = adj_volume.groupby(by_symbol).shift(1)
    avg = prev_volume.groupby(by_symbol).rolling(avg_days, min_periods=min(avg_days, 5)).mean()
    df["avg_volume"] = avg.reset_index(level=0, drop=True).sort_index() * factor

    return df[(df["day"] >= start_day) & (df["day"] <= end_day)].reset_index(drop=True)


def trading_days(start_day: str, end_day: str) -> list[str]:
    with closing(connect()) as conn:
        rows = conn.execute(
            "SELECT DISTINCT day FROM daily_bars WHERE day BETWEEN ? AND ? AND symbol IN ('SPY', 'AAPL') ORDER BY day",
            (start_day, end_day),
        ).fetchall()
    return [r["day"] for r in rows]
