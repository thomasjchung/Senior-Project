import { ENTRY_TRIGGERS, STOP_TYPES, type EntryTrigger, type StopType, type StrategyConfig } from "../../types/strategy";

interface Props {
  config: StrategyConfig;
  onChange: (c: StrategyConfig) => void;
}

type TargetMode = "rr" | "pct" | "none";

export default function RiskReward({ config, onChange }: Props) {
  const set = (patch: Partial<StrategyConfig>) => onChange({ ...config, ...patch });
  const trigger = config.entry_trigger ?? "close";
  const stopType = config.stop_type ?? "percent";
  const hasPullback = (config.entry_rules ?? []).some((r) => r.type === "pullback");
  const hasStop = stopType !== "percent" || config.stop_loss_pct != null;
  const target: TargetMode = config.reward_risk != null ? "rr" : config.take_profit_pct != null ? "pct" : "none";

  function setTarget(mode: TargetMode) {
    if (mode === "rr") set({ reward_risk: config.reward_risk ?? 2, take_profit_pct: null });
    else if (mode === "pct") set({ reward_risk: null, take_profit_pct: config.take_profit_pct ?? 5 });
    else set({ reward_risk: null, take_profit_pct: null });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <Field label="Enter">
        <select value={trigger} onChange={(e) => set({ entry_trigger: e.target.value as EntryTrigger })} style={{ width: "100%" }}>
          {ENTRY_TRIGGERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <Help>{ENTRY_TRIGGERS.find((t) => t.value === trigger)?.help}</Help>
      </Field>

      <Field label="Stop-loss">
        <div style={{ display: "flex", gap: "6px" }}>
          <select value={stopType} onChange={(e) => set({ stop_type: e.target.value as StopType })} style={{ flex: 1 }}>
            {STOP_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {stopType === "percent" && (
            <input
              type="number"
              min={0}
              step={0.5}
              placeholder="None"
              value={config.stop_loss_pct ?? ""}
              onChange={(e) => set({ stop_loss_pct: e.target.value ? Number(e.target.value) : null })}
              style={{ width: "80px" }}
              title="Stop-loss %"
            />
          )}
        </div>
        {stopType === "pullback_low" && !hasPullback && (
          <Help error>Add a "Pullback holds the move" rule, or pick another stop.</Help>
        )}
        {stopType !== "percent" && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px", fontSize: "12px" }}>
            <span style={{ color: "var(--color-muted)" }}>Skip the trade if the stop is more than</span>
            <input
              type="number"
              min={0}
              step={1}
              placeholder="Any"
              value={config.max_risk_pct ?? ""}
              onChange={(e) => set({ max_risk_pct: e.target.value ? Number(e.target.value) : null })}
              style={{ width: "70px" }}
            />
            <span style={{ color: "var(--color-muted)" }}>% below the entry</span>
          </div>
        )}
      </Field>

      <Field label="Take profit">
        <div style={{ display: "flex", gap: "6px" }}>
          <select value={target} onChange={(e) => setTarget(e.target.value as TargetMode)} style={{ flex: 1 }}>
            <option value="rr">Reward : risk ratio</option>
            <option value="pct">Fixed % above entry</option>
            <option value="none">None (exit on signal or stop)</option>
          </select>
          {target === "rr" && (
            <input
              type="number"
              min={0.1}
              step={0.5}
              value={config.reward_risk ?? ""}
              onChange={(e) => set({ reward_risk: e.target.value ? Math.max(0.1, Number(e.target.value)) : null })}
              style={{ width: "80px" }}
              title="Reward multiple of the risk"
            />
          )}
          {target === "pct" && (
            <input
              type="number"
              min={0}
              step={0.5}
              value={config.take_profit_pct ?? ""}
              onChange={(e) => set({ take_profit_pct: e.target.value ? Number(e.target.value) : null })}
              style={{ width: "80px" }}
              title="Take-profit %"
            />
          )}
        </div>
        {target === "rr" && config.reward_risk != null && (
          hasStop
            ? <Help>{`${config.reward_risk}:1. Risking $1 (entry to stop) to make $${config.reward_risk}.`}</Help>
            : <Help error>A reward : risk target needs a stop-loss to measure the risk.</Help>
        )}
      </Field>

      <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={config.exit_end_of_day ?? false}
          onChange={(e) => set({ exit_end_of_day: e.target.checked })}
          style={{ width: "auto", padding: 0 }}
        />
        Close positions by the end of each day (intraday timeframes; scanner backtests always do)
      </label>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "11px", color: "var(--color-muted)", marginBottom: "3px" }}>{label}</label>
      {children}
    </div>
  );
}

function Help({ children, error }: { children: React.ReactNode; error?: boolean }) {
  return (
    <div style={{ fontSize: "11px", color: error ? "var(--color-red)" : "var(--color-muted)", marginTop: "4px", lineHeight: 1.4 }}>
      {children}
    </div>
  );
}
