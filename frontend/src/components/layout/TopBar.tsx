import { useAppStore, type AppTab } from "../../store/useAppStore";

const TABS: { key: AppTab; label: string }[] = [
  { key: "chart", label: "Chart" },
  { key: "scanner", label: "Scanner" },
  { key: "strategy", label: "Strategy" },
  { key: "results", label: "Results" },
];

export default function TopBar() {
  const { activeTab, setActiveTab, backtestResult } = useAppStore();

  return (
    <div
      style={{
        background: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        height: "44px",
        flexShrink: 0,
        gap: "24px",
      }}
    >
      <span style={{ fontWeight: 600, fontSize: "15px", color: "var(--color-accent)", letterSpacing: "-0.3px" }}>
        Signal or Noise
      </span>

      <div style={{ display: "flex", gap: "4px" }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              background: activeTab === tab.key ? "var(--color-accent)" : "transparent",
              color: activeTab === tab.key ? "#fff" : "var(--color-muted)",
              padding: "4px 12px",
              fontSize: "13px",
              borderRadius: "4px",
              position: "relative",
            }}
          >
            {tab.label}
            {tab.key === "results" && backtestResult && (
              <span
                style={{
                  position: "absolute",
                  top: "-3px",
                  right: "-3px",
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "var(--color-green)",
                }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
