import { useState } from "react";
import { RULE_INFO, RULE_TYPES, makeRule, ruleSummary, type RuleParam } from "../../types/rules";
import type { PatternRule, RuleType } from "../../types/strategy";

interface Props {
  rules: PatternRule[];
  onChange: (rules: PatternRule[]) => void;
}

export default function RuleList({ rules, onChange }: Props) {
  // A newly added rule opens so its settings are visible
  const [open, setOpen] = useState<number | null>(null);

  function update(i: number, rule: PatternRule) {
    onChange(rules.map((r, idx) => (idx === i ? rule : r)));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {rules.length === 0 && (
        <div style={{ fontSize: "12px", color: "var(--color-muted)", fontStyle: "italic" }}>
          No pattern rules: entries use the indicator conditions only
        </div>
      )}
      {rules.map((rule, i) => (
        <div key={i} style={{ border: "1px solid var(--color-border)", borderRadius: "6px", background: "var(--color-surface)" }}>
          <div
            onClick={() => setOpen(open === i ? null : i)}
            style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 8px", cursor: "pointer" }}
          >
            <span style={{ color: "var(--color-muted)", fontSize: "10px", width: "10px" }}>{open === i ? "▼" : "▶"}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "12px", fontWeight: 600 }}>{RULE_INFO[rule.type].label}</div>
              <div style={{ fontSize: "11px", color: "var(--color-muted)" }}>{ruleSummary(rule)}</div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onChange(rules.filter((_, idx) => idx !== i));
                setOpen(null);
              }}
              title="Remove rule"
              style={{ background: "transparent", color: "var(--color-red)", padding: "2px 6px", fontSize: "14px" }}
            >
              ×
            </button>
          </div>
          {open === i && <RuleEditor rule={rule} onChange={(r) => update(i, r)} />}
        </div>
      ))}

      <select
        value=""
        onChange={(e) => {
          if (!e.target.value) return;
          onChange([...rules, makeRule(e.target.value as RuleType)]);
          setOpen(rules.length);
        }}
        style={{ width: "100%", fontSize: "12px", color: "var(--color-muted)", border: "1px dashed var(--color-border)" }}
      >
        <option value="">+ Add rule…</option>
        {RULE_TYPES.map((t) => (
          <option key={t} value={t} title={RULE_INFO[t].description}>{RULE_INFO[t].label}</option>
        ))}
      </select>
    </div>
  );
}

function RuleEditor({ rule, onChange }: { rule: PatternRule; onChange: (r: PatternRule) => void }) {
  const info = RULE_INFO[rule.type];
  // The period only applies to moving averages
  const visible = info.params.filter((p) => !(p.name === "length" && rule.params.line === "VWAP"));

  return (
    <div style={{ padding: "4px 8px 10px 26px", display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ fontSize: "11px", color: "var(--color-muted)", lineHeight: 1.4 }}>{info.description}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: "8px" }}>
        {visible.map((p) => (
          <ParamField
            key={p.name}
            param={p}
            value={rule.params[p.name] ?? p.default}
            onChange={(v) => onChange({ ...rule, params: { ...rule.params, [p.name]: v } })}
          />
        ))}
      </div>
    </div>
  );
}

function ParamField({ param, value, onChange }: { param: RuleParam; value: number | string; onChange: (v: number | string) => void }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "11px", color: "var(--color-muted)", marginBottom: "3px" }}>
        {param.label}{param.kind === "number" && param.unit ? ` (${param.unit})` : ""}
      </label>
      {param.kind === "choice" ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", fontSize: "12px" }}>
          {param.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input
          type="number"
          min={param.min}
          max={param.max}
          step={param.step ?? 1}
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value);
            onChange(Math.min(param.max, Math.max(param.min, Number.isFinite(v) ? v : param.default)));
          }}
          style={{ width: "100%", fontSize: "12px" }}
        />
      )}
    </div>
  );
}
