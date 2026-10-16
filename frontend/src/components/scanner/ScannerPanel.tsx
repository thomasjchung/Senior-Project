import { useCallback, useEffect, useState } from "react";
import dayjs from "dayjs";
import { ApiError } from "../../api/client";
import { runHistoricalScan, runLiveScan } from "../../api/scanner";
import { useOpenInChart } from "../../hooks/useOHLCV";
import { makeBlankCriteria, type NeedsHistory, type ScanCriteria, type ScanRow } from "../../types/scanner";
import CriteriaEditor from "./CriteriaEditor";
import { labelStyle } from "./styles";
import MarketHistoryPanel from "./MarketHistoryPanel";

type Mode = "live" | "historical";

const LIVE_REFRESH_MS = 60_000;

function fmtShares(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toFixed(0);
}

export default function ScannerPanel() {
  const openInChart = useOpenInChart();
  const [mode, setMode] = useState<Mode>("live");
  const [criteria, setCriteria] = useState<ScanCriteria>(makeBlankCriteria);
  const [date, setDate] = useState(dayjs().subtract(1, "day").format("YYYY-MM-DD"));
  const [autoRefresh, setAutoRefresh] = useState(false);

  const [rows, setRows] = useState<ScanRow[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsHistory, setNeedsHistory] = useState<NeedsHistory | null>(null);
  const [scanning, setScanning] = useState(false);

  const scan = useCallback(async () => {
    setScanning(true);
    setError(null);
    setNeedsHistory(null);
    try {
      if (mode === "live") {
        const res = await runLiveScan(criteria);
        setRows(res.rows);
        setNote(
          `Top ${res.candidates} gainers checked` +
            (res.as_of ? ` · as of ${dayjs(res.as_of).format("h:mm A")}` : "") +
            " · volume is IEX-only on the free data plan"
        );
      } else {
        const res = await runHistoricalScan(criteria, date);
        setRows(res.rows);
        setNote(
          `Matches at the close of ${dayjs(res.day).format("MMM D, YYYY")} · full-market volume` +
            (res.truncated ? " · showing the top 500" : "")
        );
      }
    } catch (e) {
      setRows(null);
      setError(e instanceof Error ? e.message : "Scan failed");
      if (e instanceof ApiError && e.data?.needs_history) setNeedsHistory(e.data.needs_history as NeedsHistory);
    } finally {
      setScanning(false);
    }
  }, [mode, criteria, date]);

  useEffect(() => {
    if (mode !== "live" || !autoRefresh) return;
    const id = setInterval(scan, LIVE_REFRESH_MS);
    return () => clearInterval(id);
  }, [mode, autoRefresh, scan]);

  function openRow(r: ScanRow) {
    if (mode === "live") {
      openInChart(r.symbol, "5Min", dayjs().subtract(5, "day").format("YYYY-MM-DD"), dayjs().add(1, "day").format("YYYY-MM-DD"));
    } else {
      openInChart(r.symbol, "5Min", date, dayjs(date).add(1, "day").format("YYYY-MM-DD"));
    }
  }

  const showFloat = rows?.some((r) => r.float_shares !== undefined);

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      <div
        style={{
          width: "300px",
          minWidth: "300px",
          borderRight: "1px solid var(--color-border)",
          padding: "12px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", gap: "4px" }}>
          {(["live", "historical"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setRows(null);
                setError(null);
                setNeedsHistory(null);
              }}
              style={{
                flex: 1,
                background: mode === m ? "var(--color-accent)" : "var(--color-surface2)",
                color: mode === m ? "#fff" : "var(--color-text)",
              }}
            >
              {m === "live" ? "Live" : "Past date"}
            </button>
          ))}
        </div>

        {mode === "historical" && (
          <div>
            <label style={labelStyle}>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: "100%" }} />
          </div>
        )}

        <CriteriaEditor criteria={criteria} onChange={setCriteria} />

        <button
          onClick={scan}
          disabled={scanning}
          style={{ background: "var(--color-accent)", color: "#fff", fontWeight: 600 }}
        >
          {scanning ? "Scanning…" : "Run scan"}
        </button>

        {mode === "live" && (
          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              style={{ width: "auto", padding: 0 }}
            />
            Refresh every minute
          </label>
        )}

        {mode === "historical" && <MarketHistoryPanel needed={needsHistory} onDownloaded={() => needsHistory && scan()} />}
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "12px" }}>
        {error && <div style={{ color: "var(--color-red)", fontSize: "13px", marginBottom: "8px" }}>{error}</div>}
        {note && rows && <div style={{ color: "var(--color-muted)", fontSize: "12px", marginBottom: "8px" }}>{note}</div>}

        {rows && rows.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left", color: "var(--color-muted)" }}>
                <th style={cellStyle}>Symbol</th>
                <th style={cellStyle}>Price</th>
                <th style={cellStyle}>Change</th>
                {mode === "historical" && <th style={cellStyle}>Day high</th>}
                <th style={cellStyle}>Volume</th>
                <th style={cellStyle}>Rel. volume</th>
                {showFloat && <th style={cellStyle}>Float</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.symbol}
                  onClick={() => openRow(r)}
                  title={`${r.name} — click to open in the chart`}
                  style={{ borderBottom: "1px solid var(--color-border)", cursor: "pointer" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  <td style={cellStyle}>
                    <div style={{ fontWeight: 600 }}>{r.symbol}</div>
                    <div style={{ fontSize: "11px", color: "var(--color-muted)", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.name}
                    </div>
                  </td>
                  <td style={cellStyle}>${r.price.toFixed(2)}</td>
                  <td style={{ ...cellStyle, color: r.change_pct >= 0 ? "var(--color-green)" : "var(--color-red)" }}>
                    {r.change_pct >= 0 ? "+" : ""}{r.change_pct.toFixed(1)}%
                  </td>
                  {mode === "historical" && (
                    <td style={{ ...cellStyle, color: "var(--color-muted)" }}>
                      {r.high_change_pct != null ? `+${r.high_change_pct.toFixed(1)}%` : "—"}
                    </td>
                  )}
                  <td style={cellStyle}>{fmtShares(r.volume)}</td>
                  <td style={cellStyle}>{r.rvol != null ? `${r.rvol.toFixed(1)}×` : "—"}</td>
                  {showFloat && <td style={cellStyle}>{fmtShares(r.float_shares)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {rows && rows.length === 0 && (
          <div style={{ color: "var(--color-muted)", fontSize: "13px", paddingTop: "24px", textAlign: "center" }}>
            No stocks match these criteria
          </div>
        )}
        {!rows && !error && (
          <div style={{ color: "var(--color-muted)", fontSize: "13px", paddingTop: "24px", textAlign: "center" }}>
            Set your criteria (or load a preset) and run a scan
          </div>
        )}
      </div>
    </div>
  );
}

const cellStyle: React.CSSProperties = { padding: "6px 8px" };
