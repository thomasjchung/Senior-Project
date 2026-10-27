import type { PatternRule, RuleType } from "./strategy";

// Mirrors backend/backtest/setups.py RULE_PARAMS
export type RuleParam =
  | { name: string; label: string; kind: "number"; default: number; min: number; max: number; step?: number; unit?: string }
  | { name: string; label: string; kind: "choice"; default: string; options: { value: string; label: string }[] };

export interface RuleInfo {
  label: string;
  description: string;
  params: RuleParam[];
}

const LINE_OPTIONS = [
  { value: "VWAP", label: "VWAP" },
  { value: "EMA", label: "EMA" },
  { value: "SMA", label: "SMA" },
];

export const RULE_INFO: Record<RuleType, RuleInfo> = {
  pullback: {
    label: "Pullback holds the move",
    description:
      "After a move up, price pulls back without giving up more than the max share of the move. The pullback low is the stop for a \"pullback low\" stop.",
    params: [
      { name: "max_retrace_pct", label: "Max pullback", kind: "number", default: 50, min: 0, max: 100, step: 1, unit: "% of move" },
      { name: "min_retrace_pct", label: "Min pullback", kind: "number", default: 0, min: 0, max: 100, step: 1, unit: "% of move" },
      { name: "min_move_pct", label: "Min move up", kind: "number", default: 3, min: 0, max: 1000, step: 0.5, unit: "%" },
      { name: "lookback", label: "Look back for the move", kind: "number", default: 20, min: 3, max: 60, unit: "candles" },
      { name: "min_bars", label: "Pullback at least", kind: "number", default: 1, min: 1, max: 60, unit: "candles" },
      { name: "max_bars", label: "Pullback at most", kind: "number", default: 6, min: 1, max: 60, unit: "candles" },
    ],
  },
  green_volume: {
    label: "Green candles outweigh red",
    description: "Average volume on green candles is at least N× the average on red candles: buyers are in control.",
    params: [
      { name: "ratio", label: "Green ÷ red volume at least", kind: "number", default: 1, min: 0, max: 100, step: 0.1, unit: "×" },
      { name: "lookback", label: "Over the last", kind: "number", default: 10, min: 2, max: 100, unit: "candles" },
    ],
  },
  holds_above: {
    label: "Holds above a line",
    description: "Price stays above VWAP or a moving average for the last N candles.",
    params: [
      { name: "line", label: "Line", kind: "choice", default: "VWAP", options: LINE_OPTIONS },
      { name: "length", label: "Period (EMA/SMA)", kind: "number", default: 9, min: 1, max: 500 },
      { name: "bars", label: "For the last", kind: "number", default: 5, min: 1, max: 100, unit: "candles" },
      {
        name: "use", label: "Check", kind: "choice", default: "close",
        options: [{ value: "close", label: "Closes" }, { value: "low", label: "Lows (no wicks below)" }],
      },
    ],
  },
  no_topping_tail: {
    label: "No topping tails",
    description: "No recent candle has a long upper wick, a sign that sellers are stepping in at the highs.",
    params: [
      { name: "max_wick_pct", label: "Upper wick at most", kind: "number", default: 50, min: 0, max: 100, step: 5, unit: "% of candle" },
      { name: "bars", label: "Over the last", kind: "number", default: 3, min: 1, max: 100, unit: "candles" },
    ],
  },
  breakout: {
    label: "Breaks out to a new high",
    description: "The candle closes above the highest high of the previous N candles.",
    params: [{ name: "lookback", label: "Highest high of the last", kind: "number", default: 20, min: 2, max: 500, unit: "candles" }],
  },
  volume_spike: {
    label: "Volume spike",
    description: "The candle's volume is at least N× the average of the previous candles.",
    params: [
      { name: "multiple", label: "Volume at least", kind: "number", default: 2, min: 0, max: 1000, step: 0.5, unit: "× average" },
      { name: "lookback", label: "Average of the last", kind: "number", default: 20, min: 2, max: 500, unit: "candles" },
    ],
  },
  candle_pattern: {
    label: "Candlestick pattern",
    description: "The signal candle forms a bullish candlestick pattern.",
    params: [
      {
        name: "pattern", label: "Pattern", kind: "choice", default: "bullish_engulfing",
        options: [
          { value: "bullish_engulfing", label: "Bullish engulfing" },
          { value: "hammer", label: "Hammer" },
          { value: "three_green", label: "Three rising green candles" },
        ],
      },
    ],
  },
  line_bounce: {
    label: "Bounces off a moving line",
    description: "The candle dips to VWAP or a moving average and closes green above it (dynamic support).",
    params: [
      { name: "line", label: "Line", kind: "choice", default: "EMA", options: LINE_OPTIONS },
      { name: "length", label: "Period (EMA/SMA)", kind: "number", default: 20, min: 1, max: 500 },
      { name: "tolerance_pct", label: "Within", kind: "number", default: 0.5, min: 0, max: 50, step: 0.1, unit: "% of the line" },
    ],
  },
  support_bounce: {
    label: "Bounces off support",
    description: "The candle dips to the lowest low of the previous N candles and closes green.",
    params: [
      { name: "lookback", label: "Support = lowest low of the last", kind: "number", default: 50, min: 5, max: 500, unit: "candles" },
      { name: "tolerance_pct", label: "Within", kind: "number", default: 1, min: 0, max: 50, step: 0.1, unit: "% of support" },
    ],
  },
};

export const RULE_TYPES = Object.keys(RULE_INFO) as RuleType[];

export function makeRule(type: RuleType, overrides: Record<string, number | string> = {}): PatternRule {
  const params = Object.fromEntries(RULE_INFO[type].params.map((p) => [p.name, p.default]));
  return { type, params: { ...params, ...overrides } };
}

// One-line summary, e.g. "Holds above EMA 9 (5 candles)"
export function ruleSummary(rule: PatternRule): string {
  const p = rule.params;
  const line = p.line === "VWAP" ? "VWAP" : `${p.line} ${p.length}`;
  switch (rule.type) {
    case "pullback":
      return Number(p.min_retrace_pct) > 0
        ? `Pullback of ${p.min_retrace_pct}–${p.max_retrace_pct}% of the move`
        : `Pullback no deeper than ${p.max_retrace_pct}% of the move`;
    case "green_volume":
      return `Green volume ≥ ${p.ratio}× red (last ${p.lookback})`;
    case "holds_above":
      return `Holds above ${line} (last ${p.bars})`;
    case "no_topping_tail":
      return `No topping tails (last ${p.bars})`;
    case "breakout":
      return `Closes above the ${p.lookback}-candle high`;
    case "volume_spike":
      return `Volume ≥ ${p.multiple}× average`;
    case "candle_pattern": {
      const opt = RULE_INFO.candle_pattern.params[0];
      return opt.kind === "choice" ? opt.options.find((o) => o.value === p.pattern)?.label ?? String(p.pattern) : "";
    }
    case "line_bounce":
      return `Bounces off ${line}`;
    case "support_bounce":
      return `Bounces off the ${p.lookback}-candle low`;
  }
}
