import { useEffect, useRef } from "react";
import { createChart, LineSeries, type UTCTimestamp } from "lightweight-charts";
import type { EquityPoint } from "../../types/backtest";

interface Props {
  data: EquityPoint[];
}

export default function EquityCurve({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    const chart = createChart(containerRef.current, {
      layout: { background: { color: "#0f1117" }, textColor: "#94a3b8" },
      grid: { vertLines: { color: "#1e2130" }, horzLines: { color: "#1e2130" } },
      rightPriceScale: { borderColor: "#2a2d3e" },
      timeScale: { borderColor: "#2a2d3e", timeVisible: true },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });

    const series = chart.addSeries(LineSeries, {
      color: "#3b82f6",
      lineWidth: 2,
    });

    series.setData(data.map((p) => ({ time: p.t as UTCTimestamp, value: p.equity })));
    chart.timeScale().fitContent();

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
    };
  }, [data]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
