import { useAppStore } from "../../store/useAppStore";
import { makeBlankCriteria } from "../../types/scanner";
import type { Universe } from "../../types/strategy";
import CriteriaEditor from "../scanner/CriteriaEditor";

interface Props {
  universe: Universe;
  onChange: (u: Universe) => void;
}

export default function UniversePicker({ universe, onChange }: Props) {
  const { symbol, timeframe } = useAppStore();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <select
        value={universe.type}
        onChange={(e) =>
          onChange(
            e.target.value === "scanner"
              ? { type: "scanner", criteria: makeBlankCriteria(), regular_hours_only: true }
              : { type: "symbol" }
          )
        }
        style={{ width: "100%" }}
      >
        <option value="symbol">One stock: the chart's symbol ({symbol})</option>
        <option value="scanner">Scanner matches: stocks meeting criteria at the time</option>
      </select>

      {universe.type === "scanner" && (
        <>
          <div style={{ fontSize: "12px", color: "var(--color-muted)", lineHeight: 1.5 }}>
            Trades any stock at the moments it met these criteria, using only data available then: price at that bar,
            % change from the previous close, and volume so far that day (including pre-market). One position at a
            time, closed by the end of the day. Float uses today's value, since historical float isn't available.
          </div>
          <CriteriaEditor
            criteria={universe.criteria}
            onChange={(criteria) => onChange({ ...universe, criteria })}
          />
          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={universe.regular_hours_only}
              onChange={(e) => onChange({ ...universe, regular_hours_only: e.target.checked })}
              style={{ width: "auto", padding: 0 }}
            />
            Only trade regular hours (9:30 AM – 4:00 PM ET)
          </label>
          {timeframe === "1Day" && (
            <div style={{ fontSize: "12px", color: "var(--color-red)" }}>
              Pick an intraday timeframe in the sidebar (1Min–1Hour); scanner backtests trade within the day.
            </div>
          )}
        </>
      )}
    </div>
  );
}
