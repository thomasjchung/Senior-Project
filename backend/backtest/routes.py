import json
from flask import Blueprint, request, jsonify
from database import get_db
from data.cache import to_ts
from data.loader import load_bars, BarFetchError
from strategies.models import StrategyConfig
from strategies.validator import validate_strategy
from backtest.engine import run_backtest
from backtest.universe import MarketHistoryMissing, run_universe_backtest
from scanner.criteria import ScanCriteria

bp = Blueprint("backtest", __name__, url_prefix="/api/backtest")


@bp.post("/run")
def run():
    body = request.get_json(force=True)

    symbol = body.get("symbol", "").upper()
    timeframe = body.get("timeframe", "1Day")
    start = body.get("start", "")
    end = body.get("end", "")
    initial_capital = float(body.get("initial_capital", 10000))

    if not start or not end:
        return jsonify({"error": "start and end are required"}), 400

    # Resolve strategy config
    strategy_config = None
    # An inline config wins, so unsaved edits to a saved strategy are what gets tested
    if "config" in body:
        strategy_config = body["config"]
    elif "strategy_id" in body:
        db = get_db()
        row = db.execute("SELECT config FROM strategies WHERE id = ?", (body["strategy_id"],)).fetchone()
        if row is None:
            return jsonify({"error": "strategy not found"}), 404
        strategy_config = json.loads(row["config"])
    else:
        return jsonify({"error": "strategy_id or config is required"}), 400

    errors = validate_strategy(strategy_config)
    if errors:
        return jsonify({"error": "invalid strategy", "detail": errors}), 400

    strategy = StrategyConfig.from_dict(strategy_config)
    if strategy.universe.get("type") == "scanner":
        try:
            result = run_universe_backtest(
                strategy,
                ScanCriteria.from_dict(strategy.universe.get("criteria")),
                bool(strategy.universe.get("regular_hours_only", True)),
                timeframe, start, end, initial_capital,
            )
        except MarketHistoryMissing as e:
            return jsonify({"error": str(e), "needs_history": {"start": e.start, "end": e.end}}), 409
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        return jsonify(_save_run(body, strategy_config, None, timeframe, start, end, initial_capital, result))

    if not symbol:
        return jsonify({"error": "symbol is required"}), 400

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
        result = run_backtest(strategy, bars, initial_capital, timeframe)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify(_save_run(body, strategy_config, symbol, timeframe, start, end, initial_capital, result))


def _save_run(body, config, symbol, timeframe, start, end, initial_capital, result) -> dict:
    """Store a finished run in the history; returns the result with its run_id."""
    db = get_db()
    cur = db.execute(
        """
        INSERT INTO backtest_runs (name, strategy_id, symbol, timeframe, start_date, end_date,
                                   initial_capital, config_json, metrics_json, result_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (config.get("name") or "Untitled", body.get("strategy_id"), symbol, timeframe, start, end,
         initial_capital, json.dumps(config), json.dumps(result["metrics"]), json.dumps(result)),
    )
    db.commit()
    return {**result, "run_id": cur.lastrowid}


def _run_meta(row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "strategy_id": row["strategy_id"],
        "symbol": row["symbol"],
        "timeframe": row["timeframe"],
        "start": row["start_date"],
        "end": row["end_date"],
        "initial_capital": row["initial_capital"],
        "notes": row["notes"],
        "ran_at": row["ran_at"],
        "metrics": json.loads(row["metrics_json"]),
    }


@bp.get("/runs")
def list_runs():
    rows = get_db().execute(
        """
        SELECT id, name, strategy_id, symbol, timeframe, start_date, end_date, initial_capital,
               notes, ran_at, metrics_json, json_extract(config_json, '$.universe.type') AS universe_type
        FROM backtest_runs ORDER BY id DESC
        """
    ).fetchall()
    return jsonify({"runs": [{**_run_meta(r), "universe_type": r["universe_type"] or "symbol"} for r in rows]})


@bp.get("/runs/<int:run_id>")
def get_run(run_id: int):
    row = get_db().execute("SELECT * FROM backtest_runs WHERE id = ?", (run_id,)).fetchone()
    if row is None:
        return jsonify({"error": "run not found"}), 404
    config = json.loads(row["config_json"])
    return jsonify({
        **_run_meta(row),
        "universe_type": (config.get("universe") or {}).get("type", "symbol"),
        "config": config,
        "result": {**json.loads(row["result_json"]), "run_id": row["id"]},
    })


@bp.patch("/runs/<int:run_id>")
def update_run(run_id: int):
    body = request.get_json(force=True) or {}
    db = get_db()
    if "notes" in body:
        db.execute("UPDATE backtest_runs SET notes = ? WHERE id = ?", (str(body["notes"])[:5000], run_id))
    if body.get("name"):
        db.execute("UPDATE backtest_runs SET name = ? WHERE id = ?", (str(body["name"])[:200], run_id))
    db.commit()
    return jsonify({"ok": True})


@bp.delete("/runs/<int:run_id>")
def delete_run(run_id: int):
    db = get_db()
    db.execute("DELETE FROM backtest_runs WHERE id = ?", (run_id,))
    db.commit()
    return jsonify({"ok": True})
