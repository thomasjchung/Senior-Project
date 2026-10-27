import client from "./client";
import type { BacktestResult, BacktestRun, BacktestRunSummary } from "../types/backtest";
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

export async function listRuns(): Promise<BacktestRunSummary[]> {
  const res = await client.get("/backtest/runs");
  return res.data.runs;
}

export async function getRun(id: number): Promise<BacktestRun> {
  const res = await client.get(`/backtest/runs/${id}`);
  return res.data;
}

export async function updateRun(id: number, patch: { notes?: string; name?: string }): Promise<void> {
  await client.patch(`/backtest/runs/${id}`, patch);
}

export async function deleteRun(id: number): Promise<void> {
  await client.delete(`/backtest/runs/${id}`);
}
