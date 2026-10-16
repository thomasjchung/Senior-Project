export type IndicatorKey =
  | "RSI" | "SMA" | "EMA" | "VWAP"
  | "BB_UPPER" | "BB_MIDDLE" | "BB_LOWER"
  | "MACD_LINE" | "MACD_SIGNAL" | "MACD_HIST"
  | "STOCH_K" | "STOCH_D"
  | "VOLUME" | "VOLUME_SMA" | "PRICE";

export type OperatorKey =
  | ">" | ">=" | "<" | "<="
  | "crosses_above" | "crosses_below"
  | "price_above_indicator" | "price_below_indicator"
  | "price_crosses_above_indicator" | "price_crosses_below_indicator";

import type { ScanCriteria } from "./scanner";

export type DirectionKey = "long" | "short" | "both";

// Which stocks a backtest trades: the chart's symbol, or whatever met the
// scanner criteria at each moment
export type Universe =
  | { type: "symbol" }
  | { type: "scanner"; criteria: ScanCriteria; regular_hours_only: boolean };
export type LogicKey = "AND" | "OR";

export interface Condition {
  indicator: IndicatorKey;
  params: Record<string, number>;
  operator: OperatorKey;
  value: number | null;
}

export interface StrategyConfig {
  name: string;
  direction: DirectionKey;
  position_size_pct: number;
  stop_loss_pct: number | null;
  take_profit_pct: number | null;
  logic: LogicKey;
  entry_conditions: Condition[];
  exit_conditions: Condition[];
  universe?: Universe; // absent in strategies saved before universes existed
}

export interface SavedStrategy {
  id: number;
  name: string;
  config: StrategyConfig;
  created_at: number;
  updated_at: number;
}

export const INDICATOR_LABELS: Record<IndicatorKey, string> = {
  RSI: "RSI",
  SMA: "SMA",
  EMA: "EMA",
  VWAP: "VWAP",
  BB_UPPER: "Bollinger Upper",
  BB_MIDDLE: "Bollinger Middle",
  BB_LOWER: "Bollinger Lower",
  MACD_LINE: "MACD Line",
  MACD_SIGNAL: "MACD Signal",
  MACD_HIST: "MACD Histogram",
  STOCH_K: "Stochastic %K",
  STOCH_D: "Stochastic %D",
  VOLUME: "Volume",
  VOLUME_SMA: "Volume SMA",
  PRICE: "Price (Close)",
};

export const OPERATOR_LABELS: Record<OperatorKey, string> = {
  ">": "greater than",
  ">=": "≥",
  "<": "less than",
  "<=": "≤",
  crosses_above: "crosses above",
  crosses_below: "crosses below",
  price_above_indicator: "price above",
  price_below_indicator: "price below",
  price_crosses_above_indicator: "price crosses above",
  price_crosses_below_indicator: "price crosses below",
};

export const PRICE_OPERATORS = new Set<OperatorKey>([
  "price_above_indicator",
  "price_below_indicator",
  "price_crosses_above_indicator",
  "price_crosses_below_indicator",
]);

export const INDICATOR_PARAMS: Record<IndicatorKey, Array<{ name: string; default: number }>> = {
  RSI: [{ name: "length", default: 14 }],
  SMA: [{ name: "length", default: 20 }],
  EMA: [{ name: "length", default: 20 }],
  VWAP: [],
  BB_UPPER: [{ name: "length", default: 20 }, { name: "std", default: 2 }],
  BB_MIDDLE: [{ name: "length", default: 20 }, { name: "std", default: 2 }],
  BB_LOWER: [{ name: "length", default: 20 }, { name: "std", default: 2 }],
  MACD_LINE: [{ name: "fast", default: 12 }, { name: "slow", default: 26 }, { name: "signal", default: 9 }],
  MACD_SIGNAL: [{ name: "fast", default: 12 }, { name: "slow", default: 26 }, { name: "signal", default: 9 }],
  MACD_HIST: [{ name: "fast", default: 12 }, { name: "slow", default: 26 }, { name: "signal", default: 9 }],
  STOCH_K: [{ name: "k", default: 14 }, { name: "d", default: 3 }, { name: "smooth", default: 3 }],
  STOCH_D: [{ name: "k", default: 14 }, { name: "d", default: 3 }, { name: "smooth", default: 3 }],
  VOLUME: [],
  VOLUME_SMA: [{ name: "length", default: 20 }],
  PRICE: [],
};

export function defaultParams(indicator: IndicatorKey): Record<string, number> {
  return Object.fromEntries(
    INDICATOR_PARAMS[indicator].map((p) => [p.name, p.default])
  );
}

export function makeBlankCondition(): Condition {
  return {
    indicator: "RSI",
    params: { length: 14 },
    operator: "<",
    value: 30,
  };
}

export function makeBlankStrategy(): StrategyConfig {
  return {
    name: "New Strategy",
    direction: "long",
    position_size_pct: 10,
    stop_loss_pct: null,
    take_profit_pct: null,
    logic: "AND",
    entry_conditions: [makeBlankCondition()],
    exit_conditions: [],
    universe: { type: "symbol" },
  };
}
