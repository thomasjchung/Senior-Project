from contextlib import closing
from datetime import datetime, timedelta

from scanner.alpaca_market import ET, fetch_iex_daily_volumes, fetch_iex_snapshots, fetch_top_gainers, refresh_assets
from scanner.criteria import ScanCriteria
from scanner.floats import get_floats
from scanner.history import daily_metrics, lookback_start
from scanner.market_db import connect


def _asset_names(symbols: list[str]) -> dict[str, str]:
    with closing(connect()) as conn:
        refresh_assets(conn)
        rows = conn.execute(
            f"SELECT symbol, name FROM assets WHERE symbol IN ({','.join('?' * len(symbols))})", symbols
        ).fetchall()
    return {r["symbol"]: r["name"] for r in rows}


MAX_ROWS = 500
# Float lookups are ~0.1s each, so loose scans only look them up when they filter
FLOAT_DISPLAY_LIMIT = 100
MAX_FLOAT_LOOKUPS = 1000


def _with_floats(rows: list[dict], criteria: ScanCriteria) -> list[dict]:
    """Attach float to each row and drop rows failing the float criterion."""
    if not criteria.needs_float() and len(rows) > FLOAT_DISPLAY_LIMIT:
        return rows
    if len(rows) > MAX_FLOAT_LOOKUPS:
        raise ValueError(
            f"{len(rows)} stocks match before the float filter; tighten the other criteria "
            f"to under {MAX_FLOAT_LOOKUPS} so their floats can be looked up"
        )
    floats = get_floats([r["symbol"] for r in rows])
    out = []
    for r in rows:
        r["float_shares"] = floats.get(r["symbol"])
        if criteria.passes_float(r["float_shares"]):
            out.append(r)
    return out


def live_scan(criteria: ScanCriteria) -> dict:
    """
    Today's matches among Alpaca's top 50 gainers. Volume is IEX-only (a few % of
    the market) on the free data plan, so relative volume compares today's IEX
    volume with IEX's own average.
    """
    gainers, last_updated = fetch_top_gainers()
    names = _asset_names([g.symbol for g in gainers]) if gainers else {}
    gainers = [g for g in gainers if g.symbol in names]  # drops OTC, warrants, units

    rows = []
    if gainers:
        symbols = [g.symbol for g in gainers]
        snapshots = fetch_iex_snapshots(symbols)
        today = datetime.now(ET).date()
        history = fetch_iex_daily_volumes(
            symbols,
            lookback_start(today.isoformat(), criteria.avg_volume_days),
            (today - timedelta(days=1)).isoformat(),
        )
        for g in gainers:
            snap = snapshots.get(g.symbol)
            volume = float(snap.daily_bar.volume) if snap and snap.daily_bar else 0.0
            past = history.get(g.symbol, [])[-criteria.avg_volume_days:]
            avg_volume = sum(past) / len(past) if past else None
            rvol = volume / avg_volume if avg_volume else None
            change_pct = float(g.percent_change)
            if criteria.passes(float(g.price), change_pct, volume, rvol):
                rows.append({
                    "symbol": g.symbol,
                    "name": names[g.symbol],
                    "price": float(g.price),
                    "change_pct": round(change_pct, 2),
                    "volume": volume,
                    "avg_volume": avg_volume,
                    "rvol": round(rvol, 2) if rvol is not None else None,
                })

    return {
        "rows": _with_floats(rows, criteria),
        "as_of": last_updated.isoformat() if last_updated else None,
        "candidates": len(gainers),
        "volume_feed": "iex",
    }


def historical_scan(criteria: ScanCriteria, day: str) -> dict:
    """Stocks that met the criteria at the close of `day` (full-market SIP data)."""
    df = daily_metrics(day, day, criteria.avg_volume_days)
    rows = []
    for r in df.itertuples():
        if not r.prev_close:
            continue
        change_pct = (r.close / r.prev_close - 1) * 100
        rvol = r.volume / r.avg_volume if r.avg_volume and r.avg_volume == r.avg_volume else None
        if criteria.passes(r.close, change_pct, r.volume, rvol):
            rows.append({
                "symbol": r.symbol,
                "price": r.close,
                "change_pct": round(change_pct, 2),
                "high_change_pct": round((r.high / r.prev_close - 1) * 100, 2),
                "volume": r.volume,
                "avg_volume": r.avg_volume,
                "rvol": round(rvol, 2) if rvol is not None else None,
            })

    rows.sort(key=lambda r: r["change_pct"], reverse=True)
    rows = _with_floats(rows, criteria)
    truncated = len(rows) > MAX_ROWS
    rows = rows[:MAX_ROWS]
    if rows:
        names = _asset_names([r["symbol"] for r in rows])
        for r in rows:
            r["name"] = names.get(r["symbol"], "")
    return {"rows": rows, "day": day, "truncated": truncated, "volume_feed": "sip"}
