import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { useAppStore } from "../../store/useAppStore";
import { useOpenInChart } from "../../hooks/useOHLCV";
import { useStrategies } from "../../hooks/useStrategies";
import { useBacktestRun, useBacktestRuns, useDeleteRun, useUpdateRun } from "../../hooks/useBacktestRuns";
import type { BacktestRun, Trade } from "../../types/backtest";
import MetricsGrid from "./MetricsGrid";
import EquityCurve from "./EquityCurve";
import TradeLog from "./TradeLog";
import RunHistory from "./RunHistory";
import RunSettings from "./RunSettings";

type ResultTab = "metrics" | "equity" | "trades" | "settings";

export default function ResultsDashboard() {
  const { isRunningBacktest, activeRunId, setActiveRunId, setBacktestResult } = useAppStore();
  const { data: runs } = useBacktestRuns();
  // Default to the most recent run
  const selectedId = activeRunId ?? runs?.[0]?.id ?? null;
  const { data: run, isLoading } = useBacktestRun(selectedId);

  // The chart's trade markers follow the run being viewed
  useEffect(() => {
    if (run) setBacktestResult(run.result);
  }, [run, setBacktestResult]);

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      <RunHistory selectedId={selectedId} onSelect={setActiveRunId} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {isRunningBacktest ? (
          <Centered>Running backtest… (scanner backtests download intraday data on the first run, which can take a few minutes)</Centered>
        ) : run ? (
          <RunView key={run.id} run={run} />
        ) : (
          <Centered>{isLoading ? "Loading…" : "Run a backtest to see results"}</Centered>
        )}
      </div>
    </div>
  );
}

function RunView({ run }: { run: BacktestRun }) {
  const {
    setActiveStrategy, setActiveSavedId, setSymbol, setTimeframe, setStartDate, setEndDate, setActiveTab, setActiveRunId,
  } = useAppStore();
  const [tab, setTab] = useState<ResultTab>("metrics");
  const openInChart = useOpenInChart();
  const { data: strategies } = useStrategies();
  const updateRun = useUpdateRun();
  const deleteRun = useDeleteRun();
  const result = run.result;

  // Scanner trades: show that stock on the day it was traded
  const openTrade = (t: Trade) => {
    const day = dayjs.unix(t.entry_ts).format("YYYY-MM-DD");
    openInChart(t.symbol ?? run.symbol ?? "", run.timeframe, day, dayjs(day).add(1, "day").format("YYYY-MM-DD"));
  };

  function loadSettings() {
    setActiveStrategy(run.config);
    // Re-attach to the saved strategy only if it still exists
    setActiveSavedId(strategies?.some((s) => s.id === run.strategy_id) ? run.strategy_id : null);
    if (run.symbol) setSymbol(run.symbol);
    setTimeframe(run.timeframe);
    setStartDate(run.start);
    setEndDate(run.end);
    setActiveTab("strategy");
  }

  function remove() {
    if (!confirm(`Delete the "${run.name}" run from ${dayjs.unix(run.ran_at).format("MMM D, h:mm A")}?`)) return;
    deleteRun.mutate(run.id);
    setActiveRunId(null);
  }

  const tabLabel = (t: ResultTab) =>
    t === "equity" ? "Equity Curve" : t === "trades" ? `Trades (${result.trades.length})` : t === "settings" ? "Settings & notes" : "Metrics";

  return (
    <>
      <div style={{ padding: "10px 12px 0" }}>
        <div style={{ fontSize: "15px", fontWeight: 600 }}>{run.name}</div>
        <div style={{ fontSize: "12px", color: "var(--color-muted)" }}>
          {run.universe_type === "scanner" ? "Scanner matches" : run.symbol} · {run.timeframe} ·{" "}
          {dayjs(run.start).format("MMM D, YYYY")} – {dayjs(run.end).format("MMM D, YYYY")} · ran{" "}
          {dayjs.unix(run.ran_at).format("MMM D, YYYY h:mm A")}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--color-border)", padding: "0 12px" }}>
        {(["metrics", "equity", "trades", "settings"] as ResultTab[]).map((t) => (
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
            }}
          >
            {tabLabel(t)}
          </button>
        ))}
      </div>

      {result.universe && tab !== "settings" && (
        <div style={{ padding: "8px 12px 0", fontSize: "12px", color: "var(--color-muted)" }}>
          {result.universe.symbols} stocks on {result.universe.candidate_days} days could have met the criteria
          {result.universe.float_unknown > 0 && ` · ${result.universe.float_unknown} stocks skipped for unknown float`}
          {" · click a trade to see it on the chart"}
        </div>
      )}

      {/* Tab content */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {tab === "metrics" && <MetricsGrid metrics={result.metrics} />}
        {tab === "equity" && <EquityCurve data={result.equity_curve} />}
        {tab === "trades" && <TradeLog trades={result.trades} onOpenTrade={result.universe ? openTrade : undefined} />}
        {tab === "settings" && (
          <RunSettings
            run={run}
            onLoad={loadSettings}
            onDelete={remove}
            onSaveNotes={(notes) => updateRun.mutate({ id: run.id, notes })}
          />
        )}
      </div>
    </>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-muted)", fontSize: "14px", padding: "24px", textAlign: "center" }}>
      {children}
    </div>
  );
}
