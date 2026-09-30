import pandas as pd
from indicators.definitions import make_col_name


def evaluate_conditions(conditions: list, logic: str, row: pd.Series, prev_row: pd.Series) -> bool:
    """
    Evaluate a list of conditions against a bar row.
    Returns True if conditions pass according to logic (AND/OR).
    """
    if not conditions:
        return False

    results = []
    for cond in conditions:
        col = make_col_name(cond.indicator, cond.params)
        curr_val = row.get(col)
        prev_val = prev_row.get(col) if prev_row is not None else None
        price = row.get("close")
        prev_price = prev_row.get("close") if prev_row is not None else None
        threshold = cond.value

        if pd.isna(curr_val):
            results.append(False)
            continue

        op = cond.operator
        try:
            if op == ">":
                result = float(curr_val) > float(threshold)
            elif op == ">=":
                result = float(curr_val) >= float(threshold)
            elif op == "<":
                result = float(curr_val) < float(threshold)
            elif op == "<=":
                result = float(curr_val) <= float(threshold)
            elif op == "crosses_above":
                result = (
                    prev_val is not None and not pd.isna(prev_val)
                    and float(prev_val) <= float(threshold)
                    and float(curr_val) > float(threshold)
                )
            elif op == "crosses_below":
                result = (
                    prev_val is not None and not pd.isna(prev_val)
                    and float(prev_val) >= float(threshold)
                    and float(curr_val) < float(threshold)
                )
            elif op == "price_above_indicator":
                result = float(price) > float(curr_val)
            elif op == "price_below_indicator":
                result = float(price) < float(curr_val)
            elif op == "price_crosses_above_indicator":
                result = (
                    prev_price is not None and prev_val is not None
                    and not pd.isna(prev_val)
                    and float(prev_price) <= float(prev_val)
                    and float(price) > float(curr_val)
                )
            elif op == "price_crosses_below_indicator":
                result = (
                    prev_price is not None and prev_val is not None
                    and not pd.isna(prev_val)
                    and float(prev_price) >= float(prev_val)
                    and float(price) < float(curr_val)
                )
            else:
                result = False
        except (TypeError, ValueError):
            result = False

        results.append(result)

    return all(results) if logic == "AND" else any(results)
