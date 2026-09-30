import type { StrategyConfig, DirectionKey } from "../../types/strategy";

interface Props {
  config: StrategyConfig;
  onChange: (c: StrategyConfig) => void;
}

export default function StrategyParams({ config, onChange }: Props) {
  function set(field: keyof StrategyConfig, val: unknown) {
    onChange({ ...config, [field]: val });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <FieldRow label="Direction">
        <select
          value={config.direction}
          onChange={(e) => set("direction", e.target.value as DirectionKey)}
          style={{ width: "100%" }}
        >
          <option value="long">Long</option>
          <option value="short">Short</option>
          <option value="both">Both</option>
        </select>
      </FieldRow>

      <FieldRow label="Position Size (%)">
        <input
          type="number"
          value={config.position_size_pct}
          min={1}
          max={100}
          onChange={(e) => set("position_size_pct", Number(e.target.value))}
          style={{ width: "100%" }}
        />
      </FieldRow>

      <FieldRow label="Stop-loss (%)">
        <input
          type="number"
          value={config.stop_loss_pct ?? ""}
          min={0}
          step="0.5"
          placeholder="None"
          onChange={(e) => set("stop_loss_pct", e.target.value ? Number(e.target.value) : null)}
          style={{ width: "100%" }}
        />
      </FieldRow>

      <FieldRow label="Take-profit (%)">
        <input
          type="number"
          value={config.take_profit_pct ?? ""}
          min={0}
          step="0.5"
          placeholder="None"
          onChange={(e) => set("take_profit_pct", e.target.value ? Number(e.target.value) : null)}
          style={{ width: "100%" }}
        />
      </FieldRow>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <span style={{ fontSize: "12px", color: "var(--color-muted)", minWidth: "120px" }}>{label}</span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}
