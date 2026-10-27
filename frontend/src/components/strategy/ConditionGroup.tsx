import { type Condition, type LogicKey, makeBlankCondition } from "../../types/strategy";
import ConditionRow from "./ConditionRow";

interface Props {
  title: string;
  conditions: Condition[];
  logic: LogicKey;
  onLogicChange: (l: LogicKey) => void;
  onChange: (conditions: Condition[]) => void;
  emptyText?: string;
}

export default function ConditionGroup({ title, conditions, logic, onLogicChange, onChange, emptyText }: Props) {
  function update(i: number, c: Condition) {
    const next = [...conditions];
    next[i] = c;
    onChange(next);
  }

  function remove(i: number) {
    onChange(conditions.filter((_, idx) => idx !== i));
  }

  function add() {
    onChange([...conditions, makeBlankCondition()]);
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {title}
        </span>
        <div style={{ display: "flex", gap: "4px" }}>
          {(["AND", "OR"] as LogicKey[]).map((l) => (
            <button
              key={l}
              onClick={() => onLogicChange(l)}
              style={{
                background: logic === l ? "var(--color-accent)" : "var(--color-surface2)",
                color: logic === l ? "#fff" : "var(--color-muted)",
                padding: "2px 8px",
                fontSize: "11px",
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {conditions.length === 0 && (
          <div style={{ fontSize: "12px", color: "var(--color-muted)", fontStyle: "italic" }}>
            {emptyText ?? "No conditions — position will only use stop-loss/take-profit"}
          </div>
        )}
        {conditions.map((cond, i) => (
          <ConditionRow
            key={i}
            condition={cond}
            onChange={(c) => update(i, c)}
            onRemove={() => remove(i)}
          />
        ))}
      </div>

      <button
        onClick={add}
        style={{
          marginTop: "8px",
          background: "transparent",
          border: "1px dashed var(--color-border)",
          color: "var(--color-muted)",
          width: "100%",
          padding: "5px",
          fontSize: "12px",
        }}
      >
        + Add Condition
      </button>
    </div>
  );
}
