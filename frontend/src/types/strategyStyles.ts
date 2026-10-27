import { makeRule } from "./rules";
import { SCAN_PRESETS } from "./scanner";
import { makeBlankStrategy, type Condition, type StrategyConfig } from "./strategy";

// Starting points for a strategy. Each fills in rules the user can then adjust.
export interface StrategyStyle {
  id: string;
  name: string;
  description: string;
  hint?: string; // shown once picked, e.g. a suggested timeframe
  build: () => StrategyConfig;
}

const MACD: Record<string, number> = { fast: 12, slow: 26, signal: 9 };
const momentumEntry: Condition[] = [
  { indicator: "MACD_HIST", params: MACD, operator: "crosses_above", value: 0 },
  { indicator: "RSI", params: { length: 14 }, operator: ">", value: 50 },
];

const base = (name: string, style: string): StrategyConfig => ({ ...makeBlankStrategy(), name, style, entry_conditions: [] });

export const STRATEGY_STYLES: StrategyStyle[] = [
  {
    id: "ross_momentum",
    name: "Momentum pullback (Ross Cameron)",
    description:
      "Scanner small caps that pull back less than half the move, then buy the break of a confirmation candle's high.",
    hint: "Built for 1Min or 5Min candles on scanner matches. Stop at the pullback low, target 2× the risk, flat by the close.",
    build: () => ({
      ...base("Momentum pullback", "ross_momentum"),
      universe: { type: "scanner", criteria: { ...SCAN_PRESETS[0].criteria }, regular_hours_only: true },
      entry_rules: [
        makeRule("pullback", { max_retrace_pct: 50 }),
        makeRule("green_volume"),
        makeRule("holds_above", { line: "VWAP", bars: 5 }),
        makeRule("holds_above", { line: "EMA", length: 9, bars: 5 }),
        makeRule("no_topping_tail"),
      ],
      entry_trigger: "confirmed_break",
      stop_type: "pullback_low",
      reward_risk: 2,
      exit_end_of_day: true,
    }),
  },
  {
    id: "breakout",
    name: "Breakout",
    description: "Buy a close above the recent high on a volume spike.",
    hint: "Stop under the breakout candle, target 2× the risk.",
    build: () => ({
      ...base("Breakout", "breakout"),
      entry_rules: [makeRule("breakout"), makeRule("volume_spike")],
      entry_trigger: "close",
      stop_type: "signal_low",
      reward_risk: 2,
    }),
  },
  {
    id: "fibonacci",
    name: "Fibonacci retracement",
    description: "Buy when a pullback holds the 38.2%–61.8% retracement zone and price breaks back up.",
    hint: "Stop at the pullback low, target 2× the risk.",
    build: () => ({
      ...base("Fibonacci retracement", "fibonacci"),
      entry_rules: [makeRule("pullback", { min_retrace_pct: 38.2, max_retrace_pct: 61.8, lookback: 30, max_bars: 10 })],
      entry_trigger: "break_high",
      stop_type: "pullback_low",
      reward_risk: 2,
    }),
  },
  {
    id: "support_resistance",
    name: "Support & resistance",
    description: "Buy a bounce off the recent low (support) once price breaks the bounce candle's high.",
    hint: "Stop under the bounce candle, target 2× the risk.",
    build: () => ({
      ...base("Support bounce", "support_resistance"),
      entry_rules: [makeRule("support_bounce")],
      entry_trigger: "break_high",
      stop_type: "signal_low",
      reward_risk: 2,
    }),
  },
  {
    id: "dynamic_sr",
    name: "Dynamic support (moving average)",
    description: "In an uptrend, buy a dip to the 20 EMA that closes back above it.",
    hint: "Trend filter: price above the 50 SMA. Stop under the bounce candle, target 2× the risk.",
    build: () => ({
      ...base("Moving-average bounce", "dynamic_sr"),
      entry_conditions: [{ indicator: "SMA", params: { length: 50 }, operator: "price_above_indicator", value: null }],
      entry_rules: [makeRule("line_bounce", { line: "EMA", length: 20 })],
      entry_trigger: "break_high",
      stop_type: "signal_low",
      reward_risk: 2,
    }),
  },
  {
    id: "candlestick",
    name: "Candlestick pattern",
    description: "Buy the break of a bullish engulfing (or hammer) candle's high.",
    hint: "Stop under the pattern candle, target 2× the risk.",
    build: () => ({
      ...base("Candlestick pattern", "candlestick"),
      entry_rules: [makeRule("candle_pattern")],
      entry_trigger: "break_high",
      stop_type: "signal_low",
      reward_risk: 2,
    }),
  },
  {
    id: "momentum",
    name: "Indicator momentum",
    description: "Buy when MACD turns positive with RSI above 50; sell when MACD turns negative.",
    hint: "Indicator conditions only, with a 3% stop.",
    build: () => ({
      ...base("Indicator momentum", "momentum"),
      entry_conditions: momentumEntry,
      exit_conditions: [{ indicator: "MACD_HIST", params: MACD, operator: "crosses_below", value: 0 }],
      stop_loss_pct: 3,
    }),
  },
  {
    id: "custom",
    name: "Start from scratch",
    description: "An empty strategy: add your own rules, indicator conditions and risk settings.",
    build: () => ({ ...base("New Strategy", "custom") }),
  },
];

export const styleById = (id?: string) => STRATEGY_STYLES.find((s) => s.id === id);
