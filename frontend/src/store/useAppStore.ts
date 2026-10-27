import { create } from "zustand";
import type { OHLCVBar, Timeframe } from "../types/ohlcv";
import type { StrategyConfig } from "../types/strategy";
import type { BacktestResult } from "../types/backtest";
import type { NeedsHistory } from "../types/scanner";
import { makeBlankStrategy } from "../types/strategy";
import dayjs from "dayjs";

export type OverlayKind = "SMA" | "EMA" | "BB";
export type PriceSource = "close" | "open";

export interface OverlayIndicator {
  id: string;
  kind: OverlayKind;
  length: number;
  source: PriceSource;
  stdDev: number; // Bollinger Bands only
  color: string;
  visible: boolean;
}

export type NewOverlay = Omit<OverlayIndicator, "id" | "visible">;

export type DrawingTool = "hline" | "trend" | "fib";

export interface DrawingPoint {
  time: number; // unix seconds
  price: number;
}

// User-drawn chart line. Horizontal lines only use p1.price; a Fibonacci
// retracement runs from p1 (level 1) to p2 (level 0).
export interface Drawing {
  id: string;
  symbol: string;
  tool: DrawingTool;
  role?: "support" | "resistance"; // horizontal and trend lines only
  p1: DrawingPoint;
  p2: DrawingPoint;
}

export type AppTab = "chart" | "scanner" | "strategy" | "results";

interface AppState {
  // Symbol / data selection
  symbol: string;
  timeframe: Timeframe;
  startDate: string;
  endDate: string;
  bars: OHLCVBar[];
  // Bars immediately before startDate, used only so indicators are warmed up at the first visible bar
  warmupBars: OHLCVBar[];
  loadedSymbol: string; // symbol the current bars belong to
  isLoadingBars: boolean;
  barsError: string | null;

  // Chart indicator toggles
  overlayIndicators: OverlayIndicator[];
  subPaneIndicators: string[]; // e.g. ["RSI_14", "MACD_12_26_9"]

  // Chart drawings
  drawings: Drawing[];
  activeDrawingTool: DrawingTool | null;

  // Active strategy (being edited)
  activeStrategy: StrategyConfig;
  activeSavedId: number | null;

  // Backtest result
  backtestResult: BacktestResult | null;
  activeRunId: number | null; // run shown in the Results tab
  isRunningBacktest: boolean;
  backtestError: string | null;
  // Set when a scanner backtest needs market history that isn't downloaded
  backtestNeedsHistory: NeedsHistory | null;

  // UI
  activeTab: AppTab;

  // Actions
  setSymbol: (s: string) => void;
  setTimeframe: (tf: Timeframe) => void;
  setStartDate: (d: string) => void;
  setEndDate: (d: string) => void;
  setBars: (symbol: string, bars: OHLCVBar[], warmupBars?: OHLCVBar[]) => void;
  setLoadingBars: (v: boolean) => void;
  setBarsError: (e: string | null) => void;

  addOverlayIndicator: (o: NewOverlay) => void;
  removeOverlayIndicator: (id: string) => void;
  toggleOverlayIndicator: (id: string) => void;
  toggleSubPaneIndicator: (key: string) => void;

  setActiveDrawingTool: (t: DrawingTool | null) => void;
  addDrawing: (d: Omit<Drawing, "id">) => void;
  removeDrawing: (id: string) => void;
  clearDrawings: (symbol: string) => void;

  setActiveStrategy: (s: StrategyConfig) => void;
  setActiveSavedId: (id: number | null) => void;

  setBacktestResult: (r: BacktestResult | null) => void;
  setActiveRunId: (id: number | null) => void;
  setRunningBacktest: (v: boolean) => void;
  setBacktestError: (e: string | null) => void;
  setBacktestNeedsHistory: (n: NeedsHistory | null) => void;

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
  warmupBars: [],
  loadedSymbol: "",
  isLoadingBars: false,
  barsError: null,

  overlayIndicators: [
    { id: "default-sma", kind: "SMA", length: 20, source: "close", stdDev: 2, color: "#f59e0b", visible: true },
  ],
  subPaneIndicators: ["RSI_14"],

  drawings: [],
  activeDrawingTool: null,

  activeStrategy: makeBlankStrategy(),
  activeSavedId: null,

  backtestResult: null,
  activeRunId: null,
  isRunningBacktest: false,
  backtestError: null,
  backtestNeedsHistory: null,

  activeTab: "chart",

  setSymbol: (s) => set({ symbol: s.toUpperCase() }),
  setTimeframe: (tf) => set({ timeframe: tf }),
  setStartDate: (d) => set({ startDate: d }),
  setEndDate: (d) => set({ endDate: d }),
  setBars: (symbol, bars, warmupBars = []) => set({ loadedSymbol: symbol, bars, warmupBars }),
  setLoadingBars: (v) => set({ isLoadingBars: v }),
  setBarsError: (e) => set({ barsError: e }),

  addOverlayIndicator: (o) =>
    set((s) => ({ overlayIndicators: [...s.overlayIndicators, { ...o, id: crypto.randomUUID(), visible: true }] })),
  removeOverlayIndicator: (id) =>
    set((s) => ({ overlayIndicators: s.overlayIndicators.filter((o) => o.id !== id) })),
  toggleOverlayIndicator: (id) =>
    set((s) => ({
      overlayIndicators: s.overlayIndicators.map((o) => (o.id === id ? { ...o, visible: !o.visible } : o)),
    })),
  toggleSubPaneIndicator: (key) =>
    set((s) => ({
      subPaneIndicators: s.subPaneIndicators.includes(key)
        ? s.subPaneIndicators.filter((k) => k !== key)
        : [...s.subPaneIndicators, key],
    })),

  setActiveDrawingTool: (t) => set({ activeDrawingTool: t }),
  addDrawing: (d) => set((s) => ({ drawings: [...s.drawings, { ...d, id: crypto.randomUUID() }] })),
  removeDrawing: (id) => set((s) => ({ drawings: s.drawings.filter((d) => d.id !== id) })),
  clearDrawings: (symbol) => set((s) => ({ drawings: s.drawings.filter((d) => d.symbol !== symbol) })),

  setActiveStrategy: (s) => set({ activeStrategy: s }),
  setActiveSavedId: (id) => set({ activeSavedId: id }),

  setBacktestResult: (r) => set({ backtestResult: r }),
  setActiveRunId: (id) => set({ activeRunId: id }),
  setRunningBacktest: (v) => set({ isRunningBacktest: v }),
  setBacktestError: (e) => set({ backtestError: e }),
  setBacktestNeedsHistory: (n) => set({ backtestNeedsHistory: n }),

  setActiveTab: (t) => set({ activeTab: t }),
}));
