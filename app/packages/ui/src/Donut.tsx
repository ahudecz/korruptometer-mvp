import * as React from 'react';

export type DonutSlice = {
  label: string;
  value: number;
  color: string;
};

type DonutProps = {
  slices: DonutSlice[];
  size?: number;
  innerRadius?: number;
  ariaLabel?: string;
};

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutSlice(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  a1: number,
  a2: number,
): string {
  const sO = polarToCartesian(cx, cy, outer, a2);
  const eO = polarToCartesian(cx, cy, outer, a1);
  const sI = polarToCartesian(cx, cy, inner, a1);
  const eI = polarToCartesian(cx, cy, inner, a2);
  const large = a2 - a1 <= 180 ? 0 : 1;
  return `M ${sO.x} ${sO.y} A ${outer} ${outer} 0 ${large} 0 ${eO.x} ${eO.y} L ${sI.x} ${sI.y} A ${inner} ${inner} 0 ${large} 1 ${eI.x} ${eI.y} Z`;
}

/**
 * Deterministic donut SVG. Same input → same output. Mirrors the mockup's
 * mini-donut (01-tesla/index.html:2154-2169 at tag mockup-port-base-v1) so
 * that the homepage breakdown reads visually identical.
 */
export function Donut({
  slices,
  size = 220,
  innerRadius = 60,
  ariaLabel = 'Szektorbontás',
}: DonutProps) {
  const total = slices.reduce((s, d) => s + Math.max(0, d.value), 0);
  if (total === 0) {
    return (
      <svg
        width={size}
        height={size}
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle cx={size / 2} cy={size / 2} r={size / 2 - 6} fill="var(--surface)" />
      </svg>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const outer = size / 2 - 6;
  const inner = Math.min(innerRadius, outer - 4);

  let angle = 0;
  return (
    <svg width={size} height={size} role="img" aria-label={ariaLabel} viewBox={`0 0 ${size} ${size}`}>
      <title>{ariaLabel}</title>
      {slices.map((slice, i) => {
        const span = (slice.value / total) * 360;
        const a1 = angle;
        const a2 = angle + span;
        angle = a2;
        return (
          <path
            key={`${slice.label}-${i}`}
            d={donutSlice(cx, cy, outer, inner, a1, a2)}
            fill={slice.color}
            stroke="#fff"
            strokeWidth={1.5}
          />
        );
      })}
    </svg>
  );
}
