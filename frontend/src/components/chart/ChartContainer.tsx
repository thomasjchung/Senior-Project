import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type SeriesMarker,
  type SeriesType,
  type UTCTimestamp,
} from "lightweight-charts";
import { useAppStore } from "../../store/useAppStore";
import { barsToCandles, barsToVolume, indicatorToLine } from "../../utils/chartHelpers";
import { bollinger, ema, macd, rsi, sma, stochastic } from "../../utils/indicators";

const OVERLAY_COLORS: Record<string, string> = {
  SMA_20: "#f59e0b",
  SMA_50: "#a855f7",
  EMA_20: "#06b6d4",
  EMA_50: "#ec4899",
};
const BB_COLOR = "rgba(148, 163, 184, 0.8)";
const LINE_A = "#3b82f6";
const LINE_B = "#f59e0b";
const GUIDE_COLOR = "rgba(148, 163, 184, 0.4)";

export default function ChartContainer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any>(null);
  const indicatorSeriesRef = useRef<ISeriesApi<SeriesType>[]>([]);

  const { bars, overlayIndicators, subPaneIndicators, backtestResult } = useAppStore();

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
      indicatorSeriesRef.current = [];
      markersRef.current = null;
    };
  }, []);

  // Update candlestick data when bars change
  useEffect(() => {
    if (!candleSeriesRef.current || bars.length === 0) return;
    candleSeriesRef.current.setData(barsToCandles(bars));
    chartRef.current?.timeScale().fitContent();
  }, [bars]);

  // Rebuild overlay and sub-pane indicator series
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    for (const series of indicatorSeriesRef.current) chart.removeSeries(series);
    indicatorSeriesRef.current = [];
    for (let i = chart.panes().length - 1; i > 0; i--) chart.removePane(i);
    if (bars.length === 0) return;

    const added = indicatorSeriesRef.current;
    const close = bars.map((b) => b.c);

    const addLine = (paneIndex: number, values: number[], color: string, title = "") => {
      const series = chart.addSeries(
        LineSeries,
        {
          color,
          lineWidth: 1,
          title,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        },
        paneIndex
      );
      series.setData(indicatorToLine(bars, values));
      added.push(series);
      return series;
    };
    const addGuides = (series: ISeriesApi<"Line">, levels: number[]) => {
      for (const price of levels) {
        series.createPriceLine({ price, color: GUIDE_COLOR, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false });
      }
    };

    for (const key of overlayIndicators) {
      const [kind, ...params] = key.split("_");
      if (kind === "SMA") addLine(0, sma(close, Number(params[0])), OVERLAY_COLORS[key] ?? LINE_A, key);
      else if (kind === "EMA") addLine(0, ema(close, Number(params[0])), OVERLAY_COLORS[key] ?? LINE_A, key);
      else if (kind === "BB") {
        const bb = bollinger(close, Number(params[0]), Number(params[1]));
        addLine(0, bb.upper, BB_COLOR, "BB");
        addLine(0, bb.middle, BB_COLOR);
        addLine(0, bb.lower, BB_COLOR);
      }
    }

    subPaneIndicators.forEach((key, i) => {
      const pane = i + 1;
      const [kind, ...params] = key.split("_");
      if (kind === "RSI") {
        addGuides(addLine(pane, rsi(close, Number(params[0])), "#a855f7", key), [70, 30]);
      } else if (kind === "MACD") {
        const m = macd(close, Number(params[0]), Number(params[1]), Number(params[2]));
        const hist = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, pane);
        hist.setData(
          bars.flatMap((b, j) =>
            isNaN(m.hist[j])
              ? []
              : [{ time: b.t as UTCTimestamp, value: m.hist[j], color: m.hist[j] >= 0 ? "rgba(34, 197, 94, 0.5)" : "rgba(239, 68, 68, 0.5)" }]
          )
        );
        added.push(hist);
        addLine(pane, m.line, LINE_A, "MACD");
        addLine(pane, m.signal, LINE_B, "Signal");
      } else if (kind === "VOLUME") {
        const vol = chart.addSeries(
          HistogramSeries,
          { priceLineVisible: false, lastValueVisible: false, priceFormat: { type: "volume" }, title: "Volume" },
          pane
        );
        vol.setData(barsToVolume(bars));
        added.push(vol);
      } else if (kind === "STOCH") {
        const st = stochastic(bars.map((b) => b.h), bars.map((b) => b.l), close, Number(params[0]), Number(params[1]), Number(params[2]));
        addGuides(addLine(pane, st.k, LINE_A, "%K"), [80, 20]);
        addLine(pane, st.d, LINE_B, "%D");
      }
    });

    // Give the price pane most of the height
    chart.panes().forEach((p, i) => p.setStretchFactor(i === 0 ? 3 : 1));
  }, [bars, overlayIndicators, subPaneIndicators]);

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
