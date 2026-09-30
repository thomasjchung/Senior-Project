import { useState, useRef, useEffect } from "react";
import { useAppStore } from "../../store/useAppStore";
import { useLoadBars } from "../../hooks/useOHLCV";
import { searchSymbols } from "../../api/data";
import { TIMEFRAMES, type Timeframe } from "../../types/ohlcv";
import type { SymbolSearchResult } from "../../types/ohlcv";

const OVERLAY_OPTIONS = [
  { key: "SMA_20", label: "SMA (20)" },
  { key: "SMA_50", label: "SMA (50)" },
  { key: "EMA_20", label: "EMA (20)" },
  { key: "EMA_50", label: "EMA (50)" },
  { key: "BB_20_2.0", label: "Bollinger Bands" },
];

const SUBPANE_OPTIONS = [
  { key: "RSI_14", label: "RSI (14)" },
  { key: "MACD_12_26_9", label: "MACD" },
  { key: "VOLUME", label: "Volume" },
  { key: "STOCH_14_3_3", label: "Stochastic" },
];

export default function Sidebar() {
  const {
    symbol, timeframe, startDate, endDate, isLoadingBars, barsError,
    overlayIndicators, subPaneIndicators,
    setSymbol, setTimeframe, setStartDate, setEndDate,
    toggleOverlayIndicator, toggleSubPaneIndicator,
  } = useAppStore();

  const loadBars = useLoadBars();

  const [symbolInput, setSymbolInput] = useState(symbol);
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
        {OVERLAY_OPTIONS.map(({ key, label }) => (
          <Checkbox
            key={key}
            label={label}
            checked={overlayIndicators.includes(key)}
            onChange={() => toggleOverlayIndicator(key)}
          />
        ))}
      </Section>

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
