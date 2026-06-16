import * as React from 'react';

export type PieSlice = {
  name: string;
  value: number;
};

type Pie3DProps = {
  slices: PieSlice[];
  palette?: string[];
  ariaLabel?: string;
  className?: string;
};

const DEFAULT_PALETTE = ['#e31937', '#171a20', '#5c5e62', '#9b9da1', '#cccccc', '#e6e6e6'];

const CX = 280;
const CY = 130;
const RX = 150;
const RY = 48;
const H = 30;

function ept(angle: number, rx = RX, ry = RY, cx = CX, cy = CY) {
  const r = ((angle - 90) * Math.PI) / 180;
  return { x: cx + rx * Math.cos(r), y: cy + ry * Math.sin(r) };
}

function darken(hex: string, amt: number): string {
  const c = parseInt(hex.slice(1), 16);
  const r = Math.max(0, (c >> 16) - amt);
  const g = Math.max(0, ((c >> 8) & 0xff) - amt);
  const b = Math.max(0, (c & 0xff) - amt);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

function readableText(hex: string): string {
  const c = parseInt(hex.slice(1), 16);
  const r = c >> 16;
  const g = (c >> 8) & 0xff;
  const b = c & 0xff;
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? '#171a20' : '#ffffff';
}

function fmtPct(n: number): string {
  return n.toFixed(1).replace('.', ',') + '%';
}

type PreparedSlice = PieSlice & {
  a1: number;
  a2: number;
  mid: number;
  span: number;
  color: string;
  pct: number;
};

/**
 * 3D pie chart that mirrors the build3DPie() implementation in the mockup
 * (01-tesla/index.html:1988+). Same input → same SVG.
 */
export function Pie3D({
  slices,
  palette = DEFAULT_PALETTE,
  ariaLabel = 'Szektorbontás',
  className,
}: Pie3DProps) {
  const total = slices.reduce((s, d) => s + Math.max(0, d.value), 0);
  if (total === 0) {
    return (
      <svg
        viewBox="0 52 560 208"
        className={className}
        role="img"
        aria-label={ariaLabel}
        preserveAspectRatio="xMidYMid meet"
      />
    );
  }

  let angle = 0;
  const prepared: PreparedSlice[] = slices.map((d, i) => {
    const span = (d.value / total) * 360;
    const s: PreparedSlice = {
      ...d,
      a1: angle,
      a2: angle + span,
      mid: angle + span / 2,
      span,
      color: palette[i % palette.length] ?? DEFAULT_PALETTE[0]!,
      pct: (d.value / total) * 100,
    };
    angle += span;
    return s;
  });

  // Outside-label de-overlap (mirrors the mockup logic)
  type Out = {
    s: PreparedSlice;
    sx: number;
    sy: number;
    x: number;
    y: number;
    isRight: boolean;
  };
  const outs: Out[] = prepared
    .filter((s) => s.pct < 8)
    .map((s) => {
      const isFront = s.mid > 90 && s.mid < 270;
      const yShift = isFront ? H : 0;
      const sliceEdge = ept(s.mid);
      const labelPos = ept(s.mid, RX + 42, RY + 32);
      return {
        s,
        sx: sliceEdge.x,
        sy: sliceEdge.y + yShift,
        x: labelPos.x,
        y: labelPos.y + yShift / 2,
        isRight: labelPos.x >= CX,
      };
    });

  const minGap = 20;
  for (const side of [true, false]) {
    const grp = outs.filter((l) => l.isRight === side);
    const top = grp.filter((l) => l.y < CY).sort((a, b) => b.y - a.y);
    const bot = grp.filter((l) => l.y >= CY).sort((a, b) => a.y - b.y);
    for (let i = 1; i < top.length; i++) {
      const prev = top[i - 1]!;
      const cur = top[i]!;
      if (prev.y - cur.y < minGap) cur.y = prev.y - minGap;
    }
    for (let i = 1; i < bot.length; i++) {
      const prev = bot[i - 1]!;
      const cur = bot[i]!;
      if (cur.y - prev.y < minGap) cur.y = prev.y + minGap;
    }
  }

  return (
    <svg
      viewBox="0 52 560 208"
      className={className}
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="xMidYMid meet"
    >
      <title>{ariaLabel}</title>
      {/* shadow ellipse */}
      <ellipse cx={CX} cy={CY + H + 4} rx={RX + 6} ry={RY * 0.55} fill="rgba(23,26,32,0.08)" />

      {/* walls (front-facing portion only) */}
      <g>
        {prepared.map((s, i) => {
          const lo = Math.max(s.a1, 90);
          const hi = Math.min(s.a2, 270);
          if (lo >= hi) return null;
          const p1 = ept(lo);
          const p2 = ept(hi);
          const large = hi - lo > 180 ? 1 : 0;
          return (
            <path
              key={`wall-${i}`}
              d={
                `M ${p1.x} ${p1.y} ` +
                `A ${RX} ${RY} 0 ${large} 1 ${p2.x} ${p2.y} ` +
                `L ${p2.x} ${p2.y + H} ` +
                `A ${RX} ${RY} 0 ${large} 0 ${p1.x} ${p1.y + H} Z`
              }
              fill={darken(s.color, 60)}
              stroke={darken(s.color, 95)}
              strokeWidth={1}
            />
          );
        })}
      </g>

      {/* tops */}
      <g className="tops">
        {prepared.map((s, i) => {
          const p1 = ept(s.a1);
          const p2 = ept(s.a2);
          const large = s.span > 180 ? 1 : 0;
          return (
            <path
              key={`top-${i}`}
              d={`M ${CX} ${CY} L ${p1.x} ${p1.y} A ${RX} ${RY} 0 ${large} 1 ${p2.x} ${p2.y} Z`}
              fill={s.color}
              stroke="#ffffff"
              strokeWidth={1.5}
            />
          );
        })}
      </g>

      {/* inside labels (slices ≥ 8%) */}
      <g>
        {prepared
          .filter((s) => s.pct >= 8)
          .map((s, i) => {
            const lp = ept(s.mid, RX * 0.6, RY * 0.6);
            const isFront = s.mid > 90 && s.mid < 270;
            const yOff = isFront ? H * 0.15 : 0;
            const fill = readableText(s.color);
            return (
              <g key={`inside-${i}`}>
                <text
                  x={lp.x}
                  y={lp.y - 4 + yOff}
                  textAnchor="middle"
                  className="slice-name"
                  fill={fill}
                >
                  {s.name}
                </text>
                <text
                  x={lp.x}
                  y={lp.y + 14 + yOff}
                  textAnchor="middle"
                  className="slice-pct"
                  fill={fill}
                >
                  {fmtPct(s.pct)}
                </text>
              </g>
            );
          })}
      </g>

      {/* outside labels (slices < 8%) */}
      <g>
        {outs.map((l, i) => {
          const tx = l.isRight ? l.x + 8 : l.x - 8;
          return (
            <g key={`out-${i}`}>
              <path d={`M ${l.sx} ${l.sy} L ${l.x} ${l.y}`} stroke={l.s.color} strokeWidth={1} fill="none" />
              <circle cx={l.x} cy={l.y} r={3} fill={l.s.color} />
              <text
                x={tx}
                y={l.y - 1}
                textAnchor={l.isRight ? 'start' : 'end'}
                className="slice-outside"
              >
                {l.s.name}
              </text>
              <text
                x={tx}
                y={l.y + 11}
                textAnchor={l.isRight ? 'start' : 'end'}
                className="slice-outside-pct"
              >
                {fmtPct(l.s.pct)}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
