import { useState } from "react";
import dayjs from "dayjs";
import type { BacktestRun } from "../../types/backtest";
import {
  ENTRY_TRIGGERS, INDICATOR_LABELS, OPERATOR_LABELS, PRICE_OPERATORS, STOP_TYPES,
  type Condition, type PatternRule,
} from "../../types/strategy";
import type { ScanCriteria } from "../../types/scanner";
import { RULE_INFO, ruleSummary } from "../../types/rules";
import { styleById } from "../../types/strategyStyles";
import { fmtPrice } from "../../utils/formatters";

interface Props {
  run: BacktestRun;
  onLoad: () => void;
  onDelete: () => void;
  onSaveNotes: (notes: string) => void;
}

function conditionText(c: Condition): string {
  const params = Object.values(c.params);
  const ind = `${INDICATOR_LABELS[c.indicator]}${params.length ? ` (${params.join(", ")})` : ""}`;
  return PRICE_OPERATORS.has(c.operator)
    ? `${OPERATOR_LABELS[c.operator]} ${ind}`
    : `${ind} ${OPERATOR_LABELS[c.operator]} ${c.value}`;
}

function ruleDetails(rule: PatternRule): string {
  return RULE_INFO[rule.type].params
    .filter((p) => !(p.name === "length" && rule.params.line === "VWAP"))
    .map((p) => {
      const v = rule.params[p.name] ?? p.default;
      const shown = p.kind === "choice" ? p.options.find((o) => o.value === v)?.label ?? v : v;
      return `${p.label}: ${shown}${p.kind === "number" && p.unit ? ` ${p.unit}` : ""}`;
    })
    .join(" · ");
}

function criteriaText(c: ScanCriteria): string[] {
  const m = (v: number) => `${+(v / 1e6).toFixed(2)}M`;
  const out = [];
  if (c.min_price != null || c.max_price != null) out.push(`Price ${c.min_price != null ? `$${c.min_price}` : "any"} – ${c.max_price != null ? `$${c.max_price}` : "any"}`);
  if (c.min_change_pct != null) out.push(`Up at least ${c.min_change_pct}% on the day`);
  if (c.min_rvol != null) out.push(`Relative volume at least ${c.min_rvol}× (${c.avg_volume_days}-day average)`);
  if (c.min_volume != null) out.push(`Volume at least ${m(c.min_volume)} shares`);
  if (c.max_float != null) out.push(`Float under ${m(c.max_float)} shares${c.include_unknown_float ? " (unknown float included)" : ""}`);
  return out.length ? out : ["No filters"];
}

export default function RunSettings({ run, onLoad, onDelete, onSaveNotes }: Props) {
  const cfg = run.config;
  const [notes, setNotes] = useState(run.notes);
  const universe = cfg.universe ?? { type: "symbol" as const };
  const stop = cfg.stop_type ?? "percent";
  const rules = cfg.entry_rules ?? [];
  const style = styleById(cfg.style);

  const stopText =
    stop === "percent"
      ? cfg.stop_loss_pct != null ? `${cfg.stop_loss_pct}% below entry` : "None"
      : STOP_TYPES.find((s) => s.value === stop)?.label.replace(" (needs a pullback rule)", "");
  const targetText =
    cfg.reward_risk != null ? `${cfg.reward_risk} : 1 reward to risk`
      : cfg.take_profit_pct != null ? `${cfg.take_profit_pct}% above entry` : "None";

  return (
    <div style={{ overflowY: "auto", height: "100%", padding: "12px 16px" }}>
      <div style={{ maxWidth: "760px", display: "flex", flexDirection: "column", gap: "14px" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={onLoad} style={{ background: "var(--color-accent)", color: "#fff", fontSize: "12px" }}>
            Load these settings into the strategy editor
          </button>
          <button onClick={onDelete} style={{ background: "transparent", color: "var(--color-red)", fontSize: "12px", border: "1px solid var(--color-border)" }}>
            Delete run
          </button>
        </div>

        <Block title="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== run.notes && onSaveNotes(notes)}
            placeholder="What were you testing? What did you learn? (saved when you click away)"
            rows={3}
            style={{ width: "100%", resize: "vertical", fontFamily: "inherit", fontSize: "13px" }}
          />
        </Block>

        <Block title="Run">
          <Row k="Strategy" v={cfg.name} />
          {style && <Row k="Based on" v={style.name} />}
          <Row k="Ran" v={dayjs.unix(run.ran_at).format("MMM D, YYYY h:mm A")} />
          <Row k="Stocks" v={universe.type === "scanner" ? "Scanner matches at the time" : run.symbol ?? ""} />
          <Row k="Timeframe" v={run.timeframe} />
          <Row k="Dates" v={`${dayjs(run.start).format("MMM D, YYYY")} – ${dayjs(run.end).format("MMM D, YYYY")}`} />
          <Row k="Starting capital" v={fmtPrice(run.initial_capital)} />
        </Block>

        {universe.type === "scanner" && (
          <Block title="Scanner criteria">
            {criteriaText(universe.criteria).map((t) => <Row key={t} v={t} />)}
            <Row v={universe.regular_hours_only ? "Regular hours only (9:30 AM – 4:00 PM ET)" : "Pre-market and regular hours (from 4:00 AM ET)"} />
          </Block>
        )}

        <Block title="Setup rules">
          {rules.length === 0 && <Row v="None" />}
          {rules.map((r, i) => (
            <div key={i} style={{ fontSize: "13px" }}>
              <div>{ruleSummary(r)}</div>
              <div style={{ fontSize: "11px", color: "var(--color-muted)" }}>{ruleDetails(r)}</div>
            </div>
          ))}
        </Block>

        <Block title={`Indicator conditions (${cfg.logic})`}>
          <Row k="Entry" v={cfg.entry_conditions.length ? cfg.entry_conditions.map(conditionText).join("; ") : "None"} />
          <Row k="Exit" v={cfg.exit_conditions.length ? cfg.exit_conditions.map(conditionText).join("; ") : "None"} />
        </Block>

        <Block title="Entry & risk">
          <Row k="Enter" v={ENTRY_TRIGGERS.find((t) => t.value === (cfg.entry_trigger ?? "close"))?.label ?? ""} />
          <Row k="Stop-loss" v={stopText ?? ""} />
          {cfg.max_risk_pct != null && stop !== "percent" && <Row k="Max stop distance" v={`${cfg.max_risk_pct}% below entry`} />}
          <Row k="Take profit" v={targetText} />
          <Row k="Close by end of day" v={cfg.exit_end_of_day || universe.type === "scanner" ? "Yes" : "No"} />
          <Row k="Direction" v={cfg.direction} />
          <Row k="Position size" v={`${cfg.position_size_pct}% of capital`} />
        </Block>
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--color-muted)", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: "6px" }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>{children}</div>
    </div>
  );
}

function Row({ k, v }: { k?: string; v: string }) {
  return (
    <div style={{ display: "flex", gap: "8px", fontSize: "13px" }}>
      {k && <span style={{ color: "var(--color-muted)", minWidth: "140px" }}>{k}</span>}
      <span style={{ textTransform: k === "Direction" ? "capitalize" : undefined }}>{v}</span>
    </div>
  );
}
