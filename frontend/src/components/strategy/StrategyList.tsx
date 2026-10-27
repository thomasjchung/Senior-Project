import { useStrategies, useDeleteStrategy } from "../../hooks/useStrategies";
import { useAppStore } from "../../store/useAppStore";

export default function StrategyList({ onSelect }: { onSelect?: () => void }) {
  const { data: strategies, isLoading } = useStrategies();
  const deleteMutation = useDeleteStrategy();
  const { activeSavedId, setActiveStrategy, setActiveSavedId } = useAppStore();

  if (isLoading) return <div style={{ color: "var(--color-muted)", fontSize: "13px" }}>Loading...</div>;
  if (!strategies?.length) return <div style={{ color: "var(--color-muted)", fontSize: "13px", fontStyle: "italic" }}>No saved strategies</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {strategies.map((s) => (
        <div
          key={s.id}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "6px 8px",
            borderRadius: "4px",
            background: activeSavedId === s.id ? "var(--color-accent)" : "var(--color-surface2)",
            cursor: "pointer",
            fontSize: "13px",
          }}
          onClick={() => {
            setActiveStrategy(s.config);
            setActiveSavedId(s.id);
            onSelect?.();
          }}
        >
          <span style={{ fontWeight: activeSavedId === s.id ? 600 : 400 }}>{s.name}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Delete "${s.name}"?`)) {
                deleteMutation.mutate(s.id);
                if (activeSavedId === s.id) setActiveSavedId(null);
              }
            }}
            style={{ background: "transparent", color: "var(--color-red)", padding: "0 4px", fontSize: "14px" }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
