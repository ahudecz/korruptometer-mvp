/**
 * Truncates to at most `max` characters, breaking on the last preceding
 * word boundary and appending an ellipsis, so generated <title>/description
 * values from free-text DB/config content never blow past SEO limits.
 */
export function truncate(text: string, max: number): string {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…';
}
