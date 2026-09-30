import json
from flask import Blueprint, request, jsonify
from database import get_db
from strategies.validator import validate_strategy

bp = Blueprint("strategies", __name__, url_prefix="/api/strategies")


@bp.get("")
def list_strategies():
    db = get_db()
    rows = db.execute(
        "SELECT id, name, config, created_at, updated_at FROM strategies ORDER BY updated_at DESC"
    ).fetchall()
    return jsonify({
        "strategies": [
            {
                "id": r["id"],
                "name": r["name"],
                "config": json.loads(r["config"]),
                "created_at": r["created_at"],
                "updated_at": r["updated_at"],
            }
            for r in rows
        ]
    })


@bp.post("")
def create_strategy():
    body = request.get_json(force=True)
    name = body.get("name", "").strip()
    config = body.get("config", {})

    if not name:
        return jsonify({"error": "name is required"}), 400

    config["name"] = name
    errors = validate_strategy(config)
    if errors:
        return jsonify({"error": "validation failed", "detail": errors}), 400

    db = get_db()
    try:
        cursor = db.execute(
            "INSERT INTO strategies (name, config) VALUES (?, ?)",
            (name, json.dumps(config)),
        )
        db.commit()
        return jsonify({"id": cursor.lastrowid, "name": name}), 201
    except Exception as e:
        if "UNIQUE" in str(e):
            return jsonify({"error": "name already exists"}), 409
        return jsonify({"error": str(e)}), 500


@bp.get("/<int:strategy_id>")
def get_strategy(strategy_id):
    db = get_db()
    row = db.execute(
        "SELECT id, name, config, created_at, updated_at FROM strategies WHERE id = ?",
        (strategy_id,),
    ).fetchone()
    if row is None:
        return jsonify({"error": "not found"}), 404
    return jsonify({
        "id": row["id"],
        "name": row["name"],
        "config": json.loads(row["config"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    })


@bp.put("/<int:strategy_id>")
def update_strategy(strategy_id):
    body = request.get_json(force=True)
    name = body.get("name", "").strip()
    config = body.get("config", {})

    if not name:
        return jsonify({"error": "name is required"}), 400

    config["name"] = name
    errors = validate_strategy(config)
    if errors:
        return jsonify({"error": "validation failed", "detail": errors}), 400

    db = get_db()
    result = db.execute(
        """
        UPDATE strategies
        SET name = ?, config = ?, updated_at = strftime('%s','now')
        WHERE id = ?
        """,
        (name, json.dumps(config), strategy_id),
    )
    db.commit()
    if result.rowcount == 0:
        return jsonify({"error": "not found"}), 404

    return jsonify({"id": strategy_id, "updated_at": "now"})


@bp.delete("/<int:strategy_id>")
def delete_strategy(strategy_id):
    db = get_db()
    result = db.execute("DELETE FROM strategies WHERE id = ?", (strategy_id,))
    db.commit()
    if result.rowcount == 0:
        return jsonify({"error": "not found"}), 404
    return "", 204
