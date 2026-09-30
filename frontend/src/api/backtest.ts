import client from "./client";
import type { BacktestResult } from "../types/backtest";
import type { StrategyConfig } from "../types/strategy";
import type { Timeframe } from "../types/ohlcv";

export interface RunBacktestParams {
  symbol: string;
  timeframe: Timeframe;
  start: string;
  end: string;
  initial_capital?: number;
  strategy_id?: number;
  config?: StrategyConfig;
}

export async function runBacktest(params: RunBacktestParams): Promise<BacktestResult> {
  const res = await client.post("/backtest/run", params);
  return res.data;
}
