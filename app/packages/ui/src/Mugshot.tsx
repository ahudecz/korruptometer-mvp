import * as React from 'react';

import { initials } from '@korr/shared/format';

type MugshotProps = {
  caseId: string;
  name: string;
  variant: number;
  glasses?: boolean;
  hair?: 'short' | 'bald' | 'wave' | 'cap' | 'slick';
  detention?: 'loose' | 'wanted' | 'busted' | 'pretrial' | 'investig';
};

const SKIN_PALETTE = ['#5b5048', '#4a423b', '#7a6755', '#3a3530', '#5e524a'];

function HairLayer({ hair }: { hair: NonNullable<MugshotProps['hair']> }) {
  switch (hair) {
    case 'short':
      return (
        <path d="M62 78 Q100 50 138 78 L138 96 Q100 88 62 96 Z" fill="#1a1a1a" />
      );
    case 'bald':
      return (
        <ellipse cx={100} cy={84} rx={34} ry={6} fill="rgba(255,255,255,0.08)" />
      );
    case 'wave':
      return (
        <path
          d="M64 80 Q72 64 88 72 Q104 60 120 72 Q136 64 138 84 L138 100 Q100 86 62 100 Z"
          fill="#2a2018"
        />
      );
    case 'cap':
      return (
        <>
          <path
            d="M58 92 Q58 64 100 60 Q142 64 142 92 L142 100 Q100 88 58 100 Z"
            fill="#1a1614"
          />
          <rect x={56} y={98} width={88} height={6} fill="#0d0a08" />
        </>
      );
    case 'slick':
      return (
        <path d="M64 84 Q70 60 100 64 Q130 60 138 84 L138 96 Q100 84 62 96 Z" fill="#181818" />
      );
  }
}

function Glasses() {
  return (
    <>
      <rect x={74} y={106} width={22} height={14} rx={4} fill="none" stroke="#0a0a0a" strokeWidth={2.5} />
      <rect x={106} y={106} width={22} height={14} rx={4} fill="none" stroke="#0a0a0a" strokeWidth={2.5} />
      <line x1={96} y1={113} x2={106} y2={113} stroke="#0a0a0a" strokeWidth={2} />
    </>
  );
}

/**
 * Deterministic SVG mugshot, ported from 01-tesla/index.html:2296-2372 at
 * tag mockup-port-base-v1. Same {variant, glasses, hair} → identical SVG.
 * Phase 1 always uses this component (no real photo URLs in the seed).
 */
export function Mugshot({
  caseId,
  name,
  variant,
  glasses = false,
  hair = 'short',
  detention = 'loose',
}: MugshotProps) {
  const init = initials(name);
  const skin = SKIN_PALETTE[variant % SKIN_PALETTE.length];
  const isBusted = detention === 'busted';
  const isWanted = detention === 'wanted';

  return (
    <svg
      viewBox="0 0 200 240"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={`${name} (${caseId})`}
    >
      <defs>
        <linearGradient id={`bg-${caseId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#23262b" />
          <stop offset="1" stopColor="#0e1015" />
        </linearGradient>
      </defs>
      <rect width={200} height={240} fill={`url(#bg-${caseId})`} />
      <g stroke="rgba(255,255,255,0.08)" strokeWidth={1}>
        <line x1={0} y1={40} x2={200} y2={40} />
        <line x1={0} y1={80} x2={200} y2={80} />
        <line x1={0} y1={120} x2={200} y2={120} />
        <line x1={0} y1={160} x2={200} y2={160} />
        <line x1={0} y1={200} x2={200} y2={200} />
      </g>
      <g
        fill="rgba(255,255,255,0.25)"
        fontFamily="Archivo Narrow, monospace"
        fontSize={9}
        letterSpacing={1}
      >
        <text x={6} y={38}>200</text>
        <text x={6} y={78}>180</text>
        <text x={6} y={118}>160</text>
        <text x={6} y={158}>140</text>
        <text x={6} y={198}>120</text>
        <text x={178} y={38}>FT</text>
        <text x={178} y={78}>SI</text>
        <text x={178} y={118}>SU</text>
      </g>
      <ellipse cx={100} cy={186} rx={68} ry={22} fill={skin} opacity={0.9} />
      <circle cx={100} cy={116} r={46} fill={skin} />
      <HairLayer hair={hair} />
      {!glasses && (
        <>
          <ellipse cx={86} cy={118} rx={2.5} ry={3} fill="#0a0a0a" opacity={0.85} />
          <ellipse cx={116} cy={118} rx={2.5} ry={3} fill="#0a0a0a" opacity={0.85} />
        </>
      )}
      {glasses && <Glasses />}
      <path
        d="M88 138 Q100 144 112 138"
        fill="none"
        stroke="#0a0a0a"
        strokeWidth={1.8}
        strokeLinecap="round"
        opacity={0.6}
      />
      <text
        x={100}
        y={232}
        textAnchor="middle"
        fill="rgba(255,255,255,0.85)"
        fontFamily="Archivo, sans-serif"
        fontWeight={800}
        fontSize={38}
        letterSpacing={-1}
      >
        {init}
      </text>
      {isBusted && (
        <>
          <text
            x={100}
            y={130}
            textAnchor="middle"
            fill="rgba(227,25,55,0.85)"
            fontWeight={800}
            fontSize={36}
            transform="rotate(-12 100 130)"
            letterSpacing={2}
          >
            BUSTED
          </text>
        </>
      )}
      {isWanted && (
        <text
          x={100}
          y={130}
          textAnchor="middle"
          fill="rgba(20,20,20,0.95)"
          fontWeight={800}
          fontSize={28}
          transform="rotate(-12 100 130)"
          letterSpacing={2}
        >
          WANTED
        </text>
      )}
    </svg>
  );
}
