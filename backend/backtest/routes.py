import json
from flask import Blueprint, request, jsonify
from database import get_db
from data.cache import to_ts
from data.loader import load_bars, BarFetchError
from strategies.models import StrategyConfig
from strategies.validator import validate_strategy
from backtest.engine import run_backtest

bp = Blueprint("backtest", __name__, url_prefix="/api/backtest")


@bp.post("/run")
def run():
    body = request.get_json(force=True)

    symbol = body.get("symbol", "").upper()
    timeframe = body.get("timeframe", "1Day")
    start = body.get("start", "")
    end = body.get("end", "")
    initial_capital = float(body.get("initial_capital", 10000))

    if not symbol or not start or not end:
        return jsonify({"error": "symbol, start, and end are required"}), 400

    # Resolve strategy config
    strategy_config = None
    if "strategy_id" in body:
        db = get_db()
        row = db.execute("SELECT config FROM strategies WHERE id = ?", (body["strategy_id"],)).fetchone()
        if row is None:
            return jsonify({"error": "strategy not found"}), 404
        strategy_config = json.loads(row["config"])
    elif "config" in body:
        strategy_config = body["config"]
    else:
        return jsonify({"error": "strategy_id or config is required"}), 400

    errors = validate_strategy(strategy_config)
    if errors:
        return jsonify({"error": "invalid strategy", "detail": errors}), 400

    # Fetch bars (from cache, filling any gaps from Alpaca)
    try:
        start_ts = to_ts(start)
        end_ts = to_ts(end)
    except ValueError:
        return jsonify({"error": "start and end must be ISO-8601 dates"}), 400
    try:
        bars, _ = load_bars(symbol, timeframe, start_ts, end_ts)
    except BarFetchError as e:
        return jsonify({"error": str(e), "detail": e.detail}), 502

    if not bars:
        return jsonify({"error": "no data found for the given symbol and date range"}), 404

    try:
        strategy = StrategyConfig.from_dict(strategy_config)
        result = run_backtest(strategy, bars, initial_capital, timeframe)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    # Optionally cache the result
    if "strategy_id" in body:
        db = get_db()
        db.execute(
            """
            INSERT INTO backtest_results (strategy_id, symbol, timeframe, start_ts, end_ts, result_json)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (body["strategy_id"], symbol, timeframe, start_ts, end_ts, json.dumps(result)),
        )
        db.commit()

    return jsonify(result)
