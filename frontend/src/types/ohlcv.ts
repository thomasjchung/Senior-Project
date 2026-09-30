export interface OHLCVBar {
  t: number; // unix timestamp (seconds)
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  vwap?: number | null;
  trade_count?: number | null;
  source?: string;
}

export type Timeframe = "1Min" | "5Min" | "15Min" | "1Hour" | "1Day";

export const TIMEFRAMES: Timeframe[] = ["1Min", "5Min", "15Min", "1Hour", "1Day"];

export interface SymbolSearchResult {
  symbol: string;
  name: string;
  exchange: string;
}
