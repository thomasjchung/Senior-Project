import type { BacktestMetrics } from "../../types/backtest";
import { fmtPct, fmtPrice, fmtNumber } from "../../utils/formatters";

interface Props {
  metrics: BacktestMetrics;
}

export default function MetricsGrid({ metrics }: Props) {
  const cards = [
    { label: "Total Return", value: fmtPct(metrics.total_return_pct), positive: metrics.total_return_pct >= 0 },
    { label: "CAGR", value: fmtPct(metrics.cagr_pct), positive: metrics.cagr_pct >= 0 },
    { label: "Sharpe Ratio", value: fmtNumber(metrics.sharpe_ratio, 2), positive: metrics.sharpe_ratio >= 1 },
    { label: "Max Drawdown", value: fmtPct(metrics.max_drawdown_pct, 1), positive: false },
    { label: "Win Rate", value: fmtPct(metrics.win_rate_pct, 1), positive: metrics.win_rate_pct >= 50 },
    { label: "Profit Factor", value: fmtNumber(metrics.profit_factor, 2), positive: metrics.profit_factor >= 1 },
    { label: "Total Trades", value: String(metrics.total_trades), positive: null },
    { label: "Avg Trade", value: fmtPct(metrics.avg_trade_pct), positive: metrics.avg_trade_pct >= 0 },
    { label: "Final Equity", value: fmtPrice(metrics.final_equity), positive: metrics.final_equity >= metrics.initial_capital },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", padding: "12px" }}>
      {cards.map(({ label, value, positive }) => (
        <div
          key={label}
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "6px",
            padding: "10px 12px",
          }}
        >
          <div style={{ fontSize: "11px", color: "var(--color-muted)", marginBottom: "4px" }}>{label}</div>
          <div
            style={{
              fontSize: "16px",
              fontWeight: 600,
              color: positive === null ? "var(--color-text)" : positive ? "var(--color-green)" : "var(--color-red)",
            }}
          >
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}
