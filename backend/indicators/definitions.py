"""
Central registry of indicator column names and parameter schemas.
Both calculator.py and evaluator.py import make_col_name() from here
to guarantee consistent naming.
"""

INDICATOR_PARAMS = {
    "RSI":         [{"name": "length", "type": "int", "default": 14}],
    "SMA":         [{"name": "length", "type": "int", "default": 20}],
    "EMA":         [{"name": "length", "type": "int", "default": 20}],
    "VWAP":        [],
    "BB_UPPER":    [{"name": "length", "type": "int", "default": 20}, {"name": "std", "type": "float", "default": 2.0}],
    "BB_MIDDLE":   [{"name": "length", "type": "int", "default": 20}, {"name": "std", "type": "float", "default": 2.0}],
    "BB_LOWER":    [{"name": "length", "type": "int", "default": 20}, {"name": "std", "type": "float", "default": 2.0}],
    "MACD_LINE":   [{"name": "fast", "type": "int", "default": 12}, {"name": "slow", "type": "int", "default": 26}, {"name": "signal", "type": "int", "default": 9}],
    "MACD_SIGNAL": [{"name": "fast", "type": "int", "default": 12}, {"name": "slow", "type": "int", "default": 26}, {"name": "signal", "type": "int", "default": 9}],
    "MACD_HIST":   [{"name": "fast", "type": "int", "default": 12}, {"name": "slow", "type": "int", "default": 26}, {"name": "signal", "type": "int", "default": 9}],
    "STOCH_K":     [{"name": "k", "type": "int", "default": 14}, {"name": "d", "type": "int", "default": 3}, {"name": "smooth", "type": "int", "default": 3}],
    "STOCH_D":     [{"name": "k", "type": "int", "default": 14}, {"name": "d", "type": "int", "default": 3}, {"name": "smooth", "type": "int", "default": 3}],
    "VOLUME":      [],
    "VOLUME_SMA":  [{"name": "length", "type": "int", "default": 20}],
    "PRICE":       [],
}

VALID_OPERATORS = {
    ">", ">=", "<", "<=",
    "crosses_above", "crosses_below",
    "price_above_indicator", "price_below_indicator",
    "price_crosses_above_indicator", "price_crosses_below_indicator",
}

VALID_INDICATORS = set(INDICATOR_PARAMS.keys())


def make_col_name(indicator: str, params: dict) -> str:
    """
    Canonical column name for a given indicator + params combo.
    Examples:
      make_col_name("RSI", {"length": 14})  -> "RSI_14"
      make_col_name("BB_UPPER", {"length": 20, "std": 2.0}) -> "BB_UPPER_20_2.0"
      make_col_name("VWAP", {}) -> "VWAP"
      make_col_name("PRICE", {}) -> "close"
      make_col_name("VOLUME", {}) -> "volume"
    """
    if indicator == "PRICE":
        return "close"
    if indicator == "VOLUME":
        return "volume"
    if indicator == "VWAP":
        return "VWAP"

    param_defs = INDICATOR_PARAMS.get(indicator, [])
    if not param_defs:
        return indicator

    parts = [indicator]
    for p in param_defs:
        val = params.get(p["name"], p["default"])
        parts.append(str(val))

    return "_".join(parts)


def get_warmup_bars(indicator: str, params: dict) -> int:
    """Return the number of bars needed before the indicator produces a valid value."""
    warmup_map = {
        "RSI":         lambda p: p.get("length", 14) + 1,
        "SMA":         lambda p: p.get("length", 20),
        "EMA":         lambda p: p.get("length", 20) * 3,
        "VWAP":        lambda p: 1,
        "BB_UPPER":    lambda p: p.get("length", 20),
        "BB_MIDDLE":   lambda p: p.get("length", 20),
        "BB_LOWER":    lambda p: p.get("length", 20),
        "MACD_LINE":   lambda p: p.get("slow", 26) * 3,
        "MACD_SIGNAL": lambda p: p.get("slow", 26) * 3 + p.get("signal", 9),
        "MACD_HIST":   lambda p: p.get("slow", 26) * 3 + p.get("signal", 9),
        "STOCH_K":     lambda p: p.get("k", 14) + p.get("smooth", 3),
        "STOCH_D":     lambda p: p.get("k", 14) + p.get("smooth", 3) + p.get("d", 3),
        "VOLUME":      lambda p: 0,
        "VOLUME_SMA":  lambda p: p.get("length", 20),
        "PRICE":       lambda p: 0,
    }
    fn = warmup_map.get(indicator)
    return fn(params) if fn else 0
