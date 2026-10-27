import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { runBacktest } from "../api/backtest";
import { ApiError } from "../api/client";
import type { NeedsHistory } from "../types/scanner";
import { useAppStore } from "../store/useAppStore";
import { RUNS_KEY } from "./useBacktestRuns";

export function useRunBacktest() {
  const {
    symbol, timeframe, startDate, endDate,
    activeStrategy, activeSavedId,
    setBacktestResult, setActiveRunId, setRunningBacktest, setBacktestError, setBacktestNeedsHistory, setActiveTab,
  } = useAppStore();
  const qc = useQueryClient();

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
        config: activeStrategy, // includes unsaved edits
        ...(activeSavedId ? { strategy_id: activeSavedId } : {}),
      });
      setBacktestResult(result);
      // Every run is saved; show it in the Results history
      setActiveRunId(result.run_id ?? null);
      qc.invalidateQueries({ queryKey: RUNS_KEY });
      setActiveTab("results");
    } catch (e: unknown) {
      setBacktestError(e instanceof Error ? e.message : "Backtest failed");
      if (e instanceof ApiError && e.data?.needs_history) setBacktestNeedsHistory(e.data.needs_history as NeedsHistory);
    } finally {
      setRunningBacktest(false);
    }
  }, [symbol, timeframe, startDate, endDate, activeStrategy, activeSavedId,
    setBacktestResult, setActiveRunId, setRunningBacktest, setBacktestError, setBacktestNeedsHistory, setActiveTab, qc]);
}
