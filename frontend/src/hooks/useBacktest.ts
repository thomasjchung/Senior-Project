import { useCallback } from "react";
import { runBacktest } from "../api/backtest";
import { useAppStore } from "../store/useAppStore";

export function useRunBacktest() {
  const {
    symbol, timeframe, startDate, endDate,
    activeStrategy, activeSavedId,
    setBacktestResult, setRunningBacktest, setBacktestError, setActiveTab,
  } = useAppStore();

  return useCallback(async () => {
    setRunningBacktest(true);
    setBacktestError(null);
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
    } finally {
      setRunningBacktest(false);
    }
  }, [symbol, timeframe, startDate, endDate, activeStrategy, activeSavedId,
    setBacktestResult, setRunningBacktest, setBacktestError, setActiveTab]);
}
