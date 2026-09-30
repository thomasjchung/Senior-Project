import dayjs from "dayjs";

export function fmtPrice(v: number): string {
  return v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

export function fmtPct(v: number, decimals = 2): string {
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(decimals)}%`;
}

export function fmtDate(ts: number): string {
  return dayjs.unix(ts).format("YYYY-MM-DD");
}

export function fmtDateTime(ts: number): string {
  return dayjs.unix(ts).format("MM/DD HH:mm");
}

export function fmtNumber(v: number, decimals = 2): string {
  return v.toFixed(decimals);
}
