import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type SeriesMarker,
  type UTCTimestamp,
} from "lightweight-charts";
import { useAppStore } from "../../store/useAppStore";
import { barsToCandles } from "../../utils/chartHelpers";

export default function ChartContainer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any>(null);

  const { bars, overlayIndicators, backtestResult } = useAppStore();

  // Mount chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: { background: { color: "#0f1117" }, textColor: "#94a3b8" },
      grid: { vertLines: { color: "#1e2130" }, horzLines: { color: "#1e2130" } },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: "#2a2d3e" },
      timeScale: { borderColor: "#2a2d3e", timeVisible: true, secondsVisible: false },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });
    candleSeriesRef.current = candleSeries;
    markersRef.current = createSeriesMarkers(candleSeries, []);

    chartRef.current = chart;

    const observer = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      markersRef.current = null;
    };
  }, []);

  // Update candlestick data when bars change
  useEffect(() => {
    if (!candleSeriesRef.current || bars.length === 0) return;
    candleSeriesRef.current.setData(barsToCandles(bars));
    chartRef.current?.timeScale().fitContent();
  }, [bars]);

  // Update overlay indicators
  useEffect(() => {
    if (!chartRef.current || bars.length === 0) return;
    // This is a simplified version — a full implementation would compute
    // indicators client-side or fetch from backend. For now we show a placeholder.
    // The overlay series will be populated when indicator data is available from backend.
  }, [overlayIndicators, bars]);

  // Update trade markers when backtest result changes
  useEffect(() => {
    if (!markersRef.current || !backtestResult) return;

    const markers: SeriesMarker<UTCTimestamp>[] = [];
    for (const trade of backtestResult.trades) {
      markers.push({
        time: trade.entry_ts as UTCTimestamp,
        position: trade.direction === "long" ? "belowBar" : "aboveBar",
        shape: trade.direction === "long" ? "arrowUp" : "arrowDown",
        color: trade.direction === "long" ? "#22c55e" : "#ef4444",
        text: trade.direction === "long" ? "BUY" : "SELL",
        size: 1,
      });
      markers.push({
        time: trade.exit_ts as UTCTimestamp,
        position: trade.direction === "long" ? "aboveBar" : "belowBar",
        shape: trade.direction === "long" ? "arrowDown" : "arrowUp",
        color: trade.pnl >= 0 ? "#22c55e" : "#ef4444",
        text: `${trade.pnl >= 0 ? "+" : ""}${trade.pnl_pct.toFixed(1)}%`,
        size: 1,
      });
    }

    markers.sort((a, b) => (a.time as number) - (b.time as number));
    markersRef.current.setMarkers(markers);
  }, [backtestResult]);

  // The chart container must stay the same, empty element across renders, so the
  // empty-state message is an overlay rather than a different container.
  return (
    <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
      {bars.length === 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--color-muted)",
            fontSize: "14px",
            background: "var(--color-bg)",
            zIndex: 1,
          }}
        >
          Select a symbol and click "Load Data" to view the chart
        </div>
      )}
    </div>
  );
}
