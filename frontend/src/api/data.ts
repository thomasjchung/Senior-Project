import client from "./client";
import type { OHLCVBar, Timeframe, SymbolSearchResult } from "../types/ohlcv";

export interface BarsResponse {
  symbol: string;
  timeframe: Timeframe;
  bars: OHLCVBar[];
  count: number;
  cached: boolean;
}

export async function fetchBars(
  symbol: string,
  timeframe: Timeframe,
  start: string,
  end: string
): Promise<BarsResponse> {
  const res = await client.get("/data/bars", {
    params: { symbol, timeframe, start, end },
  });
  return res.data;
}

export async function searchSymbols(q: string): Promise<SymbolSearchResult[]> {
  const res = await client.get("/data/symbols/search", { params: { q } });
  return res.data.results;
}
