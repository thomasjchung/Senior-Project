import client from "./client";
import type { HistoricalScanResult, HistoryStatus, LiveScanResult, ScanCriteria } from "../types/scanner";

export async function runLiveScan(criteria: ScanCriteria): Promise<LiveScanResult> {
  const res = await client.post("/scanner/live", { criteria });
  return res.data;
}

export async function runHistoricalScan(criteria: ScanCriteria, date: string): Promise<HistoricalScanResult> {
  const res = await client.post("/scanner/historical", { criteria, date });
  return res.data;
}

export async function getHistoryStatus(): Promise<HistoryStatus> {
  const res = await client.get("/scanner/history/status");
  return res.data;
}

export async function startHistorySync(start: string, end: string): Promise<HistoryStatus> {
  const res = await client.post("/scanner/history/sync", { start, end });
  return res.data;
}
