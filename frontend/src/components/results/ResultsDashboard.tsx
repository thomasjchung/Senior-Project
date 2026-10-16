import { useState } from "react";
import dayjs from "dayjs";
import { useAppStore } from "../../store/useAppStore";
import { useOpenInChart } from "../../hooks/useOHLCV";
import type { Trade } from "../../types/backtest";
import MetricsGrid from "./MetricsGrid";
import EquityCurve from "./EquityCurve";
import TradeLog from "./TradeLog";

type ResultTab = "metrics" | "equity" | "trades";

export default function ResultsDashboard() {
  const { backtestResult, isRunningBacktest, symbol, timeframe } = useAppStore();
  const [tab, setTab] = useState<ResultTab>("metrics");
  const openInChart = useOpenInChart();

  // Scanner trades: show that stock on the day it was traded
  const openTrade = (t: Trade) => {
    const day = dayjs.unix(t.entry_ts).format("YYYY-MM-DD");
    openInChart(t.symbol ?? symbol, timeframe, day, dayjs(day).add(1, "day").format("YYYY-MM-DD"));
  };

  if (isRunningBacktest) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-muted)" }}>
        Running backtest… (scanner backtests download intraday data on the first run, which can take a few minutes)
      </div>
    );
  }

  if (!backtestResult) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-muted)", fontSize: "14px" }}>
        Run a backtest to see results
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--color-border)", padding: "0 12px" }}>
        {(["metrics", "equity", "trades"] as ResultTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: "transparent",
              borderBottom: tab === t ? "2px solid var(--color-accent)" : "2px solid transparent",
              borderRadius: 0,
              color: tab === t ? "var(--color-text)" : "var(--color-muted)",
              padding: "8px 14px",
              fontSize: "13px",
              fontWeight: tab === t ? 600 : 400,
              textTransform: "capitalize",
            }}
          >
            {t === "equity" ? "Equity Curve" : t === "trades" ? `Trades (${backtestResult.trades.length})` : "Metrics"}
          </button>
        ))}
      </div>

      {backtestResult.universe && (
        <div style={{ padding: "8px 12px 0", fontSize: "12px", color: "var(--color-muted)" }}>
          {backtestResult.universe.symbols} stocks on {backtestResult.universe.candidate_days} days could have met the
          criteria
          {backtestResult.universe.float_unknown > 0 &&
            ` · ${backtestResult.universe.float_unknown} stocks skipped for unknown float`}
          {" · click a trade to see it on the chart"}
        </div>
      )}

      {/* Tab content */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {tab === "metrics" && <MetricsGrid metrics={backtestResult.metrics} />}
        {tab === "equity" && <EquityCurve data={backtestResult.equity_curve} />}
        {tab === "trades" && (
          <TradeLog trades={backtestResult.trades} onOpenTrade={backtestResult.universe ? openTrade : undefined} />
        )}
      </div>
    </div>
  );
}
