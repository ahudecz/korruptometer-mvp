import { fmtFt } from '@korr/shared/format';

export type Percentiles = {
  p1: bigint | null;
  p10: bigint | null;
  p50: bigint | null;
  p90: bigint | null;
  p99: bigint | null;
};

/**
 * SVG strip chart of five percentiles on a log scale spanning 1 M Ft → 1 T Ft.
 * Renders even when some percentiles are null (those markers simply don't draw).
 * Styled to match the Tesla admin tokens: dashed decade grid, ink range bar,
 * white-bordered markers with the median in accent red.
 */
export function PercentileChart({
  data,
  height = 96,
  width = 360,
}: {
  data: Percentiles;
  height?: number;
  width?: number;
}) {
  const MIN_HUF = 1_000_000;
  const MAX_HUF = 1_000_000_000_000;
  const logMin = Math.log10(MIN_HUF);
  const logMax = Math.log10(MAX_HUF);
  const padL = 18;
  const padR = 18;
  const usableW = width - padL - padR;
  const axisY = height - 28;

  function x(huf: bigint | null): number | null {
    if (huf == null) return null;
    const v = Number(huf);
    if (v <= 0) return null;
    const t = (Math.log10(v) - logMin) / (logMax - logMin);
    return padL + Math.max(0, Math.min(1, t)) * usableW;
  }

  const markers: { key: keyof Percentiles; label: string; kind: 'outer' | 'iqr' | 'median'; showLabel: boolean }[] = [
    { key: 'p1', label: 'p1', kind: 'outer', showLabel: true },
    { key: 'p10', label: 'p10', kind: 'iqr', showLabel: false },
    { key: 'p50', label: 'p50', kind: 'median', showLabel: true },
    { key: 'p90', label: 'p90', kind: 'iqr', showLabel: false },
    { key: 'p99', label: 'p99', kind: 'outer', showLabel: true },
  ];

  const ticks: number[] = [];
  for (let i = Math.ceil(logMin); i <= Math.floor(logMax); i++) {
    ticks.push(10 ** i);
  }

  const x1 = x(data.p1);
  const x99 = x(data.p99);
  const x10 = x(data.p10);
  const x90 = x(data.p90);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Százalékos összegeloszlás (p1–p99)"
    >
      {/* decade grid (dashed verticals) */}
      {ticks.map((t) => {
        const tx = x(BigInt(t));
        if (tx == null) return null;
        return (
          <g key={t}>
            <line
              x1={tx}
              x2={tx}
              y1={6}
              y2={axisY}
              stroke="var(--line)"
              strokeWidth={1}
              strokeDasharray="2 3"
            />
            <text
              x={tx}
              y={axisY + 14}
              fontSize={10}
              fill="var(--muted)"
              textAnchor="middle"
              style={{ fontFamily: 'Archivo Narrow, monospace', fontVariantNumeric: 'tabular-nums' }}
            >
              {labelFor(t)}
            </text>
          </g>
        );
      })}
      {/* axis */}
      <line
        x1={padL}
        x2={width - padR}
        y1={axisY}
        y2={axisY}
        stroke="var(--line-strong)"
        strokeWidth={1}
      />
      {/* p1–p99 outer range (subtle ink) */}
      {x1 != null && x99 != null && (
        <line x1={x1} x2={x99} y1={axisY - 24} y2={axisY - 24} stroke="var(--ink)" strokeWidth={1.5} opacity={0.18} />
      )}
      {/* p10–p90 inter-percentile range (solid ink) */}
      {x10 != null && x90 != null && (
        <line x1={x10} x2={x90} y1={axisY - 24} y2={axisY - 24} stroke="var(--ink)" strokeWidth={3} />
      )}
      {/* markers */}
      {markers.map((m) => {
        const huf = data[m.key];
        const cx = x(huf);
        if (cx == null) return null;
        const isMedian = m.kind === 'median';
        const r = isMedian ? 5.5 : 3.75;
        const fill = isMedian ? 'var(--accent)' : 'var(--ink)';
        const labelFill = isMedian ? 'var(--accent)' : 'var(--ink-2)';
        return (
          <g key={m.key}>
            <circle
              cx={cx}
              cy={axisY - 24}
              r={r}
              fill={fill}
              stroke="#fff"
              strokeWidth={1.5}
            />
            {m.showLabel && (
              <text
                x={cx}
                y={axisY - 35}
                fontSize={9}
                fill={labelFill}
                textAnchor="middle"
                fontWeight={isMedian ? 700 : 600}
                style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}
              >
                {m.label}
              </text>
            )}
            <title>
              {`${m.label}: ${huf != null ? fmtFt(huf) : '—'}`}
            </title>
          </g>
        );
      })}
    </svg>
  );
}

function labelFor(n: number): string {
  if (n >= 1_000_000_000_000) return `${n / 1_000_000_000_000} E`;
  if (n >= 1_000_000_000) return `${n / 1_000_000_000} Mrd`;
  if (n >= 1_000_000) return `${n / 1_000_000} M`;
  return `${n}`;
}
