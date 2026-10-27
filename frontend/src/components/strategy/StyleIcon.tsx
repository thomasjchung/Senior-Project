// Small line drawings for the strategy style cards (64×36 viewBox)
const UP = "var(--color-green)";
const DOWN = "var(--color-red)";
const LINE = "var(--color-accent)";
const MUTED = "var(--color-muted)";

function Candle({ x, o, c, h, l }: { x: number; o: number; c: number; h: number; l: number }) {
  const color = c < o ? UP : DOWN; // y grows downward, so a smaller close is higher
  return (
    <g stroke={color} fill={color}>
      <line x1={x} x2={x} y1={h} y2={l} strokeWidth={1} />
      <rect x={x - 2.5} y={Math.min(o, c)} width={5} height={Math.max(Math.abs(o - c), 1)} />
    </g>
  );
}

const ICONS: Record<string, React.ReactNode> = {
  ross_momentum: (
    <>
      <Candle x={8} o={30} c={22} h={20} l={31} />
      <Candle x={16} o={22} c={12} h={10} l={23} />
      <Candle x={24} o={12} c={6} h={4} l={13} />
      <Candle x={32} o={7} c={11} h={6} l={13} />
      <Candle x={40} o={11} c={14} h={10} l={16} />
      <Candle x={48} o={14} c={9} h={8} l={15} />
      <Candle x={56} o={9} c={3} h={2} l={10} />
      <line x1={44} x2={60} y1={8} y2={8} stroke={MUTED} strokeDasharray="2 2" />
    </>
  ),
  breakout: (
    <>
      <line x1={4} x2={60} y1={14} y2={14} stroke={MUTED} strokeDasharray="3 2" />
      <polyline points="4,28 12,16 20,26 28,15 36,25 44,16 52,8 60,3" fill="none" stroke={LINE} strokeWidth={1.5} />
      <rect x={50} y={26} width={4} height={8} fill={UP} />
      {[6, 14, 22, 30, 38].map((x) => <rect key={x} x={x} y={31} width={4} height={3} fill={MUTED} />)}
    </>
  ),
  fibonacci: (
    <>
      {[4, 11, 16, 20, 24, 32].map((y) => <line key={y} x1={4} x2={60} y1={y} y2={y} stroke={MUTED} strokeWidth={0.6} />)}
      <polyline points="4,32 24,4 38,20 60,2" fill="none" stroke={LINE} strokeWidth={1.5} />
    </>
  ),
  support_resistance: (
    <>
      <line x1={4} x2={60} y1={6} y2={6} stroke={DOWN} />
      <line x1={4} x2={60} y1={30} y2={30} stroke={UP} />
      <polyline points="4,18 12,7 20,29 28,8 36,29 44,7 52,29 60,16" fill="none" stroke={LINE} strokeWidth={1.5} />
    </>
  ),
  dynamic_sr: (
    <>
      <path d="M4,32 C20,28 36,18 60,6" fill="none" stroke={UP} strokeWidth={1.5} />
      <polyline points="4,26 12,20 18,28 28,14 34,22 44,8 50,15 60,2" fill="none" stroke={LINE} strokeWidth={1.5} />
    </>
  ),
  candlestick: (
    <>
      <Candle x={14} o={10} c={20} h={7} l={24} />
      <Candle x={24} o={14} c={22} h={12} l={26} />
      <Candle x={34} o={24} c={10} h={6} l={27} />
      <Candle x={48} o={14} c={11} h={10} l={30} />
    </>
  ),
  momentum: (
    <>
      {[-4, -6, -3, -1, 2, 5, 8, 6].map((v, i) => (
        <rect key={i} x={6 + i * 7} y={v < 0 ? 26 : 26 - v} width={4} height={Math.abs(v)} fill={v < 0 ? DOWN : UP} />
      ))}
      <line x1={4} x2={60} y1={26} y2={26} stroke={MUTED} strokeWidth={0.6} />
      <polyline points="4,14 14,17 24,15 34,10 44,6 60,4" fill="none" stroke={LINE} strokeWidth={1.5} />
    </>
  ),
  custom: (
    <>
      <line x1={32} x2={32} y1={8} y2={28} stroke={MUTED} strokeWidth={2} />
      <line x1={22} x2={42} y1={18} y2={18} stroke={MUTED} strokeWidth={2} />
    </>
  ),
};

export default function StyleIcon({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 64 36" width={64} height={36} aria-hidden>
      {ICONS[id] ?? ICONS.custom}
    </svg>
  );
}
