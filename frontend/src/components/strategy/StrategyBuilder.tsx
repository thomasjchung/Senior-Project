import { useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import { useCreateStrategy, useUpdateStrategy } from "../../hooks/useStrategies";
import { useRunBacktest } from "../../hooks/useBacktest";
import { makeBlankStrategy, type LogicKey } from "../../types/strategy";
import ConditionGroup from "./ConditionGroup";
import StrategyParams from "./StrategyParams";
import StrategyList from "./StrategyList";
import UniversePicker from "./UniversePicker";
import MarketHistoryPanel from "../scanner/MarketHistoryPanel";

export default function StrategyBuilder() {
  const {
    activeStrategy, setActiveStrategy, activeSavedId, setActiveSavedId, isRunningBacktest, backtestError,
    backtestNeedsHistory,
  } = useAppStore();
  const createMutation = useCreateStrategy();
  const updateMutation = useUpdateStrategy();
  const runBacktest = useRunBacktest();

  const [nameInput, setNameInput] = useState(activeStrategy.name);
  const [saveError, setSaveError] = useState<string | null>(null);

  function handleNew() {
    const s = makeBlankStrategy();
    setActiveStrategy(s);
    setActiveSavedId(null);
    setNameInput(s.name);
  }

  async function handleSave() {
    setSaveError(null);
    const config = { ...activeStrategy, name: nameInput };
    try {
      if (activeSavedId) {
        await updateMutation.mutateAsync({ id: activeSavedId, name: nameInput, config });
      } else {
        const res = await createMutation.mutateAsync({ name: nameInput, config });
        setActiveSavedId(res.id);
      }
      setActiveStrategy(config);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Saved strategies list */}
      <Section title="Saved Strategies">
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
          <button onClick={handleNew} style={{ background: "var(--color-surface2)", color: "var(--color-text)", fontSize: "12px" }}>
            + New
          </button>
        </div>
        <StrategyList />
      </Section>

      {/* Strategy editor */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
        {/* Name */}
        <div style={{ marginBottom: "12px" }}>
          <label style={labelStyle}>Strategy Name</label>
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            style={{ width: "100%" }}
            placeholder="My Strategy"
          />
        </div>

        <div style={{ marginBottom: "12px" }}>
          <SectionTitle>Stocks to trade</SectionTitle>
          <UniversePicker
            universe={activeStrategy.universe ?? { type: "symbol" }}
            onChange={(universe) => setActiveStrategy({ ...activeStrategy, universe })}
          />
        </div>

        <ConditionGroup
          title="Entry Conditions"
          conditions={activeStrategy.entry_conditions}
          logic={activeStrategy.logic as LogicKey}
          onLogicChange={(l) => setActiveStrategy({ ...activeStrategy, logic: l })}
          onChange={(conds) => setActiveStrategy({ ...activeStrategy, entry_conditions: conds })}
        />

        <ConditionGroup
          title="Exit Conditions"
          conditions={activeStrategy.exit_conditions}
          logic={activeStrategy.logic as LogicKey}
          onLogicChange={(l) => setActiveStrategy({ ...activeStrategy, logic: l })}
          onChange={(conds) => setActiveStrategy({ ...activeStrategy, exit_conditions: conds })}
        />

        <div style={{ marginBottom: "12px" }}>
          <SectionTitle>Parameters</SectionTitle>
          <StrategyParams
            config={activeStrategy}
            onChange={setActiveStrategy}
          />
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ padding: "12px", borderTop: "1px solid var(--color-border)", display: "flex", flexDirection: "column", gap: "8px" }}>
        {saveError && <div style={{ color: "var(--color-red)", fontSize: "12px" }}>{saveError}</div>}
        {backtestError && <div style={{ color: "var(--color-red)", fontSize: "12px" }}>{backtestError}</div>}
        {backtestNeedsHistory && <MarketHistoryPanel needed={backtestNeedsHistory} />}
        <button
          onClick={handleSave}
          disabled={createMutation.isPending || updateMutation.isPending}
          style={{ background: "var(--color-surface2)", color: "var(--color-text)", border: "1px solid var(--color-border)" }}
        >
          {activeSavedId ? "Update Strategy" : "Save Strategy"}
        </button>
        <button
          onClick={runBacktest}
          disabled={isRunningBacktest}
          style={{ background: "var(--color-accent)", color: "#fff", fontWeight: 600 }}
        >
          {isRunningBacktest ? "Running..." : "▶ Run Backtest"}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "12px", borderBottom: "1px solid var(--color-border)" }}>
      <SectionTitle>{title}</SectionTitle>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--color-muted)", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: "8px" }}>
      {children}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "11px",
  color: "var(--color-muted)",
  marginBottom: "3px",
};
