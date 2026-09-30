import { create } from "zustand";
import type { OHLCVBar, Timeframe } from "../types/ohlcv";
import type { StrategyConfig } from "../types/strategy";
import type { BacktestResult } from "../types/backtest";
import { makeBlankStrategy } from "../types/strategy";
import dayjs from "dayjs";

export type AppTab = "chart" | "strategy" | "results";

interface AppState {
  // Symbol / data selection
  symbol: string;
  timeframe: Timeframe;
  startDate: string;
  endDate: string;
  bars: OHLCVBar[];
  isLoadingBars: boolean;
  barsError: string | null;

  // Chart indicator toggles
  overlayIndicators: string[]; // e.g. ["SMA_20", "EMA_50"]
  subPaneIndicators: string[]; // e.g. ["RSI_14", "MACD_12_26_9"]

  // Active strategy (being edited)
  activeStrategy: StrategyConfig;
  activeSavedId: number | null;

  // Backtest result
  backtestResult: BacktestResult | null;
  isRunningBacktest: boolean;
  backtestError: string | null;

  // UI
  activeTab: AppTab;

  // Actions
  setSymbol: (s: string) => void;
  setTimeframe: (tf: Timeframe) => void;
  setStartDate: (d: string) => void;
  setEndDate: (d: string) => void;
  setBars: (bars: OHLCVBar[]) => void;
  setLoadingBars: (v: boolean) => void;
  setBarsError: (e: string | null) => void;

  toggleOverlayIndicator: (key: string) => void;
  toggleSubPaneIndicator: (key: string) => void;

  setActiveStrategy: (s: StrategyConfig) => void;
  setActiveSavedId: (id: number | null) => void;

  setBacktestResult: (r: BacktestResult | null) => void;
  setRunningBacktest: (v: boolean) => void;
  setBacktestError: (e: string | null) => void;

  setActiveTab: (t: AppTab) => void;
}

const defaultEnd = dayjs().subtract(1, "day").format("YYYY-MM-DD");
const defaultStart = dayjs().subtract(6, "month").format("YYYY-MM-DD");

export const useAppStore = create<AppState>((set) => ({
  symbol: "AAPL",
  timeframe: "1Day",
  startDate: defaultStart,
  endDate: defaultEnd,
  bars: [],
  isLoadingBars: false,
  barsError: null,

  overlayIndicators: ["SMA_20"],
  subPaneIndicators: ["RSI_14"],

  activeStrategy: makeBlankStrategy(),
  activeSavedId: null,

  backtestResult: null,
  isRunningBacktest: false,
  backtestError: null,

  activeTab: "chart",

  setSymbol: (s) => set({ symbol: s.toUpperCase() }),
  setTimeframe: (tf) => set({ timeframe: tf }),
  setStartDate: (d) => set({ startDate: d }),
  setEndDate: (d) => set({ endDate: d }),
  setBars: (bars) => set({ bars }),
  setLoadingBars: (v) => set({ isLoadingBars: v }),
  setBarsError: (e) => set({ barsError: e }),

  toggleOverlayIndicator: (key) =>
    set((s) => ({
      overlayIndicators: s.overlayIndicators.includes(key)
        ? s.overlayIndicators.filter((k) => k !== key)
        : [...s.overlayIndicators, key],
    })),
  toggleSubPaneIndicator: (key) =>
    set((s) => ({
      subPaneIndicators: s.subPaneIndicators.includes(key)
        ? s.subPaneIndicators.filter((k) => k !== key)
        : [...s.subPaneIndicators, key],
    })),

  setActiveStrategy: (s) => set({ activeStrategy: s }),
  setActiveSavedId: (id) => set({ activeSavedId: id }),

  setBacktestResult: (r) => set({ backtestResult: r }),
  setRunningBacktest: (v) => set({ isRunningBacktest: v }),
  setBacktestError: (e) => set({ backtestError: e }),

  setActiveTab: (t) => set({ activeTab: t }),
}));
