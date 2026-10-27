import { isLongOnly, type StrategyConfig, type DirectionKey } from "../../types/strategy";

interface Props {
  config: StrategyConfig;
  onChange: (c: StrategyConfig) => void;
}

export default function StrategyParams({ config, onChange }: Props) {
  function set(field: keyof StrategyConfig, val: unknown) {
    onChange({ ...config, [field]: val });
  }
  const longOnly = isLongOnly(config);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <FieldRow label="Direction">
        <select
          value={longOnly ? "long" : config.direction}
          disabled={longOnly}
          title={longOnly ? "Pattern rules, breakout entries and setup stops are long-only" : undefined}
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
