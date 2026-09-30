import { useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import MetricsGrid from "./MetricsGrid";
import EquityCurve from "./EquityCurve";
import TradeLog from "./TradeLog";

type ResultTab = "metrics" | "equity" | "trades";

export default function ResultsDashboard() {
  const { backtestResult, isRunningBacktest } = useAppStore();
  const [tab, setTab] = useState<ResultTab>("metrics");

  if (isRunningBacktest) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-muted)" }}>
        Running backtest...
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

      {/* Tab content */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {tab === "metrics" && <MetricsGrid metrics={backtestResult.metrics} />}
        {tab === "equity" && <EquityCurve data={backtestResult.equity_curve} />}
        {tab === "trades" && <TradeLog trades={backtestResult.trades} />}
      </div>
    </div>
  );
}
