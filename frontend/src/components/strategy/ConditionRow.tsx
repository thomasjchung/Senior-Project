import {
  type Condition, type IndicatorKey, type OperatorKey,
  INDICATOR_LABELS, OPERATOR_LABELS, INDICATOR_PARAMS, PRICE_OPERATORS,
  defaultParams,
} from "../../types/strategy";

interface Props {
  condition: Condition;
  onChange: (c: Condition) => void;
  onRemove: () => void;
}

const ALL_INDICATORS = Object.keys(INDICATOR_LABELS) as IndicatorKey[];

const OPERATORS_FOR_INDICATOR: Record<string, OperatorKey[]> = {
  default: [">", ">=", "<", "<=", "crosses_above", "crosses_below"],
  price_ref: [
    "price_above_indicator", "price_below_indicator",
    "price_crosses_above_indicator", "price_crosses_below_indicator",
  ],
};

function getOperators(_indicator: IndicatorKey): OperatorKey[] {
  return [...OPERATORS_FOR_INDICATOR.default, ...OPERATORS_FOR_INDICATOR.price_ref];
}

export default function ConditionRow({ condition, onChange, onRemove }: Props) {
  const params = INDICATOR_PARAMS[condition.indicator];
  const isPriceOp = PRICE_OPERATORS.has(condition.operator);

  function setIndicator(ind: IndicatorKey) {
    onChange({ ...condition, indicator: ind, params: defaultParams(ind), value: isPriceOp ? null : (condition.value ?? 0) });
  }

  function setOperator(op: OperatorKey) {
    const nowPrice = PRICE_OPERATORS.has(op);
    onChange({ ...condition, operator: op, value: nowPrice ? null : (condition.value ?? 0) });
  }

  function setParam(name: string, val: number) {
    onChange({ ...condition, params: { ...condition.params, [name]: val } });
  }

  return (
    <div style={{ display: "flex", gap: "6px", alignItems: "flex-start", flexWrap: "wrap" }}>
      {/* Indicator select */}
      <select
        value={condition.indicator}
        onChange={(e) => setIndicator(e.target.value as IndicatorKey)}
        style={{ flex: "2", minWidth: "110px", fontSize: "12px" }}
      >
        {ALL_INDICATORS.map((ind) => (
          <option key={ind} value={ind}>{INDICATOR_LABELS[ind]}</option>
        ))}
      </select>

      {/* Params */}
      {params.map((p) => (
        <input
          key={p.name}
          type="number"
          title={p.name}
          placeholder={p.name}
          value={condition.params[p.name] ?? p.default}
          onChange={(e) => setParam(p.name, Number(e.target.value))}
          style={{ width: "46px", fontSize: "12px" }}
        />
      ))}

      {/* Operator select */}
      <select
        value={condition.operator}
        onChange={(e) => setOperator(e.target.value as OperatorKey)}
        style={{ flex: "1.5", minWidth: "110px", fontSize: "12px" }}
      >
        {getOperators(condition.indicator).map((op) => (
          <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
        ))}
      </select>

      {/* Value input (hidden for price operators) */}
      {!isPriceOp && (
        <input
          type="number"
          value={condition.value ?? ""}
          onChange={(e) => onChange({ ...condition, value: Number(e.target.value) })}
          style={{ width: "54px", fontSize: "12px" }}
          step="any"
        />
      )}

      {/* Remove button */}
      <button
        onClick={onRemove}
        style={{
          background: "transparent",
          color: "var(--color-red)",
          padding: "4px 6px",
          fontSize: "14px",
          lineHeight: "1",
        }}
        title="Remove condition"
      >
        ×
      </button>
    </div>
  );
}
