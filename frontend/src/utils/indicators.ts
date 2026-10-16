// Client-side indicator math for chart display. Formulas mirror
// backend/indicators/calculator.py so the chart matches what the backtester evaluates.
// Values that are not yet defined (warm-up period) are NaN.

export function rollingMean(values: number[], length: number): number[] {
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= length) sum -= values[i - length];
    out.push(i < length - 1 ? NaN : sum / length);
  }
  return out;
}

function rollingStd(values: number[], length: number): number[] {
  const means = rollingMean(values, length);
  return values.map((_, i) => {
    if (isNaN(means[i])) return NaN;
    let sq = 0;
    for (let j = i - length + 1; j <= i; j++) sq += (values[j] - means[i]) ** 2;
    return Math.sqrt(sq / length); // ddof=0
  });
}

function rollingExtreme(values: number[], length: number, pick: (...v: number[]) => number): number[] {
  return values.map((_, i) => (i < length - 1 ? NaN : pick(...values.slice(i - length + 1, i + 1))));
}

// pandas ewm(span, adjust=False)
export function ema(values: number[], span: number): number[] {
  const alpha = 2 / (span + 1);
  const out: number[] = [];
  let prev = NaN;
  for (const v of values) {
    if (isNaN(v)) {
      out.push(prev);
      continue;
    }
    prev = isNaN(prev) ? v : alpha * v + (1 - alpha) * prev;
    out.push(prev);
  }
  return out;
}

export function sma(values: number[], length: number): number[] {
  return rollingMean(values, length);
}

export function bollinger(close: number[], length: number, mult: number) {
  const middle = rollingMean(close, length);
  const std = rollingStd(close, length);
  return {
    upper: middle.map((m, i) => m + mult * std[i]),
    middle,
    lower: middle.map((m, i) => m - mult * std[i]),
  };
}

export function rsi(close: number[], length: number): number[] {
  // delta[0] is undefined, so the first valid value is at index `length`
  const gain = close.slice(1).map((c, i) => Math.max(c - close[i], 0));
  const loss = close.slice(1).map((c, i) => Math.max(close[i] - c, 0));
  const avgGain = rollingMean(gain, length);
  const avgLoss = rollingMean(loss, length);
  return [NaN, ...avgGain.map((g, i) => 100 - 100 / (1 + g / avgLoss[i]))];
}

export function macd(close: number[], fast: number, slow: number, signal: number) {
  const emaFast = ema(close, fast);
  const emaSlow = ema(close, slow);
  const line = emaFast.map((f, i) => f - emaSlow[i]);
  const sig = ema(line, signal);
  return { line, signal: sig, hist: line.map((l, i) => l - sig[i]) };
}

function rollingMeanNaN(values: number[], length: number): number[] {
  return values.map((_, i) => {
    if (i < length - 1) return NaN;
    const window = values.slice(i - length + 1, i + 1);
    return window.some(isNaN) ? NaN : window.reduce((a, b) => a + b, 0) / length;
  });
}

export function stochastic(high: number[], low: number[], close: number[], k: number, d: number, smooth: number) {
  const lowMin = rollingExtreme(low, k, Math.min);
  const highMax = rollingExtreme(high, k, Math.max);
  const rawK = close.map((c, i) => (100 * (c - lowMin[i])) / (highMax[i] - lowMin[i]));
  const smoothK = rollingMeanNaN(rawK, smooth);
  return { k: smoothK, d: rollingMeanNaN(smoothK, d) };
}
