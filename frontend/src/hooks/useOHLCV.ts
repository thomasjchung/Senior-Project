import { useCallback } from "react";
import dayjs from "dayjs";
import { fetchBars } from "../api/data";
import { useAppStore } from "../store/useAppStore";
import type { Timeframe } from "../types/ohlcv";

// Bars of history loaded before startDate so indicators (e.g. a 200-period SMA)
// are fully defined from the first visible candle instead of starting partway in.
export const WARMUP_BARS = 500;

// Approximate regular-session bars per trading day; overestimating the calendar span is harmless.
const BARS_PER_DAY: Record<Timeframe, number> = { "1Min": 390, "5Min": 78, "15Min": 26, "1Hour": 7, "1Day": 1 };

function warmupStart(startDate: string, timeframe: Timeframe): string {
  const tradingDays = Math.ceil(WARMUP_BARS / BARS_PER_DAY[timeframe]);
  const calendarDays = Math.ceil((tradingDays * 7) / 5) + 10; // weekends + holidays
  return dayjs(startDate).subtract(calendarDays, "day").format("YYYY-MM-DD");
}

// Reads the store when called (not when rendered), so callers can update the
// symbol/dates and load in the same handler.
export function useLoadBars() {
  return useCallback(async () => {
    const { symbol, timeframe, startDate, endDate, setLoadingBars, setBars, setBarsError } = useAppStore.getState();
    setLoadingBars(true);
    setBarsError(null);
    try {
      const res = await fetchBars(symbol, timeframe, warmupStart(startDate, timeframe), endDate);
      // Backend interprets bare dates as UTC midnight
      const startTs = Date.parse(`${startDate}T00:00:00Z`) / 1000;
      const visible = res.bars.filter((b) => b.t >= startTs);
      const warmup = res.bars.filter((b) => b.t < startTs).slice(-WARMUP_BARS);
      setBars(res.symbol, visible, warmup);
    } catch (e: unknown) {
      setBarsError(e instanceof Error ? e.message : "Failed to load bars");
    } finally {
      setLoadingBars(false);
    }
  }, []);
}

// Show a symbol over a date range on the Chart tab
export function useOpenInChart() {
  const loadBars = useLoadBars();
  return useCallback(
    (symbol: string, timeframe: Timeframe, startDate: string, endDate: string) => {
      const s = useAppStore.getState();
      s.setSymbol(symbol);
      s.setTimeframe(timeframe);
      s.setStartDate(startDate);
      s.setEndDate(endDate);
      s.setActiveTab("chart");
      loadBars();
    },
    [loadBars]
  );
}
