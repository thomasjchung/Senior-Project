import { useState } from "react";
import type { Trade } from "../../types/backtest";
import { fmtDate, fmtDateTime, fmtPrice, fmtPct } from "../../utils/formatters";

interface Props {
  trades: Trade[];
  onOpenTrade?: (t: Trade) => void;
}

type SortKey = "entry_ts" | "symbol" | "pnl" | "pnl_pct" | "exit_reason";

export default function TradeLog({ trades, onOpenTrade }: Props) {
  // Scanner backtests trade many stocks within the day
  const multiSymbol = trades.some((t) => t.symbol);
  const fmtTime = multiSymbol ? (ts: number) => `${fmtDate(ts)} ${fmtDateTime(ts).split(" ")[1]}` : fmtDate;
  const [sortKey, setSortKey] = useState<SortKey>("entry_ts");
  const [sortAsc, setSortAsc] = useState(true);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  const sorted = [...trades].sort((a, b) => {
    const av = (a[sortKey] ?? "") as number | string;
    const bv = (b[sortKey] ?? "") as number | string;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortAsc ? cmp : -cmp;
  });

  const Col = ({ label, k }: { label: string; k: SortKey }) => (
    <th
      onClick={() => toggleSort(k)}
      style={{ cursor: "pointer", userSelect: "none", color: sortKey === k ? "var(--color-accent)" : "var(--color-muted)" }}
    >
      {label} {sortKey === k ? (sortAsc ? "↑" : "↓") : ""}
    </th>
  );

  return (
    <div style={{ overflowY: "auto", height: "100%", padding: "12px" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
            {multiSymbol && <Col label="Symbol" k="symbol" />}
            <Col label="Entry" k="entry_ts" />
            <th style={{ color: "var(--color-muted)" }}>Exit</th>
            <th style={{ color: "var(--color-muted)" }}>Dir</th>
            <th style={{ color: "var(--color-muted)" }}>Entry $</th>
            <th style={{ color: "var(--color-muted)" }}>Exit $</th>
            <Col label="P&L" k="pnl" />
            <Col label="P&L %" k="pnl_pct" />
            <Col label="Reason" k="exit_reason" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((t, i) => (
            <tr
              key={i}
              onClick={onOpenTrade && (() => onOpenTrade(t))}
              title={onOpenTrade ? "Open in chart" : undefined}
              style={{
                cursor: onOpenTrade ? "pointer" : undefined,
                borderBottom: "1px solid var(--color-border)",
                background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
              }}
            >
              {multiSymbol && <td style={{ padding: "5px 4px", fontWeight: 600 }}>{t.symbol}</td>}
              <td style={{ padding: "5px 4px" }}>{fmtTime(t.entry_ts)}</td>
              <td style={{ padding: "5px 4px" }}>{fmtTime(t.exit_ts)}</td>
              <td style={{ padding: "5px 4px", color: t.direction === "long" ? "var(--color-green)" : "var(--color-red)", fontWeight: 600 }}>
                {t.direction === "long" ? "L" : "S"}
              </td>
              <td style={{ padding: "5px 4px" }}>{fmtPrice(t.entry_price)}</td>
              <td style={{ padding: "5px 4px" }}>{fmtPrice(t.exit_price)}</td>
              <td style={{ padding: "5px 4px", color: t.pnl >= 0 ? "var(--color-green)" : "var(--color-red)" }}>
                {t.pnl >= 0 ? "+" : ""}{fmtPrice(t.pnl)}
              </td>
              <td style={{ padding: "5px 4px", color: t.pnl_pct >= 0 ? "var(--color-green)" : "var(--color-red)" }}>
                {fmtPct(t.pnl_pct)}
              </td>
              <td style={{ padding: "5px 4px", color: "var(--color-muted)", fontSize: "11px" }}>
                {t.exit_reason}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {trades.length === 0 && (
        <div style={{ textAlign: "center", color: "var(--color-muted)", fontSize: "13px", paddingTop: "24px" }}>
          No trades generated
        </div>
      )}
    </div>
  );
}
