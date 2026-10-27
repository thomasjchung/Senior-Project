from functools import reduce

import pandas as pd
from indicators.definitions import make_col_name


def conditions_mask(df: pd.DataFrame, conditions: list, logic: str) -> pd.Series:
    """
    Evaluate conditions on every bar at once.
    True where the conditions pass according to logic (AND/OR); False with no conditions.
    """
    if not conditions:
        return pd.Series(False, index=df.index)

    price = df["close"].astype(float)
    prev_price = price.shift(1)
    results = []
    for cond in conditions:
        curr = df[make_col_name(cond.indicator, cond.params)].astype(float)
        prev = curr.shift(1)
        threshold = float(cond.value) if cond.value is not None else float("nan")

        op = cond.operator
        if op == ">":
            result = curr > threshold
        elif op == ">=":
            result = curr >= threshold
        elif op == "<":
            result = curr < threshold
        elif op == "<=":
            result = curr <= threshold
        elif op == "crosses_above":
            result = (prev <= threshold) & (curr > threshold)
        elif op == "crosses_below":
            result = (prev >= threshold) & (curr < threshold)
        elif op == "price_above_indicator":
            result = price > curr
        elif op == "price_below_indicator":
            result = price < curr
        elif op == "price_crosses_above_indicator":
            result = (prev_price <= prev) & (price > curr)
        elif op == "price_crosses_below_indicator":
            result = (prev_price >= prev) & (price < curr)
        else:
            result = pd.Series(False, index=df.index)

        # Comparisons with NaN (indicator warm-up) are already False
        results.append(result & curr.notna())

    return reduce(lambda a, b: a & b, results) if logic == "AND" else reduce(lambda a, b: a | b, results)
