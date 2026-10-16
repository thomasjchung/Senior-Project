import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createSeriesMarkers,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type LineSeriesPartialOptions,
  type MouseEventParams,
  type SeriesMarker,
  type SeriesType,
  type UTCTimestamp,
} from "lightweight-charts";
import { useAppStore, type Drawing, type DrawingPoint, type DrawingTool, type OverlayIndicator } from "../../store/useAppStore";
import { barsToCandles, barsToVolume, fibLevels, indicatorToLine, linePriceAt, overlayTitle, trendLineData } from "../../utils/chartHelpers";
import { bollinger, ema, macd, rsi, sma, stochastic } from "../../utils/indicators";

const LINE_A = "#3b82f6";
const LINE_B = "#f59e0b";
const GUIDE_COLOR = "rgba(148, 163, 184, 0.4)";
const SUPPORT_COLOR = "#22c55e";
const RESISTANCE_COLOR = "#ef4444";
const PREVIEW_COLOR = "rgba(148, 163, 184, 0.9)";
const FIB_COLORS: Record<number, string> = {
  0: "#94a3b8",
  0.236: "#ef4444",
  0.382: "#f59e0b",
  0.5: "#22c55e",
  0.618: "#06b6d4",
  0.786: "#3b82f6",
  1: "#94a3b8",
};

const roleColor = (role: Drawing["role"]) => (role === "support" ? SUPPORT_COLOR : RESISTANCE_COLOR);

const drawingLineOptions = (color: string): LineSeriesPartialOptions => ({
  color,
  lineWidth: 2,
  priceLineVisible: false,
  lastValueVisible: false,
  crosshairMarkerVisible: false,
  // Drawings shouldn't rescale the price axis
  autoscaleInfoProvider: () => null,
});

const TOOLS: { tool: DrawingTool; label: string; hint: string }[] = [
  { tool: "hline", label: "― Horizontal", hint: "Click the chart to place a horizontal line" },
  { tool: "trend", label: "╱ Trend line", hint: "Click two points on the chart to draw a trend line" },
  { tool: "fib", label: "≡ Fibonacci", hint: "Click the swing start, then the swing end" },
];

export default function ChartContainer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any>(null);
  const indicatorSeriesRef = useRef<ISeriesApi<SeriesType>[]>([]);
  const drawingSeriesRef = useRef<ISeriesApi<"Line">[]>([]);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  // First click of a trend line in progress
  const [pendingPoint, setPendingPoint] = useState<DrawingPoint | null>(null);

  const {
    bars, warmupBars, loadedSymbol, overlayIndicators, subPaneIndicators, backtestResult,
    drawings, activeDrawingTool, setActiveDrawingTool, addDrawing, clearDrawings,
  } = useAppStore();
  const symbolDrawings = drawings.filter((d) => d.symbol === loadedSymbol);

  const selectTool = (tool: DrawingTool | null) => {
    setActiveDrawingTool(tool);
    setPendingPoint(null);
  };

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
      drawingSeriesRef.current = [];
      priceLinesRef.current = [];
      markersRef.current = null;
    };
  }, []);

  // Update candlestick data when bars change
  useEffect(() => {
    if (!candleSeriesRef.current || bars.length === 0) return;
    candleSeriesRef.current.setData(barsToCandles(bars));
    chartRef.current?.timeScale().fitContent();
  }, [bars]);

  // Render saved drawings for the loaded symbol
  useEffect(() => {
    const chart = chartRef.current;
    const candles = candleSeriesRef.current;
    if (!chart || !candles) return;

    for (const line of priceLinesRef.current) candles.removePriceLine(line);
    for (const series of drawingSeriesRef.current) chart.removeSeries(series);
    priceLinesRef.current = [];
    drawingSeriesRef.current = [];
    if (bars.length === 0) return;

    for (const d of drawings) {
      if (d.symbol !== loadedSymbol) continue;
      if (d.tool === "fib") {
        const guide = trendLineData(bars, d.p1, d.p2);
        if (guide) {
          const series = chart.addSeries(LineSeries, { ...drawingLineOptions(PREVIEW_COLOR), lineWidth: 1, lineStyle: LineStyle.Dashed });
          series.setData(guide);
          drawingSeriesRef.current.push(series);
        }
        for (const { ratio, data } of fibLevels(bars, d.p1, d.p2)) {
          const series = chart.addSeries(LineSeries, {
            ...drawingLineOptions(FIB_COLORS[ratio]),
            lineWidth: 1,
            title: String(ratio),
            lastValueVisible: true,
          });
          series.setData(data);
          drawingSeriesRef.current.push(series);
        }
        continue;
      }
      const color = roleColor(d.role);
      if (d.tool === "hline") {
        priceLinesRef.current.push(
          candles.createPriceLine({
            price: d.p1.price,
            color,
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            axisLabelVisible: true,
            title: d.role === "support" ? "S" : "R",
          })
        );
      } else {
        const data = trendLineData(bars, d.p1, d.p2);
        if (!data) continue;
        const series = chart.addSeries(LineSeries, drawingLineOptions(color));
        series.setData(data);
        drawingSeriesRef.current.push(series);
      }
    }
  }, [bars, drawings, loadedSymbol]);

  // Place drawings with clicks while a drawing tool is active
  useEffect(() => {
    const chart = chartRef.current;
    const candles = candleSeriesRef.current;
    if (!chart || !candles || !activeDrawingTool || bars.length === 0) return;

    const lastBar = bars[bars.length - 1];
    let preview: ISeriesApi<"Line"> | null = null;

    const toPoint = (param: MouseEventParams): DrawingPoint | null => {
      if (!param.point || param.logical == null || (param.paneIndex ?? 0) !== 0) return null;
      const price = candles.coordinateToPrice(param.point.y);
      if (price == null) return null;
      const i = Math.min(Math.max(Math.round(param.logical), 0), bars.length - 1);
      return { time: bars[i].t, price };
    };

    const onClick = (param: MouseEventParams) => {
      const pt = toPoint(param);
      if (!pt) return;
      if (activeDrawingTool === "hline") {
        const role = pt.price < lastBar.c ? "support" : "resistance";
        addDrawing({ symbol: loadedSymbol, tool: "hline", role, p1: pt, p2: pt });
        selectTool(null);
      } else if (!pendingPoint) {
        setPendingPoint(pt);
      } else if (pt.time !== pendingPoint.time) {
        if (activeDrawingTool === "fib") {
          addDrawing({ symbol: loadedSymbol, tool: "fib", p1: pendingPoint, p2: pt });
        } else {
          // Support if the line sits below the latest close where it reaches the last bar
          const role = linePriceAt(pendingPoint, pt, lastBar.t) < lastBar.c ? "support" : "resistance";
          addDrawing({ symbol: loadedSymbol, tool: "trend", role, p1: pendingPoint, p2: pt });
        }
        selectTool(null);
      }
    };

    // setData fires crosshairMove synchronously, so updating the preview inside the
    // handler recurses forever. Defer it to the next frame and skip unchanged points.
    let frame = 0;
    let lastPreview: DrawingPoint | null = null;
    const onMove = (param: MouseEventParams) => {
      if (!pendingPoint) return;
      const pt = toPoint(param);
      if (!pt || (pt.time === lastPreview?.time && pt.price === lastPreview.price)) return;
      lastPreview = pt;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        preview ??= chart.addSeries(LineSeries, { ...drawingLineOptions(PREVIEW_COLOR), lineStyle: LineStyle.Dashed });
        preview.setData(trendLineData(bars, pendingPoint, pt) ?? []);
      });
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") selectTool(null);
    };

    chart.subscribeClick(onClick);
    chart.subscribeCrosshairMove(onMove);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      cancelAnimationFrame(frame);
      // The chart may already be removed if the component is unmounting
      if (chartRef.current !== chart) return;
      chart.unsubscribeClick(onClick);
      chart.unsubscribeCrosshairMove(onMove);
      if (preview) chart.removeSeries(preview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDrawingTool, pendingPoint, bars, loadedSymbol]);

  // Rebuild overlay and sub-pane indicator series
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    for (const series of indicatorSeriesRef.current) chart.removeSeries(series);
    indicatorSeriesRef.current = [];
    for (let i = chart.panes().length - 1; i > 0; i--) chart.removePane(i);
    if (bars.length === 0) return;

    const added = indicatorSeriesRef.current;
    // Indicators run over warm-up + visible bars, then the warm-up part is dropped,
    // so lines span the whole visible chart.
    const allBars = [...warmupBars, ...bars];
    const visible = (values: number[]) => values.slice(warmupBars.length);
    const close = allBars.map((b) => b.c);
    const sourceValues = (o: OverlayIndicator) => allBars.map((b) => (o.source === "open" ? b.o : b.c));

    const addLine = (paneIndex: number, values: number[], color: string, title = "", lineStyle: LineStyle = LineStyle.Solid) => {
      const series = chart.addSeries(
        LineSeries,
        {
          color,
          lineWidth: 1,
          lineStyle,
          title,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        },
        paneIndex
      );
      series.setData(indicatorToLine(bars, visible(values)));
      added.push(series);
      return series;
    };
    const addGuides = (series: ISeriesApi<"Line">, levels: number[]) => {
      for (const price of levels) {
        series.createPriceLine({ price, color: GUIDE_COLOR, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false });
      }
    };

    for (const o of overlayIndicators) {
      if (!o.visible) continue;
      const values = sourceValues(o);
      const title = overlayTitle(o);
      if (o.kind === "SMA") addLine(0, sma(values, o.length), o.color, title);
      else if (o.kind === "EMA") addLine(0, ema(values, o.length), o.color, title);
      else if (o.kind === "BB") {
        const bb = bollinger(values, o.length, o.stdDev);
        addLine(0, bb.upper, o.color, title);
        addLine(0, bb.middle, o.color, "", LineStyle.Dashed);
        addLine(0, bb.lower, o.color);
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
        const histValues = visible(m.hist);
        hist.setData(
          bars.flatMap((b, j) =>
            isNaN(histValues[j])
              ? []
              : [{ time: b.t as UTCTimestamp, value: histValues[j], color: histValues[j] >= 0 ? "rgba(34, 197, 94, 0.5)" : "rgba(239, 68, 68, 0.5)" }]
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
        const st = stochastic(allBars.map((b) => b.h), allBars.map((b) => b.l), close, Number(params[0]), Number(params[1]), Number(params[2]));
        addGuides(addLine(pane, st.k, LINE_A, "%K"), [80, 20]);
        addLine(pane, st.d, LINE_B, "%D");
      }
    });

    // Give the price pane most of the height
    chart.panes().forEach((p, i) => p.setStretchFactor(i === 0 ? 3 : 1));
  }, [bars, warmupBars, overlayIndicators, subPaneIndicators]);

  // Update trade markers when backtest result changes
  useEffect(() => {
    if (!markersRef.current || !backtestResult) return;

    const markers: SeriesMarker<UTCTimestamp>[] = [];
    for (const trade of backtestResult.trades) {
      // Scanner backtests trade many stocks; only mark this chart's
      if (trade.symbol && trade.symbol !== loadedSymbol) continue;
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
  }, [backtestResult, loadedSymbol]);

  // The chart container must stay the same, empty element across renders, so the
  // empty-state message is an overlay rather than a different container.
  return (
    <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0, cursor: activeDrawingTool ? "crosshair" : undefined }} />
      {bars.length > 0 && (
        <div style={{ position: "absolute", top: 8, left: 8, zIndex: 2, display: "flex", gap: "4px" }}>
          {TOOLS.map(({ tool, label }) => (
            <button
              key={tool}
              onClick={() => selectTool(activeDrawingTool === tool ? null : tool)}
              style={{
                ...toolButtonStyle,
                ...(activeDrawingTool === tool && { background: "var(--color-accent)", color: "#fff" }),
              }}
            >
              {label}
            </button>
          ))}
          {symbolDrawings.length > 0 && (
            <button onClick={() => clearDrawings(loadedSymbol)} style={toolButtonStyle}>
              Clear lines
            </button>
          )}
        </div>
      )}
      {activeDrawingTool && (
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 8,
            zIndex: 2,
            fontSize: "12px",
            color: "var(--color-muted)",
            pointerEvents: "none",
          }}
        >
          {pendingPoint ? "Click the second point" : TOOLS.find((t) => t.tool === activeDrawingTool)?.hint} · Esc to cancel
        </div>
      )}
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

const toolButtonStyle: React.CSSProperties = {
  fontSize: "12px",
  padding: "4px 8px",
  background: "var(--color-surface2)",
  border: "1px solid var(--color-border)",
  borderRadius: "4px",
};
