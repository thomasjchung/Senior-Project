import { STRATEGY_STYLES, type StrategyStyle } from "../../types/strategyStyles";
import StyleIcon from "./StyleIcon";

interface Props {
  onPick: (style: StrategyStyle) => void;
  onCancel?: () => void;
}

export default function StylePicker({ onPick, onCancel }: Props) {
  return (
    <div style={{ padding: "16px", overflowY: "auto", flex: 1 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "4px" }}>
        <div style={{ fontSize: "16px", fontWeight: 600 }}>What is your strategy based on?</div>
        {onCancel && (
          <button onClick={onCancel} style={{ background: "transparent", color: "var(--color-muted)", fontSize: "12px" }}>
            Cancel
          </button>
        )}
      </div>
      <div style={{ fontSize: "12px", color: "var(--color-muted)", marginBottom: "14px" }}>
        Pick a starting point. Every rule it adds can be changed or removed, and you can add more.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "10px" }}>
        {STRATEGY_STYLES.map((s) => (
          <button
            key={s.id}
            onClick={() => onPick(s)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: "6px",
              textAlign: "left",
              padding: "12px",
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "8px",
              color: "var(--color-text)",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--color-accent)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--color-border)")}
          >
            <StyleIcon id={s.id} />
            <div style={{ fontWeight: 600, fontSize: "13px" }}>{s.name}</div>
            <div style={{ fontSize: "12px", color: "var(--color-muted)", lineHeight: 1.4 }}>{s.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
