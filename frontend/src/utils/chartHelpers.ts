import type { CandlestickData, LineData, HistogramData, UTCTimestamp } from "lightweight-charts";
import type { OHLCVBar } from "../types/ohlcv";
import type { DrawingPoint, OverlayIndicator } from "../store/useAppStore";

export function barsToCandles(bars: OHLCVBar[]): CandlestickData[] {
  return bars.map((b) => ({
    time: b.t as UTCTimestamp,
    open: b.o,
    high: b.h,
    low: b.l,
    close: b.c,
  }));
}

export function barsToVolume(bars: OHLCVBar[]): HistogramData[] {
  return bars.map((b) => ({
    time: b.t as UTCTimestamp,
    value: b.v,
    color: b.c >= b.o ? "rgba(34, 197, 94, 0.5)" : "rgba(239, 68, 68, 0.5)",
  }));
}

export function indicatorToLine(
  bars: OHLCVBar[],
  values: (number | undefined)[]
): LineData[] {
  const result: LineData[] = [];
  for (let i = 0; i < bars.length; i++) {
    const v = values[i];
    if (v != null && !isNaN(v)) {
      result.push({ time: bars[i].t as UTCTimestamp, value: v });
    }
  }
  return result;
}

export function overlayTitle(o: OverlayIndicator): string {
  const params = o.kind === "BB" ? `${o.length}, ${o.stdDev}` : `${o.length}`;
  return `${o.kind} (${params}${o.source === "open" ? ", open" : ""})`;
}

function nearestBarTime(bars: OHLCVBar[], time: number): number {
  let lo = 0;
  let hi = bars.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (bars[mid].t < time) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && time - bars[lo - 1].t < bars[lo].t - time) lo--;
  return bars[lo].t;
}

// Price of the line through a and b at `time` (extrapolates outside the segment)
export function linePriceAt(a: DrawingPoint, b: DrawingPoint, time: number): number {
  return a.price + ((b.price - a.price) * (time - a.time)) / (b.time - a.time);
}

export const FIB_RATIOS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

// Horizontal Fibonacci retracement levels from the earlier point to the last bar.
// Level 0 is at p2 (the swing end) and level 1 at p1 (the swing start).
export function fibLevels(bars: OHLCVBar[], p1: DrawingPoint, p2: DrawingPoint) {
  if (bars.length === 0) return [];
  const start = nearestBarTime(bars, Math.min(p1.time, p2.time));
  const end = bars[bars.length - 1].t;
  if (start === end) return [];
  return FIB_RATIOS.map((ratio) => {
    const price = p2.price + (p1.price - p2.price) * ratio;
    const data: LineData[] = [
      { time: start as UTCTimestamp, value: price },
      { time: end as UTCTimestamp, value: price },
    ];
    return { ratio, data };
  });
}

// Endpoints are snapped to loaded bar times (the chart only accepts times on its
// time scale), keeping the original slope. Returns null if it collapses to one bar.
export function trendLineData(bars: OHLCVBar[], p1: DrawingPoint, p2: DrawingPoint): LineData[] | null {
  if (bars.length === 0 || p1.time === p2.time) return null;
  const [a, b] = p1.time < p2.time ? [p1, p2] : [p2, p1];
  const ta = nearestBarTime(bars, a.time);
  const tb = nearestBarTime(bars, b.time);
  if (ta === tb) return null;
  return [
    { time: ta as UTCTimestamp, value: linePriceAt(a, b, ta) },
    { time: tb as UTCTimestamp, value: linePriceAt(a, b, tb) },
  ];
}
