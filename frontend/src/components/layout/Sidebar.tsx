import { useState, useRef, useEffect } from "react";
import { useAppStore, type NewOverlay, type OverlayKind, type PriceSource } from "../../store/useAppStore";
import { overlayTitle } from "../../utils/chartHelpers";
import { useLoadBars, WARMUP_BARS } from "../../hooks/useOHLCV";
import { searchSymbols } from "../../api/data";
import { TIMEFRAMES, type Timeframe } from "../../types/ohlcv";
import type { SymbolSearchResult } from "../../types/ohlcv";

const OVERLAY_KINDS: { kind: OverlayKind; label: string }[] = [
  { kind: "SMA", label: "SMA" },
  { kind: "EMA", label: "EMA" },
  { kind: "BB", label: "Bollinger Bands" },
];

// Suggested colors for new overlays, cycled by how many already exist
const OVERLAY_PALETTE = ["#f59e0b", "#a855f7", "#06b6d4", "#ec4899", "#22c55e", "#94a3b8"];

const SUBPANE_OPTIONS = [
  { key: "RSI_14", label: "RSI (14)" },
  { key: "MACD_12_26_9", label: "MACD" },
  { key: "VOLUME", label: "Volume" },
  { key: "STOCH_14_3_3", label: "Stochastic" },
];

export default function Sidebar() {
  const {
    symbol, timeframe, startDate, endDate, isLoadingBars, barsError,
    overlayIndicators, subPaneIndicators, drawings, loadedSymbol, removeDrawing,
    setSymbol, setTimeframe, setStartDate, setEndDate,
    addOverlayIndicator, removeOverlayIndicator, toggleOverlayIndicator, toggleSubPaneIndicator,
  } = useAppStore();
  const [showAddOverlay, setShowAddOverlay] = useState(false);

  const loadBars = useLoadBars();

  const [symbolInput, setSymbolInput] = useState(symbol);
  // Follow symbol changes made elsewhere (e.g. opening a scanner result)
  const [prevSymbol, setPrevSymbol] = useState(symbol);
  if (symbol !== prevSymbol) {
    setPrevSymbol(symbol);
    setSymbolInput(symbol);
  }
  const [suggestions, setSuggestions] = useState<SymbolSearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!searchRef.current?.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleSymbolInput(val: string) {
    setSymbolInput(val);
    if (val.length >= 1) {
      const results = await searchSymbols(val);
      setSuggestions(results);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }

  function selectSymbol(s: string) {
    setSymbolInput(s);
    setSymbol(s);
    setShowSuggestions(false);
  }

  function handleLoad() {
    setSymbol(symbolInput);
    loadBars();
  }

  return (
    <div
      style={{
        width: "220px",
        minWidth: "220px",
        background: "var(--color-surface)",
        borderRight: "1px solid var(--color-border)",
        display: "flex",
        flexDirection: "column",
        gap: "0",
        overflowY: "auto",
      }}
    >
      <Section title="Market">
        {/* Symbol search */}
        <div ref={searchRef} style={{ position: "relative" }}>
          <label style={labelStyle}>Symbol</label>
          <input
            value={symbolInput}
            onChange={(e) => handleSymbolInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLoad()}
            placeholder="AAPL"
            style={{ width: "100%" }}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                background: "var(--color-surface2)",
                border: "1px solid var(--color-border)",
                borderRadius: "4px",
                zIndex: 100,
                boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              }}
            >
              {suggestions.map((s) => (
                <div
                  key={s.symbol}
                  onMouseDown={() => selectSymbol(s.symbol)}
                  style={{
                    padding: "7px 10px",
                    cursor: "pointer",
                    fontSize: "13px",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-border)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  <span style={{ fontWeight: 600 }}>{s.symbol}</span>
                  <span style={{ color: "var(--color-muted)", fontSize: "11px" }}>{s.exchange}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Timeframe */}
        <div>
          <label style={labelStyle}>Timeframe</label>
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as Timeframe)}
            style={{ width: "100%" }}
          >
            {TIMEFRAMES.map((tf) => (
              <option key={tf} value={tf}>{tf}</option>
            ))}
          </select>
        </div>

        {/* Date range */}
        <div>
          <label style={labelStyle}>Start</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: "100%" }} />
        </div>
        <div>
          <label style={labelStyle}>End</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ width: "100%" }} />
        </div>

        <button
          onClick={handleLoad}
          disabled={isLoadingBars}
          style={{ background: "var(--color-accent)", color: "#fff", width: "100%", marginTop: "4px" }}
        >
          {isLoadingBars ? "Loading..." : "Load Data"}
        </button>

        {barsError && (
          <div style={{ color: "var(--color-red)", fontSize: "12px", marginTop: "4px" }}>
            {barsError}
          </div>
        )}
      </Section>

      <Section title="Overlays">
        {overlayIndicators.map((o) => (
          <div key={o.id} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Checkbox label={overlayTitle(o)} checked={o.visible} onChange={() => toggleOverlayIndicator(o.id)} />
            <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: o.color, flexShrink: 0 }} />
            <button
              onClick={() => removeOverlayIndicator(o.id)}
              title="Remove"
              style={{ marginLeft: "auto", padding: "0 4px", background: "none", color: "var(--color-muted)", fontSize: "14px", lineHeight: 1 }}
            >
              ×
            </button>
          </div>
        ))}
        {showAddOverlay ? (
          <AddOverlayForm
            defaultColor={OVERLAY_PALETTE[overlayIndicators.length % OVERLAY_PALETTE.length]}
            onAdd={(o) => {
              addOverlayIndicator(o);
              setShowAddOverlay(false);
            }}
            onCancel={() => setShowAddOverlay(false)}
          />
        ) : (
          <button onClick={() => setShowAddOverlay(true)} style={{ width: "100%", marginTop: "2px" }}>
            + Add indicator
          </button>
        )}
      </Section>

      {loadedSymbol && (
        <Section title={`Lines · ${loadedSymbol}`}>
          {drawings.filter((d) => d.symbol === loadedSymbol).length === 0 && (
            <div style={{ fontSize: "12px", color: "var(--color-muted)" }}>Use the chart toolbar to draw lines</div>
          )}
          {drawings
            .filter((d) => d.symbol === loadedSymbol)
            .map((d) => (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                <span
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "2px",
                    flexShrink: 0,
                    background:
                      d.tool === "fib" ? "var(--color-accent)" : d.role === "support" ? "var(--color-green)" : "var(--color-red)",
                  }}
                />
                {d.tool === "fib" ? "Fibonacci" : d.role === "support" ? "Support" : "Resistance"}
                <span style={{ color: "var(--color-muted)", fontSize: "12px" }}>
                  {d.tool === "hline"
                    ? d.p1.price.toFixed(2)
                    : d.tool === "fib"
                      ? `${d.p1.price.toFixed(0)}→${d.p2.price.toFixed(0)}`
                      : "trend"}
                </span>
                <button
                  onClick={() => removeDrawing(d.id)}
                  title="Remove"
                  style={{ marginLeft: "auto", padding: "0 4px", background: "none", color: "var(--color-muted)", fontSize: "14px", lineHeight: 1 }}
                >
                  ×
                </button>
              </div>
            ))}
        </Section>
      )}

      <Section title="Indicators">
        {SUBPANE_OPTIONS.map(({ key, label }) => (
          <Checkbox
            key={key}
            label={label}
            checked={subPaneIndicators.includes(key)}
            onChange={() => toggleSubPaneIndicator(key)}
          />
        ))}
      </Section>
    </div>
  );
}

function AddOverlayForm({
  defaultColor,
  onAdd,
  onCancel,
}: {
  defaultColor: string;
  onAdd: (o: NewOverlay) => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<OverlayKind>("SMA");
  const [length, setLength] = useState(20);
  const [source, setSource] = useState<PriceSource>("close");
  const [stdDev, setStdDev] = useState(2);
  const [color, setColor] = useState(defaultColor);

  const valid = Number.isInteger(length) && length >= 1 && length <= WARMUP_BARS && stdDev > 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        padding: "8px",
        background: "var(--color-surface2)",
        border: "1px solid var(--color-border)",
        borderRadius: "4px",
      }}
    >
      <div>
        <label style={labelStyle}>Type</label>
        <select value={kind} onChange={(e) => setKind(e.target.value as OverlayKind)} style={{ width: "100%" }}>
          {OVERLAY_KINDS.map(({ kind, label }) => (
            <option key={kind} value={kind}>{label}</option>
          ))}
        </select>
      </div>
      <div>
        <label style={labelStyle}>Period (bars)</label>
        <input
          type="number"
          min={1}
          max={WARMUP_BARS}
          value={length}
          onChange={(e) => setLength(Number(e.target.value))}
          style={{ width: "100%" }}
        />
      </div>
      {kind === "BB" && (
        <div>
          <label style={labelStyle}>Std dev</label>
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={stdDev}
            onChange={(e) => setStdDev(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>
      )}
      <div>
        <label style={labelStyle}>Source</label>
        <select value={source} onChange={(e) => setSource(e.target.value as PriceSource)} style={{ width: "100%" }}>
          <option value="close">Close</option>
          <option value="open">Open</option>
        </select>
      </div>
      <div>
        <label style={labelStyle}>Color</label>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          style={{ width: "100%", height: "28px", padding: "2px", cursor: "pointer" }}
        />
      </div>
      <div style={{ display: "flex", gap: "6px" }}>
        <button
          onClick={() => onAdd({ kind, length, source, stdDev, color })}
          disabled={!valid}
          style={{ flex: 1, background: "var(--color-accent)", color: "#fff" }}
        >
          Add
        </button>
        <button onClick={onCancel} style={{ flex: 1 }}>Cancel</button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "12px 12px 8px", borderBottom: "1px solid var(--color-border)" }}>
      <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--color-muted)", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: "8px" }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {children}
      </div>
    </div>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px" }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ width: "auto", padding: 0 }} />
      {label}
    </label>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "11px",
  color: "var(--color-muted)",
  marginBottom: "3px",
};
