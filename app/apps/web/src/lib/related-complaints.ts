import 'server-only';
import { desc, eq } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';

/**
 * user kérés, 2026-08-25: a galéria-személyekhez és a kiemelt ügyekhez
 * (UGYEK) kapcsolódó feljelentések (CriminalComplaint) automatikusan
 * jelenjenek meg az adott személy/ügy oldalán kiemelt keretes hírként —
 * az NKA-oldal breaking-box/article-card mintájára (l. ugyek/[id]/page.tsx),
 * nem kézzel karbantartott statikus configon keresztül, hanem élő
 * DB-lekérdezéssel, hogy minden ÚJ, jóváhagyott feljelentés automatikusan
 * bekerüljön, amint a person/case kulcsszavaival egyezik.
 *
 * Ugyanaz az egyszerű "kulcsszó szerepel-e a targetName+description
 * szövegében" egyezés, mint amit a galéria-oldal már a "Kapcsolódó hírek"
 * NewsArticle-matchingnél is használ (l. galeria-config.ts newsKeywords).
 */

export type RelatedComplaint = {
  id: string;
  targetName: string;
  description: string | null;
  sourceUrl: string;
  sourceName: string;
  sourceHeadline: string;
  eventDate: Date;
  /** Friss (≤7 nap) — a keretes kártya ekkor kap BREAKING jelölést, ugyanaz
   *  az ablak, mint a NewsArticle-alapú breaking-nél (getActiveBreaking()). */
  isFresh: boolean;
};

const FRESH_WINDOW_DAYS = 7;

async function loadApprovedComplaints() {
  const db = getDb();
  return db
    .select({
      id: schema.criminalComplaints.id,
      targetName: schema.criminalComplaints.targetName,
      description: schema.criminalComplaints.description,
      eventDate: schema.criminalComplaints.eventDate,
      sourceUrls: schema.criminalComplaints.sourceUrls,
      sourceNames: schema.criminalComplaints.sourceNames,
      sourceHeadlines: schema.criminalComplaints.sourceHeadlines,
    })
    .from(schema.criminalComplaints)
    .where(eq(schema.criminalComplaints.reviewStatus, 'approved'))
    .orderBy(desc(schema.criminalComplaints.eventDate));
}

type RawComplaint = Awaited<ReturnType<typeof loadApprovedComplaints>>[number];

function matchesKeywords(haystack: string, keywords: string[]): boolean {
  const h = haystack.toLowerCase();
  return keywords.some((kw) => kw.trim().length > 0 && h.includes(kw.toLowerCase()));
}

function toRelatedComplaint(c: RawComplaint): RelatedComplaint | null {
  if (!c.sourceUrls[0]) return null; // sose mutass forrás nélküli állítást
  const days = (Date.now() - new Date(c.eventDate).getTime()) / 86_400_000;
  return {
    id: c.id,
    targetName: c.targetName,
    description: c.description,
    sourceUrl: c.sourceUrls[0],
    sourceName: c.sourceNames[0] ?? 'Forrás',
    sourceHeadline: c.sourceHeadlines[0] ?? c.targetName,
    eventDate: new Date(c.eventDate),
    isFresh: days <= FRESH_WINDOW_DAYS,
  };
}

/** Egy galéria-személyhez kapcsolódó feljelentések — a személy neve ÉS a
 *  meglévő newsKeywords listája alapján (galeria-config.ts). */
export async function getRelatedComplaintsForGaleria(personName: string, newsKeywords: string[] = []): Promise<RelatedComplaint[]> {
  const rows = await loadApprovedComplaints();
  const keywords = [personName, ...newsKeywords];
  return rows
    .filter((c) => matchesKeywords(`${c.targetName} ${c.description ?? ''}`, keywords))
    .map(toRelatedComplaint)
    .filter((c): c is RelatedComplaint => c != null);
}

/** Egy kiemelt ügyhöz (UGYEK) kapcsolódó feljelentések — a meglévő
 *  articleKeywords listája alapján (ugyek-config.ts). */
export async function getRelatedComplaintsForUgy(articleKeywords: string[]): Promise<RelatedComplaint[]> {
  const rows = await loadApprovedComplaints();
  return rows
    .filter((c) => matchesKeywords(`${c.targetName} ${c.description ?? ''}`, articleKeywords))
    .map(toRelatedComplaint)
    .filter((c): c is RelatedComplaint => c != null);
}
