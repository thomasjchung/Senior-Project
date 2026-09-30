import { useCallback } from "react";
import { fetchBars } from "../api/data";
import { useAppStore } from "../store/useAppStore";

export function useLoadBars() {
  const { symbol, timeframe, startDate, endDate, setLoadingBars, setBars, setBarsError } = useAppStore();

  return useCallback(async () => {
    setLoadingBars(true);
    setBarsError(null);
    try {
      const res = await fetchBars(symbol, timeframe, startDate, endDate);
      setBars(res.bars);
    } catch (e: unknown) {
      setBarsError(e instanceof Error ? e.message : "Failed to load bars");
    } finally {
      setLoadingBars(false);
    }
  }, [symbol, timeframe, startDate, endDate, setLoadingBars, setBars, setBarsError]);
}
