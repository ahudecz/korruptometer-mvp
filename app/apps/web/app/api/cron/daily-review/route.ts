import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { and, desc, eq, gte, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import { getDb, schema } from '@/lib/db';
/** Külön titok, csak ehhez a végponthoz (nem a CRON_SECRET — az visszaolvashatatlan
 *  „sensitive” Vercel-env, és szűkebb jogosultság így biztonságosabb). */
function verifyDailyReviewRequest(req: Request): boolean {
  const secret = process.env.DAILY_REVIEW_SECRET;
  if (!secret || secret.length < 32) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

/**
 * 2026-11-17 — a napi felhős hírátnézés (claude.ai routine,
 * trig_0182muPFxxk12cndiUyd6hti) HTTPS-kapuja az éles adatbázishoz.
 *
 * Miért kell: az Anthropic API-kredit 11-06 óta elfogyott, az LLM-detektorok
 * nem futnak; helyettük egy felhős Claude Code-futás nézi át naponta a
 * híreket. A felhős homokozó csak HTTPS-t enged kifelé, nyers Postgres-
 * kapcsolatot (5432/6543) nem, a Supabase REST pedig 09-17 óta 402-t ad.
 *
 * Biztonság: DAILY_REVIEW_SECRET bearer (saját titok, csak ehhez a végponthoz).
 * Tetszőleges SQL-t NEM fogad: csak a lenti műveletek, rögzített táblákkal és
 * zod-dal ellenőrzött, előre megadott mezőkkel. Törlés nincs.
 *
 * Műveletek (POST JSON, `op` mező):
 *  - status                → utolsó LLM-hívás ideje (DailyLlmUsage)
 *  - news {hours}          → az utolsó N órában bekerült hírek (max 72)
 *  - find {table, q}       → névre/címre keresés duplikátum-ellenőrzéshez
 *  - insert {table, row}   → új sor (reviewStatus mindig 'approved')
 *  - update_verdict {...}  → meglévő CourtVerdict összefoglaló-kiegészítése,
 *                            státuszváltása, új forrás hozzáadása
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}/);
const shortText = z.string().trim().min(1).max(300);
const longText = z.string().trim().min(1).max(4000);
const url = z.string().url().max(1000);
const textArr = (max = 20) => z.array(z.string().trim().min(1).max(500)).max(max);
const sourceSet = z
  .object({ sourceUrls: z.array(url).min(1).max(10), sourceNames: textArr(10), sourceHeadlines: textArr(10), sourceDates: z.array(dateStr).max(10) })
  .refine((s) => s.sourceNames.length === s.sourceUrls.length && s.sourceHeadlines.length === s.sourceUrls.length && s.sourceDates.length === s.sourceUrls.length, {
    message: 'a 4 forrás-tömbnek azonos hosszúnak kell lennie',
  });

const verdictTypeEnum = z.enum(['előzetesben', 'vádemelés', 'elsőfokú', 'jogerős', 'fellebbezés alatt', 'szabadlábra helyezve', 'felmentve', 'eljárás megszűnt', 'egyéb']);

const verdictRow = z
  .object({
    personName: shortText,
    position: shortText,
    crimes: textArr(10),
    sentenceYears: z.number().int().min(0).max(99).default(0),
    sentenceMonths: z.number().int().min(0).max(11).nullable().default(null),
    sentenceLabel: z.string().max(100).nullable().default(null),
    verdictType: verdictTypeEnum,
    verdictDate: dateStr,
    court: shortText,
    summary: longText,
    description: z.string().max(200).nullable().default(null),
    personUgyId: z.string().max(100).nullable().default(null),
  })
  .and(sourceSet);

const resignationRow = z.object({
  name: shortText,
  position: shortText,
  institution: shortText,
  resignationType: z.enum(['lemondás', 'kirúgás', 'felmentés', 'visszahívás', 'egyéb']),
  resignationDate: dateStr,
  description: z.string().trim().min(1).max(120),
  sector: z.enum(['nemzetbiztonság', 'fegyveres és rendvédelmi szervek', 'ügyészség', 'honvédség', 'hatóságok, hivatalok, állami cégek', 'egészségügy', 'média', 'sport és civil szervezetek', 'kultúra', 'közigazgatás', 'egyéb']),
  sourceUrls: z.array(url).min(1).max(10),
  sourceNames: textArr(10),
});

const complaintRow = z
  .object({
    targetName: shortText,
    filerName: shortText,
    description: longText,
    status: z.enum(['feljelentés', 'nyomozás', 'vádemelés', 'ítélet', 'elutasítva']),
    eventDate: dateStr,
    filedAt: dateStr.nullable().default(null),
    amountLabel: z.string().max(200).nullable().default(null),
    relatedCaseIds: textArr(10).default([]),
    relatedCaseLabels: textArr(10).default([]),
  })
  .and(sourceSet);

const recoveryRow = z.object({
  caseId: z.string().trim().min(1).max(200),
  caseLabel: shortText,
  description: longText,
  amountFt: z.union([z.string().regex(/^\d{1,15}$/), z.number().int().positive()]),
  recoveredAt: dateStr,
  sourceUrl: url,
  sourceName: shortText,
});

const closureRow = z.object({
  name: shortText,
  eventType: z.enum(['megszűnés', 'leépítés', 'elmaradt esemény', 'egyéb']),
  description: z.string().trim().min(1).max(200),
  eventDate: dateStr,
  sourceUrl: url,
  sourceName: shortText,
});

const tableEnum = z.enum(['CourtVerdict', 'PoliticalResignation', 'CriminalComplaint', 'AssetRecovery', 'MediaClosure']);

const body = z.discriminatedUnion('op', [
  z.object({ op: z.literal('status') }),
  z.object({ op: z.literal('news'), hours: z.number().int().min(1).max(72).default(26) }),
  z.object({ op: z.literal('find'), table: tableEnum, q: z.string().trim().min(2).max(100) }),
  z.object({ op: z.literal('insert'), table: tableEnum, row: z.record(z.unknown()) }),
  z.object({
    op: z.literal('update_verdict'),
    id: z.string().uuid(),
    summaryAppend: z.string().trim().min(1).max(1500).optional(),
    verdictType: verdictTypeEnum.optional(),
    addSource: z.object({ url, name: shortText, headline: z.string().trim().min(1).max(500), date: dateStr }).optional(),
  }),
]);

const d = (s: string) => new Date(s.length === 10 ? `${s}T00:00:00Z` : s);

function revalidateAll() {
  for (const p of ['/', '/birosagi-iteletek', '/lemondasok', '/visszaszerzett-vagyon', '/megszunt']) {
    try {
      revalidatePath(p);
    } catch {
      /* nem kritikus */
    }
  }
}

export async function POST(req: Request) {
  if (!verifyDailyReviewRequest(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let parsed: z.infer<typeof body>;
  try {
    parsed = body.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: 'invalid body', detail: e instanceof z.ZodError ? e.issues : String(e) }, { status: 400 });
  }

  const db = getDb();
  try {
    switch (parsed.op) {
      case 'status': {
        const [r] = await db.select({ last: sql<Date | null>`max(${schema.dailyLlmUsage.lastCallAt})` }).from(schema.dailyLlmUsage);
        return NextResponse.json({ lastLlmCallAt: r?.last ?? null });
      }

      case 'news': {
        const since = new Date(Date.now() - parsed.hours * 3600_000);
        const rows = await db
          .select({
            id: schema.newsArticles.id,
            publishedAt: schema.newsArticles.publishedAt,
            source: schema.sources.name,
            headline: schema.newsArticles.headline,
            excerpt: schema.newsArticles.excerpt,
            url: schema.newsArticles.sourceUrl,
          })
          .from(schema.newsArticles)
          .leftJoin(schema.sources, eq(schema.sources.id, schema.newsArticles.sourceId))
          .where(gte(schema.newsArticles.createdAt, since))
          .orderBy(schema.newsArticles.publishedAt)
          .limit(800);
        return NextResponse.json({ count: rows.length, rows: rows ?? [] });
      }

      case 'find': {
        const q = `%${parsed.q}%`;
        let rows: unknown[] = [];
        if (parsed.table === 'CourtVerdict') {
          const t = schema.courtVerdicts;
          rows = await db.select({ id: t.id, personName: t.personName, verdictType: t.verdictType, verdictDate: t.verdictDate, court: t.court, summary: t.summary, sourceUrls: t.sourceUrls, reviewStatus: t.reviewStatus })
            .from(t).where(or(ilike(t.personName, q), ilike(t.summary, q))).orderBy(desc(t.verdictDate)).limit(20);
        } else if (parsed.table === 'PoliticalResignation') {
          const t = schema.politicalResignations;
          rows = await db.select({ id: t.id, name: t.name, position: t.position, institution: t.institution, resignationType: t.resignationType, resignationDate: t.resignationDate, reviewStatus: t.reviewStatus })
            .from(t).where(or(ilike(t.name, q), ilike(t.institution, q))).orderBy(desc(t.resignationDate)).limit(20);
        } else if (parsed.table === 'CriminalComplaint') {
          const t = schema.criminalComplaints;
          rows = await db.select({ id: t.id, targetName: t.targetName, filerName: t.filerName, status: t.status, eventDate: t.eventDate, sourceUrls: t.sourceUrls, reviewStatus: t.reviewStatus })
            .from(t).where(or(ilike(t.targetName, q), ilike(t.description, q))).orderBy(desc(t.eventDate)).limit(20);
        } else if (parsed.table === 'AssetRecovery') {
          const t = schema.assetRecoveries;
          rows = await db.select({ id: t.id, caseId: t.caseId, caseLabel: t.caseLabel, amountFt: sql<string>`${t.amountFt}::text`, recoveredAt: t.recoveredAt, sourceUrl: t.sourceUrl })
            .from(t).where(or(ilike(t.caseLabel, q), ilike(t.description, q), ilike(t.caseId, q))).orderBy(desc(t.recoveredAt)).limit(20);
        } else {
          const t = schema.mediaClosures;
          rows = await db.select({ id: t.id, name: t.name, eventType: t.eventType, eventDate: t.eventDate, sourceUrl: t.sourceUrl })
            .from(t).where(ilike(t.name, q)).orderBy(desc(t.eventDate)).limit(20);
        }
        return NextResponse.json({ rows: rows ?? [] });
      }

      case 'insert': {
        const now = new Date();
        let id: string | undefined;
        if (parsed.table === 'CourtVerdict') {
          const r = verdictRow.parse(parsed.row);
          id = (await db.insert(schema.courtVerdicts).values({ ...r, verdictDate: d(r.verdictDate), reviewStatus: 'approved', createdAt: now, updatedAt: now }).returning({ id: schema.courtVerdicts.id }))[0]?.id;
        } else if (parsed.table === 'PoliticalResignation') {
          const r = resignationRow.parse(parsed.row);
          id = (await db.insert(schema.politicalResignations).values({ ...r, resignationDate: d(r.resignationDate), pinned: false, reviewStatus: 'approved', createdAt: now, updatedAt: now }).returning({ id: schema.politicalResignations.id }))[0]?.id;
        } else if (parsed.table === 'CriminalComplaint') {
          const r = complaintRow.parse(parsed.row);
          id = (await db.insert(schema.criminalComplaints).values({ ...r, eventDate: d(r.eventDate), filedAt: r.filedAt ? d(r.filedAt) : null, reviewStatus: 'approved', createdAt: now, updatedAt: now }).returning({ id: schema.criminalComplaints.id }))[0]?.id;
        } else if (parsed.table === 'AssetRecovery') {
          const r = recoveryRow.parse(parsed.row);
          id = (await db.insert(schema.assetRecoveries).values({ ...r, amountFt: BigInt(r.amountFt), recoveredAt: d(r.recoveredAt), createdAt: now }).returning({ id: schema.assetRecoveries.id }))[0]?.id;
        } else {
          const r = closureRow.parse(parsed.row);
          id = (await db.insert(schema.mediaClosures).values({ ...r, eventDate: d(r.eventDate), pinned: false, reviewStatus: 'approved', createdAt: now, updatedAt: now }).returning({ id: schema.mediaClosures.id }))[0]?.id;
        }
        revalidateAll();
        return NextResponse.json({ ok: true, id });
      }

      case 'update_verdict': {
        const t = schema.courtVerdicts;
        const [row] = await db.select({ id: t.id, summary: t.summary, sourceUrls: t.sourceUrls }).from(t).where(eq(t.id, parsed.id)).limit(1);
        if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
        const set: Record<string, unknown> = { updatedAt: new Date() };
        if (parsed.summaryAppend && !row.summary.includes(parsed.summaryAppend)) set.summary = `${row.summary} ${parsed.summaryAppend}`;
        if (parsed.verdictType) set.verdictType = parsed.verdictType;
        const src = parsed.addSource;
        if (src && !(row.sourceUrls ?? []).includes(src.url)) {
          set.sourceUrls = sql`array_append(${t.sourceUrls}, ${src.url})`;
          set.sourceNames = sql`array_append(${t.sourceNames}, ${src.name})`;
          set.sourceHeadlines = sql`array_append(${t.sourceHeadlines}, ${src.headline})`;
          set.sourceDates = sql`array_append(${t.sourceDates}, ${src.date})`;
        }
        await db.update(t).set(set).where(and(eq(t.id, parsed.id)));
        revalidateAll();
        return NextResponse.json({ ok: true, changed: Object.keys(set).filter((k) => k !== 'updatedAt') });
      }
    }
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: 'invalid row', detail: e.issues }, { status: 400 });
    return NextResponse.json({ error: 'db error', detail: String(e).slice(0, 300) }, { status: 500 });
  }
}
