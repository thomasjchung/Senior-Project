from flask import Blueprint, request, jsonify
from data.cache import to_ts, get_cache_status
from data.alpaca_client import search_symbols
from data.loader import load_bars, BarFetchError

bp = Blueprint("data", __name__, url_prefix="/api/data")

VALID_TIMEFRAMES = {"1Min", "5Min", "15Min", "1Hour", "1Day"}


@bp.get("/bars")
def get_bars():
    symbol = request.args.get("symbol", "").upper()
    timeframe = request.args.get("timeframe", "1Day")
    start = request.args.get("start", "")
    end = request.args.get("end", "")

    if not symbol:
        return jsonify({"error": "symbol is required"}), 400
    if timeframe not in VALID_TIMEFRAMES:
        return jsonify({"error": f"invalid timeframe, must be one of {sorted(VALID_TIMEFRAMES)}"}), 400
    if not start or not end:
        return jsonify({"error": "start and end are required (ISO-8601 date)"}), 400

    try:
        start_ts = to_ts(start)
        end_ts = to_ts(end)
    except ValueError:
        return jsonify({"error": "start and end must be ISO-8601 dates"}), 400
    if start_ts >= end_ts:
        return jsonify({"error": "start must be before end"}), 400

    try:
        bars, cached = load_bars(symbol, timeframe, start_ts, end_ts)
    except BarFetchError as e:
        return jsonify({"error": str(e), "detail": e.detail}), 502

    return jsonify({"symbol": symbol, "timeframe": timeframe, "bars": bars, "count": len(bars), "cached": cached})


@bp.get("/cache/status")
def cache_status():
    symbol = request.args.get("symbol", "").upper()
    timeframe = request.args.get("timeframe", "1Day")

    if not symbol:
        return jsonify({"error": "symbol is required"}), 400

    status = get_cache_status(symbol, timeframe)
    if status is None:
        return jsonify({"symbol": symbol, "timeframe": timeframe, "bar_count": 0})
    return jsonify(status)


@bp.get("/symbols/search")
def symbol_search():
    q = request.args.get("q", "")
    if len(q) < 1:
        return jsonify({"results": []})
    return jsonify({"results": search_symbols(q)})
