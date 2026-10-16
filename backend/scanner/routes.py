from datetime import date

from flask import Blueprint, jsonify, request

from scanner import history
from scanner.criteria import ScanCriteria, validate_criteria
from scanner.history import lookback_start, missing_months
from scanner.scan import historical_scan, live_scan

bp = Blueprint("scanner", __name__, url_prefix="/api/scanner")


def _criteria_from_body(body: dict):
    raw = body.get("criteria") or {}
    errors = validate_criteria(raw)
    if errors:
        return None, (jsonify({"error": "invalid criteria", "detail": errors}), 400)
    return ScanCriteria.from_dict(raw), None


@bp.post("/live")
def live():
    criteria, err = _criteria_from_body(request.get_json(force=True) or {})
    if err:
        return err
    try:
        return jsonify(live_scan(criteria))
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": "live scan failed", "detail": str(e)}), 502


@bp.post("/historical")
def historical():
    body = request.get_json(force=True) or {}
    criteria, err = _criteria_from_body(body)
    if err:
        return err
    day = body.get("date", "")
    try:
        date.fromisoformat(day)
    except ValueError:
        return jsonify({"error": "date must be YYYY-MM-DD"}), 400

    needed_from = lookback_start(day, criteria.avg_volume_days)
    if missing_months(needed_from, day):
        return jsonify({
            "error": f"Market history for {needed_from} to {day} hasn't been downloaded yet",
            "needs_history": {"start": needed_from, "end": day},
        }), 409
    try:
        return jsonify(historical_scan(criteria, day))
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@bp.get("/history/status")
def history_status():
    return jsonify(history.status())


@bp.post("/history/sync")
def history_sync():
    body = request.get_json(force=True) or {}
    start, end = body.get("start", ""), body.get("end", "")
    try:
        if date.fromisoformat(start) > date.fromisoformat(end):
            return jsonify({"error": "start must be before end"}), 400
    except ValueError:
        return jsonify({"error": "start and end must be YYYY-MM-DD"}), 400
    if not history.start_sync(start, end):
        return jsonify({"error": "a download is already running"}), 409
    return jsonify(history.status()), 202
