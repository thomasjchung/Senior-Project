from indicators.definitions import VALID_INDICATORS, VALID_OPERATORS
from scanner.criteria import validate_criteria


def validate_strategy(config: dict) -> list[str]:
    """Returns a list of error strings; empty list means valid."""
    errors = []

    if not config.get("name"):
        errors.append("name is required")

    direction = config.get("direction", "long")
    if direction not in ("long", "short", "both"):
        errors.append("direction must be 'long', 'short', or 'both'")

    logic = config.get("logic", "AND")
    if logic not in ("AND", "OR"):
        errors.append("logic must be 'AND' or 'OR'")

    size = config.get("position_size_pct")
    if size is not None and (float(size) <= 0 or float(size) > 100):
        errors.append("position_size_pct must be between 0 and 100")

    for field_name in ("stop_loss_pct", "take_profit_pct"):
        val = config.get(field_name)
        if val is not None and float(val) <= 0:
            errors.append(f"{field_name} must be positive")

    universe = config.get("universe") or {"type": "symbol"}
    if universe.get("type") not in ("symbol", "scanner"):
        errors.append("universe.type must be 'symbol' or 'scanner'")
    elif universe["type"] == "scanner":
        errors.extend(f"universe.{e}" for e in validate_criteria(universe.get("criteria")))

    entry = config.get("entry_conditions", [])
    if not entry:
        errors.append("at least one entry_condition is required")

    for i, cond in enumerate(entry + config.get("exit_conditions", [])):
        prefix = f"condition[{i}]"
        if cond.get("indicator") not in VALID_INDICATORS:
            errors.append(f"{prefix} unknown indicator '{cond.get('indicator')}'")
        if cond.get("operator") not in VALID_OPERATORS:
            errors.append(f"{prefix} unknown operator '{cond.get('operator')}'")
        op = cond.get("operator", "")
        price_ops = {
            "price_above_indicator", "price_below_indicator",
            "price_crosses_above_indicator", "price_crosses_below_indicator",
        }
        if op in price_ops and cond.get("value") is not None:
            errors.append(f"{prefix} value must be null for operator '{op}'")
        if op not in price_ops and cond.get("value") is None:
            errors.append(f"{prefix} value is required for operator '{op}'")

    return errors
