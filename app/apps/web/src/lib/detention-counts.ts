import { and, eq, isNotNull, sql } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';

/**
 * Hány személy van JELENLEG előzetes letartóztatásban egy ügyben — a közös
 * CourtVerdict táblából, ugyanabból, amiből a „Börtönben van-e?” oldal és az
 * ügyek letartóztatotti táblázata dolgozik.
 *
 * User kérés, 2026-10-01: a kiemelt ügyek „Aktív · 7 személy előzetesben”
 * sora kézzel írt szám volt, és Hankó Balázs letartóztatása után elavult.
 * Innentől a configban a szám helyén a {@link DETENTION_COUNT_TOKEN} áll, és
 * minden megjelenítési helyen (ügyoldal, nyitóoldal, Facebook-poszt képe)
 * ebből töltődik ki.
 *
 * Személyenként számol (count distinct personName), és csak az egyéni,
 * jóváhagyott sorokat — a gyűjtőnevű sorokat ezért egyéni sorokra kell bontani
 * (l. project-collective-vs-individual-dedup).
 */
export { DETENTION_COUNT_TOKEN, fillDetentionCount, fillEyebrow, fillStatusItems, type DetentionCounts } from './detention-count-text';
import type { DetentionCounts } from './detention-count-text';

export async function loadDetentionCounts(): Promise<DetentionCounts | null> {
  const v = schema.courtVerdicts;
  try {
    const rows = await getDb()
      .select({ ugyId: v.personUgyId, n: sql<number>`count(distinct ${v.personName})::int` })
      .from(v)
      .where(and(eq(v.reviewStatus, 'approved'), eq(v.verdictType, 'előzetesben'), isNotNull(v.personUgyId)))
      .groupBy(v.personUgyId);
    return new Map(rows.flatMap((r) => (r.ugyId ? [[r.ugyId, Number(r.n)] as const] : [])));
  } catch {
    return null;
  }
}
