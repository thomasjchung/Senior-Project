import { useEffect, useRef } from "react";
import { createChart, type IChartApi, type DeepPartial, type ChartOptions } from "lightweight-charts";

export function useLightweightChart(
  containerRef: React.RefObject<HTMLDivElement | null>,
  options: DeepPartial<ChartOptions>
) {
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "#0f1117" },
        textColor: "#94a3b8",
      },
      grid: {
        vertLines: { color: "#1e2130" },
        horzLines: { color: "#1e2130" },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: "#2a2d3e",
      },
      timeScale: {
        borderColor: "#2a2d3e",
        timeVisible: true,
        secondsVisible: false,
      },
      ...options,
    });

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
    };
  }, []); // only mount once

  return chartRef;
}
