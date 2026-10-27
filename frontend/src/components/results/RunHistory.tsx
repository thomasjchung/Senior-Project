import dayjs from "dayjs";
import { useBacktestRuns } from "../../hooks/useBacktestRuns";
import { fmtPct } from "../../utils/formatters";

interface Props {
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export default function RunHistory({ selectedId, onSelect }: Props) {
  const { data: runs, isLoading } = useBacktestRuns();

  return (
    <div style={{ width: "260px", minWidth: "260px", borderRight: "1px solid var(--color-border)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "12px 12px 8px", fontSize: "10px", fontWeight: 700, color: "var(--color-muted)", letterSpacing: "0.8px", textTransform: "uppercase" }}>
        Backtest history{runs?.length ? ` (${runs.length})` : ""}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 8px", display: "flex", flexDirection: "column", gap: "4px" }}>
        {isLoading && <div style={{ color: "var(--color-muted)", fontSize: "12px", padding: "4px" }}>Loading…</div>}
        {runs?.length === 0 && (
          <div style={{ color: "var(--color-muted)", fontSize: "12px", fontStyle: "italic", padding: "4px" }}>
            Every backtest you run is saved here
          </div>
        )}
        {runs?.map((r) => {
          const selected = r.id === selectedId;
          const ret = r.metrics.total_return_pct;
          return (
            <button
              key={r.id}
              onClick={() => onSelect(r.id)}
              style={{
                textAlign: "left",
                padding: "8px",
                borderRadius: "6px",
                border: `1px solid ${selected ? "var(--color-accent)" : "transparent"}`,
                background: selected ? "var(--color-surface2)" : "transparent",
                color: "var(--color-text)",
                display: "flex",
                flexDirection: "column",
                gap: "2px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                <span style={{ fontSize: "12px", fontWeight: 600, color: ret >= 0 ? "var(--color-green)" : "var(--color-red)" }}>{fmtPct(ret)}</span>
              </div>
              <div style={{ fontSize: "11px", color: "var(--color-muted)" }}>
                {r.universe_type === "scanner" ? "Scanner" : r.symbol} · {r.timeframe} · {r.metrics.total_trades} trades
              </div>
              <div style={{ fontSize: "11px", color: "var(--color-muted)" }}>
                {dayjs(r.start).format(dayjs(r.start).year() === dayjs(r.end).year() ? "MMM D" : "MMM D, YYYY")} – {dayjs(r.end).format("MMM D, YYYY")} · ran {dayjs.unix(r.ran_at).format("MMM D, h:mm A")}
              </div>
              {r.notes && (
                <div style={{ fontSize: "11px", color: "var(--color-text)", opacity: 0.8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  ✎ {r.notes}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
