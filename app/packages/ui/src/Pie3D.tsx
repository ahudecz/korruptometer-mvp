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
  /** Render a side legend (color dot + name + %) instead of on-chart text labels. */
  legend?: boolean;
};

const DEFAULT_PALETTE = ['#e31937', '#171a20', '#5c5e62', '#9b9da1', '#cccccc', '#e6e6e6'];

const CX = 280;
const CY = 130;
const RX = 150;
const RY = 48;
const H = 30;
// Tight crop around the actual pie geometry (rim top 82, wall bottom 208,
// shadow ellipse x:[124,436]) + 10px padding — no on-chart labels anymore,
// so there's no need for the old wide margins that used to fit outside-labels.
const VIEW_BOX = '114 72 332 146';

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
  legend = false,
}: Pie3DProps) {
  const total = slices.reduce((s, d) => s + Math.max(0, d.value), 0);
  if (total === 0) {
    return (
      <svg
        viewBox={VIEW_BOX}
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

  const chart = (
    <svg
      viewBox={VIEW_BOX}
      className={legend ? 'pie3d-svg' : className}
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
            >
              <title>{`${s.name}: ${fmtPct(s.pct)}`}</title>
            </path>
          );
        })}
      </g>
    </svg>
  );

  if (!legend) {
    return chart;
  }

  return (
    <div className={className}>
      {chart}
      <ul className="pie3d-legend">
        {prepared.map((s, i) => (
          <li key={`legend-${i}`}>
            <span className="pie3d-legend-dot" style={{ background: s.color }} />
            <span className="pie3d-legend-name">{s.name}</span>
            <span className="pie3d-legend-pct">{fmtPct(s.pct)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
