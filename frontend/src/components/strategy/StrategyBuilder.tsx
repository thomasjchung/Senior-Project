import { useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import { useCreateStrategy, useUpdateStrategy } from "../../hooks/useStrategies";
import { useRunBacktest } from "../../hooks/useBacktest";
import { isLongOnly, makeBlankStrategy, type LogicKey, type StrategyConfig } from "../../types/strategy";
import { styleById } from "../../types/strategyStyles";
import ConditionGroup from "./ConditionGroup";
import StrategyParams from "./StrategyParams";
import StrategyList from "./StrategyList";
import UniversePicker from "./UniversePicker";
import RuleList from "./RuleList";
import RiskReward from "./RiskReward";
import StylePicker from "./StylePicker";
import StyleIcon from "./StyleIcon";
import MarketHistoryPanel from "../scanner/MarketHistoryPanel";

export default function StrategyBuilder() {
  const {
    activeStrategy, setActiveStrategy, activeSavedId, setActiveSavedId, isRunningBacktest, backtestError,
    backtestNeedsHistory, timeframe, setTimeframe,
  } = useAppStore();
  const createMutation = useCreateStrategy();
  const updateMutation = useUpdateStrategy();
  const runBacktest = useRunBacktest();

  const [saveError, setSaveError] = useState<string | null>(null);
  const [changingStyle, setChangingStyle] = useState(false);

  // A brand-new strategy starts by picking its style
  const needsStyle = activeSavedId == null && !activeStrategy.style;
  const style = styleById(activeStrategy.style);

  function update(config: StrategyConfig) {
    setActiveStrategy(isLongOnly(config) ? { ...config, direction: "long" } : config);
  }

  function handleNew() {
    setActiveStrategy(makeBlankStrategy());
    setActiveSavedId(null);
    setChangingStyle(false);
  }

  async function handleSave() {
    setSaveError(null);
    const config = activeStrategy;
    try {
      if (activeSavedId) {
        await updateMutation.mutateAsync({ id: activeSavedId, name: config.name, config });
      } else {
        const res = await createMutation.mutateAsync({ name: config.name, config });
        setActiveSavedId(res.id);
      }
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    }
  }

  const picking = needsStyle || changingStyle;
  // Scanner backtests trade within each day, so they can't run on daily candles
  const needsIntraday = activeStrategy.universe?.type === "scanner" && timeframe === "1Day";

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Saved strategies */}
      <div style={{ width: "220px", minWidth: "220px", borderRight: "1px solid var(--color-border)", padding: "12px", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
          <SectionTitle>Saved Strategies</SectionTitle>
          <button onClick={handleNew} style={{ background: "var(--color-surface2)", color: "var(--color-text)", fontSize: "12px" }}>
            + New
          </button>
        </div>
        <StrategyList onSelect={() => setChangingStyle(false)} />
      </div>

      {picking ? (
        <StylePicker
          onPick={(s) => {
            const config = s.build();
            setActiveStrategy(config);
            setActiveSavedId(null);
            setChangingStyle(false);
          }}
          onCancel={needsStyle ? undefined : () => setChangingStyle(false)}
        />
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
            <div style={{ maxWidth: "760px", display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Style */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "6px" }}>
                <StyleIcon id={style?.id ?? "custom"} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: 600 }}>{style?.name ?? "Custom strategy"}</div>
                  {style?.hint && <div style={{ fontSize: "11px", color: "var(--color-muted)", lineHeight: 1.4 }}>{style.hint}</div>}
                </div>
                <button
                  onClick={() => setChangingStyle(true)}
                  title="Start over from a different style (unsaved changes are lost)"
                  style={{ background: "var(--color-surface2)", color: "var(--color-text)", fontSize: "12px", whiteSpace: "nowrap" }}
                >
                  Change style
                </button>
              </div>

              <div>
                <label style={labelStyle}>Strategy Name</label>
                <input
                  value={activeStrategy.name}
                  onChange={(e) => update({ ...activeStrategy, name: e.target.value })}
                  style={{ width: "100%" }}
                  placeholder="My Strategy"
                />
              </div>

              <div>
                <SectionTitle>Stocks to trade</SectionTitle>
                <UniversePicker
                  universe={activeStrategy.universe ?? { type: "symbol" }}
                  onChange={(universe) => update({ ...activeStrategy, universe })}
                />
              </div>

              <div>
                <SectionTitle>Setup rules (all must hold on the signal candle)</SectionTitle>
                <RuleList
                  rules={activeStrategy.entry_rules ?? []}
                  onChange={(entry_rules) => update({ ...activeStrategy, entry_rules })}
                />
              </div>

              <ConditionGroup
                title="Indicator conditions (entry)"
                conditions={activeStrategy.entry_conditions}
                logic={activeStrategy.logic as LogicKey}
                onLogicChange={(l) => update({ ...activeStrategy, logic: l })}
                onChange={(conds) => update({ ...activeStrategy, entry_conditions: conds })}
                emptyText="None: entries use the setup rules only"
              />

              <div>
                <SectionTitle>Entry & risk</SectionTitle>
                <RiskReward config={activeStrategy} onChange={update} />
                {activeStrategy.exit_end_of_day && timeframe === "1Day" && (
                  <div style={{ fontSize: "11px", color: "var(--color-muted)", marginTop: "4px" }}>
                    The sidebar timeframe is 1Day, so there's nothing to close within the day.
                  </div>
                )}
              </div>

              <ConditionGroup
                title="Exit conditions"
                conditions={activeStrategy.exit_conditions}
                logic={activeStrategy.logic as LogicKey}
                onLogicChange={(l) => update({ ...activeStrategy, logic: l })}
                onChange={(conds) => update({ ...activeStrategy, exit_conditions: conds })}
                emptyText="None: positions exit on the stop-loss, take profit or end of day"
              />

              <div>
                <SectionTitle>Position</SectionTitle>
                <StrategyParams config={activeStrategy} onChange={update} />
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--color-border)", display: "flex", flexDirection: "column", gap: "8px" }}>
            {saveError && <Banner>{saveError}</Banner>}
            {needsIntraday ? (
              <Banner>
                Scanner backtests trade within the day, but the sidebar timeframe is 1Day.{" "}
                <button
                  onClick={() => setTimeframe("5Min")}
                  style={{ marginLeft: "6px", background: "var(--color-accent)", color: "#fff", fontSize: "12px", padding: "3px 10px" }}
                >
                  Use 5Min candles
                </button>
              </Banner>
            ) : (
              backtestError && !isRunningBacktest && <Banner>{backtestError}</Banner>
            )}
            {backtestNeedsHistory && <MarketHistoryPanel needed={backtestNeedsHistory} />}
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
                style={{ flex: 1, background: "var(--color-surface2)", color: "var(--color-text)", border: "1px solid var(--color-border)" }}
              >
                {activeSavedId ? "Update Strategy" : "Save Strategy"}
              </button>
              <button
                onClick={runBacktest}
                disabled={isRunningBacktest || needsIntraday}
                style={{ flex: 2, background: "var(--color-accent)", color: "#fff", fontWeight: 600 }}
              >
                {isRunningBacktest ? "Running..." : "▶ Run Backtest"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      style={{
        color: "var(--color-red)",
        fontSize: "13px",
        padding: "8px 10px",
        border: "1px solid var(--color-red)",
        borderRadius: "6px",
        background: "rgba(239, 68, 68, 0.08)",
      }}
    >
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
