import type { StrategyConfig } from "./strategy";
import type { Timeframe } from "./ohlcv";

export interface Trade {
  entry_ts: number;
  exit_ts: number;
  direction: "long" | "short";
  entry_price: number;
  exit_price: number;
  shares: number;
  pnl: number;
  pnl_pct: number;
  exit_reason: "signal" | "stop_loss" | "take_profit" | "end_of_data" | "end_of_day";
  symbol?: string; // scanner backtests only
  r_multiple?: number; // P&L in multiples of the risk (entry to stop); only with a stop-loss
}

export interface EquityPoint {
  t: number;
  equity: number;
}

export interface BacktestMetrics {
  total_return_pct: number;
  cagr_pct: number;
  sharpe_ratio: number;
  max_drawdown_pct: number;
  win_rate_pct: number;
  total_trades: number;
  avg_trade_pct: number;
  profit_factor: number;
  final_equity: number;
  initial_capital: number;
}

export interface BacktestResult {
  run_id?: number; // id in the saved run history
  metrics: BacktestMetrics;
  equity_curve: EquityPoint[];
  trades: Trade[];
  universe?: {
    candidate_days: number;
    sessions: number;
    symbols: number;
    float_unknown: number;
  };
}

// A saved backtest run (every run is saved)
export interface BacktestRunSummary {
  id: number;
  name: string;
  strategy_id: number | null;
  symbol: string | null; // null for scanner runs
  universe_type: "symbol" | "scanner";
  timeframe: Timeframe;
  start: string;
  end: string;
  initial_capital: number;
  notes: string;
  ran_at: number;
  metrics: BacktestMetrics;
}

export interface BacktestRun extends BacktestRunSummary {
  config: StrategyConfig;
  result: BacktestResult;
}
