/**
 * Hungarian relative-time helper used by the homepage freshness label.
 * Contract (FR-010, SC-008): never overstate freshness — round DOWN to the largest
 * unit that fully elapsed, so a 119-second lag still says "2 perccel ezelőtt", not "1".
 *
 * The output is a complete Hungarian phrase suitable for a sentence end:
 *   "frissítve épp most"
 *   "frissítve X perccel ezelőtt"
 *   "frissítve X órával ezelőtt"
 *   "frissítve X napja"
 */
export function frissitveRelative(
  computedAt: Date | string,
  now: Date = new Date(),
): string {
  const computed = typeof computedAt === 'string' ? new Date(computedAt) : computedAt;
  const deltaMs = Math.max(0, now.getTime() - computed.getTime());
  const seconds = Math.floor(deltaMs / 1_000);

  if (seconds < 60) return 'frissítve épp most';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `frissítve ${minutes} perccel ezelőtt`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `frissítve ${hours} órával ezelőtt`;

  const days = Math.floor(hours / 24);
  return `frissítve ${days} napja`;
}
