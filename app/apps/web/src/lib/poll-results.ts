/**
 * Tiszta (DB-mentes) eredmény-számítási segédfüggvények — az eredmény-nézet
 * (US2) és a poll-queries.ts is ezeket használja, hogy a logika egy helyen
 * éljen és önmagában tesztelhető legyen.
 */

/** Egy tizedesjegyre kerekített százalék; 0 szavazatnál mindig 0 (nem NaN). */
export function computeSharePct(votes: number, totalVotes: number): number {
  if (totalVotes <= 0) return 0;
  return Math.round((votes / totalVotes) * 1000) / 10;
}

/** Eredmény-nézethez: csökkenő szavazatszám szerint (FR-008). */
export function sortByVotesDesc<T extends { votes: number }>(options: T[]): T[] {
  return [...options].sort((a, b) => b.votes - a.votes);
}
