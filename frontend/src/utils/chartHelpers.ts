import type { CandlestickData, LineData, HistogramData, UTCTimestamp } from "lightweight-charts";
import type { OHLCVBar } from "../types/ohlcv";

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
