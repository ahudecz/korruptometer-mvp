import * as React from 'react';

type TickerProps = {
  items: string[];
};

/**
 * Marquee ticker. Items are repeated 2x so the linear keyframe (translateX 0
 * → -50%) loops seamlessly. Mirrors the mockup ticker (01-tesla:1457-1472).
 */
export function Ticker({ items }: TickerProps) {
  const doubled = [...items, ...items];
  return (
    <div className="ticker" role="marquee" aria-label="Élő számok">
      <div className="ticker-track">
        {doubled.map((it, i) => (
          <span key={i} className="ticker-item">
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}
