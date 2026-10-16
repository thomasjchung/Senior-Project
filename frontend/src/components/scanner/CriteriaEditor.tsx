import { SCAN_PRESETS, makeBlankCriteria, type ScanCriteria } from "../../types/scanner";
import { labelStyle } from "./styles";

interface Props {
  criteria: ScanCriteria;
  onChange: (c: ScanCriteria) => void;
}

type NumericKey = Exclude<keyof ScanCriteria, "include_unknown_float" | "avg_volume_days">;

// Displayed in different units than the API uses (e.g. float in millions of shares)
const FIELDS: { key: NumericKey; label: string; unit?: string; scale?: number; step?: number }[] = [
  { key: "min_price", label: "Min price", unit: "$", step: 0.5 },
  { key: "max_price", label: "Max price", unit: "$", step: 0.5 },
  { key: "min_change_pct", label: "Min % change", unit: "%", step: 1 },
  { key: "min_rvol", label: "Min relative volume", unit: "×", step: 0.5 },
  { key: "min_volume", label: "Min volume", unit: "M sh", scale: 1_000_000, step: 0.1 },
  { key: "max_float", label: "Max float", unit: "M sh", scale: 1_000_000, step: 1 },
];

export default function CriteriaEditor({ criteria, onChange }: Props) {
  const set = (patch: Partial<ScanCriteria>) => onChange({ ...criteria, ...patch });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div>
        <label style={labelStyle}>Preset</label>
        <select
          value=""
          onChange={(e) => {
            if (e.target.value === "clear") onChange(makeBlankCriteria());
            else if (e.target.value) onChange({ ...SCAN_PRESETS[Number(e.target.value)].criteria });
          }}
          style={{ width: "100%" }}
        >
          <option value="">Load a preset…</option>
          {SCAN_PRESETS.map((p, i) => (
            <option key={p.name} value={i} title={p.description}>{p.name}</option>
          ))}
          <option value="clear">Clear all filters</option>
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        {FIELDS.map(({ key, label, unit, scale = 1, step }) => {
          const value = criteria[key];
          return (
            <div key={key}>
              <label style={labelStyle}>{label}{unit ? ` (${unit})` : ""}</label>
              <input
                type="number"
                min={0}
                step={step}
                placeholder="Any"
                value={value == null ? "" : +(value / scale).toFixed(4)}
                onChange={(e) => set({ [key]: e.target.value === "" ? null : Number(e.target.value) * scale })}
                style={{ width: "100%" }}
              />
            </div>
          );
        })}
      </div>

      <div>
        <label style={labelStyle}>Relative volume average (trading days)</label>
        <input
          type="number"
          min={1}
          max={250}
          value={criteria.avg_volume_days}
          onChange={(e) => set({ avg_volume_days: Math.max(1, Number(e.target.value) || 1) })}
          style={{ width: "100%" }}
        />
      </div>

      {criteria.max_float != null && (
        <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={criteria.include_unknown_float}
            onChange={(e) => set({ include_unknown_float: e.target.checked })}
            style={{ width: "auto", padding: 0 }}
          />
          Include stocks with unknown float
        </label>
      )}
    </div>
  );
}
