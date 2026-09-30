export interface Trade {
  entry_ts: number;
  exit_ts: number;
  direction: "long" | "short";
  entry_price: number;
  exit_price: number;
  shares: number;
  pnl: number;
  pnl_pct: number;
  exit_reason: "signal" | "stop_loss" | "take_profit" | "end_of_data";
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
  metrics: BacktestMetrics;
  equity_curve: EquityPoint[];
  trades: Trade[];
}
