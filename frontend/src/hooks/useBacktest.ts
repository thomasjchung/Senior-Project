import { useCallback } from "react";
import { runBacktest } from "../api/backtest";
import { ApiError } from "../api/client";
import type { NeedsHistory } from "../types/scanner";
import { useAppStore } from "../store/useAppStore";

export function useRunBacktest() {
  const {
    symbol, timeframe, startDate, endDate,
    activeStrategy, activeSavedId,
    setBacktestResult, setRunningBacktest, setBacktestError, setBacktestNeedsHistory, setActiveTab,
  } = useAppStore();

  return useCallback(async () => {
    setRunningBacktest(true);
    setBacktestError(null);
    setBacktestNeedsHistory(null);
    try {
      const result = await runBacktest({
        symbol,
        timeframe,
        start: startDate,
        end: endDate,
        initial_capital: 10000,
        ...(activeSavedId ? { strategy_id: activeSavedId } : { config: activeStrategy }),
      });
      setBacktestResult(result);
      setActiveTab("results");
    } catch (e: unknown) {
      setBacktestError(e instanceof Error ? e.message : "Backtest failed");
      if (e instanceof ApiError && e.data?.needs_history) setBacktestNeedsHistory(e.data.needs_history as NeedsHistory);
    } finally {
      setRunningBacktest(false);
    }
  }, [symbol, timeframe, startDate, endDate, activeStrategy, activeSavedId,
    setBacktestResult, setRunningBacktest, setBacktestError, setBacktestNeedsHistory, setActiveTab]);
}
