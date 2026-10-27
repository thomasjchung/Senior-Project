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

// Pattern rules: long setups checked on completed candles (see types/rules.ts)
export type RuleType =
  | "pullback" | "green_volume" | "holds_above" | "no_topping_tail"
  | "breakout" | "volume_spike" | "candle_pattern" | "line_bounce" | "support_bounce";

export interface PatternRule {
  type: RuleType;
  params: Record<string, number | string>;
}

// When the trade is entered once the signal candle has all conditions and rules
export type EntryTrigger = "close" | "break_high" | "confirmed_break";
export type StopType = "percent" | "pullback_low" | "signal_low";

export const ENTRY_TRIGGERS: { value: EntryTrigger; label: string; help: string }[] = [
  { value: "close", label: "At the signal candle's close", help: "Buys at the close of the candle where everything lines up." },
  {
    value: "break_high",
    label: "Break of the signal candle's high",
    help: "Waits for the next candle to trade above the signal candle's high and buys there (or at the open if it gaps above).",
  },
  {
    value: "confirmed_break",
    label: "Confirmation candle, then break of its high",
    help: "The signal candle must close above the previous candle's high; then buys when the next candle breaks the signal candle's high.",
  },
];

export const STOP_TYPES: { value: StopType; label: string }[] = [
  { value: "percent", label: "Fixed % below entry" },
  { value: "pullback_low", label: "Pullback low (needs a pullback rule)" },
  { value: "signal_low", label: "Low of the signal candle" },
];

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
  // The fields below are absent in strategies saved before they existed
  universe?: Universe;
  style?: string; // id of the style template it was started from
  entry_rules?: PatternRule[];
  entry_trigger?: EntryTrigger;
  stop_type?: StopType;
  reward_risk?: number | null; // take profit at N× the risk; overrides take_profit_pct
  exit_end_of_day?: boolean;
  max_risk_pct?: number | null; // skip setups whose stop is further than this below entry
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
    entry_rules: [],
    entry_trigger: "close",
    stop_type: "percent",
    reward_risk: null,
    exit_end_of_day: false,
  };
}

// Pattern rules, breakout entries and setup stops describe long setups
export function isLongOnly(config: StrategyConfig): boolean {
  return (
    (config.entry_rules?.length ?? 0) > 0 ||
    (config.entry_trigger ?? "close") !== "close" ||
    (config.stop_type ?? "percent") !== "percent"
  );
}
