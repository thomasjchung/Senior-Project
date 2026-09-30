import client from "./client";
import type { SavedStrategy, StrategyConfig } from "../types/strategy";

export async function listStrategies(): Promise<SavedStrategy[]> {
  const res = await client.get("/strategies");
  return res.data.strategies;
}

export async function createStrategy(name: string, config: StrategyConfig): Promise<{ id: number; name: string }> {
  const res = await client.post("/strategies", { name, config });
  return res.data;
}

export async function updateStrategy(id: number, name: string, config: StrategyConfig): Promise<void> {
  await client.put(`/strategies/${id}`, { name, config });
}

export async function deleteStrategy(id: number): Promise<void> {
  await client.delete(`/strategies/${id}`);
}
