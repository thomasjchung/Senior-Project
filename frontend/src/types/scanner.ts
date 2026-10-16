export interface ScanCriteria {
  min_price: number | null;
  max_price: number | null;
  min_change_pct: number | null;
  min_rvol: number | null;
  min_volume: number | null;
  max_float: number | null; // shares
  avg_volume_days: number;
  include_unknown_float: boolean;
}

export interface ScanRow {
  symbol: string;
  name: string;
  price: number;
  change_pct: number;
  high_change_pct?: number; // historical scans only
  volume: number;
  avg_volume: number | null;
  rvol: number | null;
  float_shares?: number | null; // absent when not looked up, null when unknown
}

export interface LiveScanResult {
  rows: ScanRow[];
  as_of: string | null;
  candidates: number;
  volume_feed: "iex";
}

export interface HistoricalScanResult {
  rows: ScanRow[];
  day: string;
  truncated: boolean;
  volume_feed: "sip";
}

export interface HistoryStatus {
  running: boolean;
  done: number;
  total: number;
  start: string | null;
  end: string | null;
  error: string | null;
  months: { month: string; through_day: string }[];
}

export interface NeedsHistory {
  start: string;
  end: string;
}

export function makeBlankCriteria(): ScanCriteria {
  return {
    min_price: null,
    max_price: null,
    min_change_pct: null,
    min_rvol: null,
    min_volume: null,
    max_float: null,
    avg_volume_days: 30,
    include_unknown_float: false,
  };
}

export const SCAN_PRESETS: { name: string; description: string; criteria: ScanCriteria }[] = [
  {
    name: "Small-cap momentum (Ross Cameron)",
    description: "$3–$20, up 30%+ on the day, 5× relative volume, float under 10M shares",
    criteria: {
      ...makeBlankCriteria(),
      min_price: 3,
      max_price: 20,
      min_change_pct: 30,
      min_rvol: 5,
      max_float: 10_000_000,
    },
  },
  {
    name: "Big gainers",
    description: "Up 20%+ on the day, at least $1",
    criteria: { ...makeBlankCriteria(), min_price: 1, min_change_pct: 20 },
  },
  {
    name: "Unusual volume",
    description: "3× relative volume, at least $5 and 500K shares traded",
    criteria: { ...makeBlankCriteria(), min_price: 5, min_rvol: 3, min_volume: 500_000 },
  },
];
