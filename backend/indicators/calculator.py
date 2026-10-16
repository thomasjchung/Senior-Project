import pandas as pd
import numpy as np
from indicators.definitions import make_col_name


def compute_indicators(df: pd.DataFrame, conditions: list[dict]) -> pd.DataFrame:
    """
    Compute all indicator columns needed by the given conditions.
    Returns df with new columns added in-place.
    conditions: list of {indicator, params, ...}
    """
    computed = set()

    for cond in conditions:
        indicator = cond["indicator"]
        params = cond.get("params", {})
        col = make_col_name(indicator, params)

        if col in computed or col in ("close", "volume"):
            continue

        _add_indicator(df, indicator, params, col)
        computed.add(col)

    return df


def _add_indicator(df: pd.DataFrame, indicator: str, params: dict, col: str) -> None:
    if indicator == "SMA":
        length = int(params.get("length", 20))
        df[col] = df["close"].rolling(length).mean()

    elif indicator == "EMA":
        length = int(params.get("length", 20))
        df[col] = df["close"].ewm(span=length, adjust=False).mean()

    elif indicator == "RSI":
        length = int(params.get("length", 14))
        delta = df["close"].diff()
        gain = delta.clip(lower=0).rolling(length).mean()
        loss = (-delta.clip(upper=0)).rolling(length).mean()
        rs = gain / loss
        df[col] = 100 - (100 / (1 + rs))

    elif indicator in ("BB_UPPER", "BB_MIDDLE", "BB_LOWER"):
        length = int(params.get("length", 20))
        mult = float(params.get("std", 2.0))
        sma = df["close"].rolling(length).mean()
        std = df["close"].rolling(length).std(ddof=0)
        bb_upper_col = make_col_name("BB_UPPER", params)
        bb_middle_col = make_col_name("BB_MIDDLE", params)
        bb_lower_col = make_col_name("BB_LOWER", params)
        df[bb_upper_col] = sma + mult * std
        df[bb_middle_col] = sma
        df[bb_lower_col] = sma - mult * std

    elif indicator in ("MACD_LINE", "MACD_SIGNAL", "MACD_HIST"):
        fast = int(params.get("fast", 12))
        slow = int(params.get("slow", 26))
        signal = int(params.get("signal", 9))
        macd_line_col = make_col_name("MACD_LINE", params)
        macd_sig_col = make_col_name("MACD_SIGNAL", params)
        macd_hist_col = make_col_name("MACD_HIST", params)
        ema_fast = df["close"].ewm(span=fast, adjust=False).mean()
        ema_slow = df["close"].ewm(span=slow, adjust=False).mean()
        macd_line = ema_fast - ema_slow
        sig_line = macd_line.ewm(span=signal, adjust=False).mean()
        df[macd_line_col] = macd_line
        df[macd_sig_col] = sig_line
        df[macd_hist_col] = macd_line - sig_line

    elif indicator in ("STOCH_K", "STOCH_D"):
        k = int(params.get("k", 14))
        d = int(params.get("d", 3))
        smooth = int(params.get("smooth", 3))
        stoch_k_col = make_col_name("STOCH_K", params)
        stoch_d_col = make_col_name("STOCH_D", params)
        low_min = df["low"].rolling(k).min()
        high_max = df["high"].rolling(k).max()
        raw_k = 100 * (df["close"] - low_min) / (high_max - low_min)
        smooth_k = raw_k.rolling(smooth).mean()
        d_line = smooth_k.rolling(d).mean()
        df[stoch_k_col] = smooth_k
        df[stoch_d_col] = d_line

    elif indicator == "VWAP":
        # Cumulative VWAP that resets each (New York) trading day
        typical_price = (df["high"] + df["low"] + df["close"]) / 3
        day = pd.to_datetime(df["ts"], unit="s", utc=True).dt.tz_convert("America/New_York").dt.date
        df["VWAP"] = (typical_price * df["volume"]).groupby(day).cumsum() / df["volume"].groupby(day).cumsum()

    elif indicator == "VOLUME_SMA":
        length = int(params.get("length", 20))
        df[col] = df["volume"].rolling(length).mean()
