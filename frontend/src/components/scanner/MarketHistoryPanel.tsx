import { useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import { getHistoryStatus, startHistorySync } from "../../api/scanner";
import type { HistoryStatus, NeedsHistory } from "../../types/scanner";
import { labelStyle } from "./styles";

interface Props {
  // Range a scan or backtest asked for; pre-fills the download range
  needed?: NeedsHistory | null;
  onDownloaded?: () => void;
}

function coverageText(months: HistoryStatus["months"]): string {
  if (months.length === 0) return "No market history downloaded yet.";
  const first = dayjs(`${months[0].month}-01`).format("MMM YYYY");
  const last = dayjs(months[months.length - 1].through_day).format("MMM D, YYYY");
  return `Downloaded: ${first} – ${last} (${months.length} month${months.length === 1 ? "" : "s"})`;
}

export default function MarketHistoryPanel({ needed, onDownloaded }: Props) {
  const [status, setStatus] = useState<HistoryStatus | null>(null);
  const [start, setStart] = useState(needed?.start ?? dayjs().subtract(6, "month").format("YYYY-MM-DD"));
  const [end, setEnd] = useState(needed?.end ?? dayjs().subtract(1, "day").format("YYYY-MM-DD"));
  const [error, setError] = useState<string | null>(null);
  const wasRunning = useRef(false);

  const [prevNeeded, setPrevNeeded] = useState(needed);
  if (needed !== prevNeeded) {
    setPrevNeeded(needed);
    if (needed) {
      setStart(needed.start);
      setEnd(needed.end);
    }
  }

  // Poll while a download runs
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const s = await getHistoryStatus();
        if (cancelled) return;
        setStatus(s);
        if (wasRunning.current && !s.running && !s.error) onDownloaded?.();
        wasRunning.current = s.running;
        if (s.running) timer = setTimeout(poll, 1500);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't get download status");
      }
    };
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // Restart polling when a download is started from this panel
  }, [status?.running]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDownload() {
    setError(null);
    try {
      wasRunning.current = true;
      setStatus(await startHistorySync(start, end));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed to start");
    }
  }

  const running = status?.running ?? false;
  const pct = status && status.total > 0 ? Math.round((status.done / status.total) * 100) : 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        padding: "10px",
        background: "var(--color-surface2)",
        border: "1px solid var(--color-border)",
        borderRadius: "6px",
        fontSize: "12px",
      }}
    >
      <div style={{ fontWeight: 600 }}>Market history</div>
      <div style={{ color: "var(--color-muted)" }}>
        Past scans and scanner backtests need every stock's daily bars. Downloading takes about a minute per month of
        history and only has to happen once.
      </div>
      {status && <div>{coverageText(status.months)}</div>}

      {running ? (
        <div>
          <div style={{ marginBottom: "4px" }}>
            Downloading {status?.start} → {status?.end}… {pct}%
          </div>
          <div style={{ height: "6px", background: "var(--color-border)", borderRadius: "3px", overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: "var(--color-accent)", transition: "width 0.5s" }} />
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <div>
              <label style={labelStyle}>From</label>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={{ width: "100%" }} />
            </div>
            <div>
              <label style={labelStyle}>To</label>
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={{ width: "100%" }} />
            </div>
          </div>
          <button onClick={handleDownload} style={{ background: "var(--color-accent)", color: "#fff" }}>
            Download history
          </button>
        </>
      )}

      {(error || status?.error) && <div style={{ color: "var(--color-red)" }}>{error ?? status?.error}</div>}
    </div>
  );
}
