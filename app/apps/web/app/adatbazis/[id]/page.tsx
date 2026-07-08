import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';

import { fmtNumber } from '@korr/shared/format';
import { FtValue } from '../../_home/ft-value';
import { GALERIA } from '../../_home/galeria-config';
import { WATCH_LIST } from '../../_home/watchlist-config';
import { getCaseOverride, cleanTitle, autoDisplayTitle, PERSON_PHOTOS, RETIRED_REDIRECTS, toAsciiId } from '../../_home/case-detail-config';
import { getCaseVideo } from '../../_home/case-video-registry';
import { fetchYouTubeMeta } from '@/lib/youtube-meta';
import { DamageFigure } from '../_components/damage-figure';
import { CaseTimeline } from '../_components/case-timeline';
import { DescBlock } from '../_components/desc-block';
import type { DescriptionBlock } from '../../_home/ugyek-config';
import generatedContent from '../../_home/case-content.generated.json';
import { getDb } from '@/lib/db';
import { truncate } from '../../_home/seo';
import { PERSON_ROLLUPS } from '../../_home/person-rollup-config';
import { getPersonStats } from '../../_home/featured-persons';
import { PersonGaleriaPromo, CrossAdatbazisSzemelyek, CrossUgyek, CrossBirosag } from '../../_home/cross-promo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = (() => { try { return decodeURIComponent(rawId).normalize('NFC'); } catch { return rawId; } })();
  const db = getDb();
  const override = getCaseOverride(id);
  const gen = (generatedContent as Record<string, { title?: string }>)[id];
  const rows = (await db.execute(sql`
    SELECT sc.name, sc.person, sc.institution FROM "ScandalCatalog" sc WHERE sc.id = ${id} LIMIT 1
  `)) as unknown as Array<{ name: string; person: string | null; institution: string | null }>;
  let scandal = rows[0];
  if (!scandal) {
    // DB id may carry accents the (canonical, ascii) URL doesn't — see the
    // matching fallback in the page body below.
    try {
      const fallbackRows = (await db.execute(sql`
        SELECT sc.name, sc.person, sc.institution FROM "ScandalCatalog" sc WHERE unaccent(sc.id) = unaccent(${id}) LIMIT 1
      `)) as unknown as Array<{ name: string; person: string | null; institution: string | null }>;
      scandal = fallbackRows[0];
    } catch {
      // unaccent() unavailable — fall through to {} below like a genuine miss.
    }
  }
  if (!scandal) return {};
  const title = autoDisplayTitle(scandal.name, scandal.person, override?.title ?? gen?.title);
  const description =
    override?.summary ??
    `${scandal.person ?? scandal.institution ?? 'Korrupciós ügy'} — dokumentált eset a Kegyencjárat adatbázisában, sajtóforrások alapján.`;
  return {
    title: truncate(title, 40),
    description: truncate(description, 150),
  };
}

const HU_MONTHS = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];
function fmtDate(d: Date): string {
  const x = new Date(d);
  return `${x.getFullYear()}. ${HU_MONTHS[x.getMonth()]} ${x.getDate()}.`;
}

function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '').trim();
}

function imgSrc(url: string): string {
  if (url.startsWith('/') || url.includes('wikimedia.org')) return url;
  return `/api/img-proxy?url=${encodeURIComponent(url)}`;
}

const NUMBER_IN_NAME = /\d[\d\s.,]*\s*(milli[aá]rd|mrd|milli[oó]|md)\b/i;

// Tokenize a scandal key for title-relevance scoring.
// Min length 3 to capture short but specific abbreviations (mcc, mol, nka, tao).
// Stop list covers generic Hungarian nouns that would match unrelated articles.
const STOP_TOKENS = new Set([
  'ugy', 'eset', 'per', 'botrany', 'vallalat', 'allami', 'allam', 'ugyek', 'korrupcios',
  'szerzodes', 'gyar', 'ingatlan', 'beruhazas', 'tamogatas', 'biznisz', 'kozpenz',
  'vezerigazgato', 'fejlesztes', 'kozbeszerzesi', 'kozossegi',
]);
function tokenizeKey(id: string): string[] {
  return id.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .split('-')
    .filter(t => t.length >= 3 && !/^\d+$/.test(t) && !STOP_TOKENS.has(t));
}
function scoreTitle(title: string, id: string): number {
  const tokens = tokenizeKey(id);
  const n = title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return tokens.filter(t => n.includes(t)).length;
}

// Auto-generated placeholder summaries ("X — besorolatlan (1 cikk)") carry no
// real information — treat them as empty so we show an honest state instead.
function isJunkSummary(s: string | null | undefined): boolean {
  if (!s) return true;
  const t = s.trim();
  if (t.length < 25) return true;
  if (/—\s*besorolatlan/i.test(t)) return true;
  if (/\(\s*\d+\s*cikk\s*\)\s*$/i.test(t)) return true;
  return false;
}

const BASIS_LABEL: Record<string, string> = {
  estimated_rough: 'Durva becslés sajtóadatokból',
  alleged_reported: 'Sajtóban közölt vélelmezett kár',
  procurement_modeled: 'Közbeszerzési (TED) adat alapján modellezve',
};
const CONF_HU: Record<string, string> = { low: 'alacsony', medium: 'közepes', high: 'magas' };

type ScandalHeader = {
  id: string;
  name: string;
  person: string | null;
  institution: string | null;
  summary: string | null;
  article_count: number;
  investigation_count: number;
  damage_huf: string;
  is_open: boolean;
  offence_labels: string | null;
};
type DamageRow = { totalHighHuf: string; confidence: string; basis: string | null; components: Array<{ notes?: string }> | null };
type ProcRow = { proceduralStage: string | null; competentAuthority: string | null };
type Member = { id: string; caseName: string | null; primaryPersonName: string | null; primaryEntityName: string | null; articleCount: number };
type CrossRef = { id: string; name: string; person: string | null; institution: string | null; article_count: number; damage_huf: string; offence_labels: string | null };
type Article = { id: string; headline: string; excerpt: string | null; sourceUrl: string; publishedAt: Date; source_name: string | null };
type KmdbRow = { news_id: number; title: string; source_url: string; kmdb_url: string; newspaper: string | null; pub_time: string | null; total: number };

export default async function ScandalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = (() => { try { return decodeURIComponent(rawId).normalize('NFC'); } catch { return rawId; } })();
  if (RETIRED_REDIRECTS[id]) redirect(RETIRED_REDIRECTS[id]);
  const db = getDb();
  const override = getCaseOverride(id);
  type GenEntry = { title?: string; filesKey?: string; blocks: DescriptionBlock[]; relatedNews?: { source: string; headline: string; date: string; url: string }[]; attribution?: string };
  const gen = (generatedContent as Record<string, GenEntry>)[id];
  // Editorial override wins; otherwise the LLM-generated (K-Monitor sourced) blocks.
  const richBlocks: DescriptionBlock[] | undefined = override?.descriptionBlocks ?? gen?.blocks;
  // Injektált article-card — feltöltve a DB-lekérdezések után (ld. displayBlocks).

  const headSelect = sql`
    SELECT sc.id, sc.name, sc.person, sc.institution, sc.summary, sc.article_count,
           sc.investigation_count, sc.damage_huf, sc.is_open,
           (SELECT string_agg(o."labelHu", ', ' ORDER BY o."sortOrder")
            FROM "OffenceTypeRef" o WHERE o.code = ANY(sc.offence_codes)) AS offence_labels
    FROM "ScandalCatalog" sc`;
  const headRes = (await db.execute(sql`${headSelect} WHERE sc.id = ${id} LIMIT 1`)) as unknown as ScandalHeader[];
  let scandal = headRes[0];
  if (!scandal) {
    // No exact match — Investigation.scandalKey (the ScandalCatalog id) can
    // carry accents (e.g. "quaestor-dalkot-adatbiztonság") that the
    // (canonical, ascii) URL never shows. Resolve via Postgres unaccent()
    // and render straight through — the address bar already holds the
    // ascii canonical URL, so no further redirect is needed for this case.
    try {
      const fallbackRes = (await db.execute(
        sql`${headSelect} WHERE unaccent(sc.id) = unaccent(${id}) LIMIT 1`,
      )) as unknown as ScandalHeader[];
      scandal = fallbackRes[0];
    } catch {
      // unaccent() unavailable — fall through to notFound() below.
    }
    if (!scandal) notFound();
  }

  // Ascii is canonical for every /adatbazis/ URL — if what's currently in
  // the address bar carries accents (an old external link, or someone
  // pasting the DB's own accented scandalKey), redirect to the ascii form
  // so an accented URL never stays live on-site.
  const asciiId = toAsciiId(id);
  if (asciiId !== id) redirect(`/adatbazis/${encodeURIComponent(asciiId)}`);

  const [damageRows, procRows, members, crossRefs, articles, kmdbArticles, linkedKmdbArticles] = await Promise.all([
    db.execute(sql`
      SELECT d."totalHighHuf", d.confidence, d.basis, d.components
      FROM "DamageEstimate" d JOIN "Investigation" i ON i.id = d."investigationId"
      WHERE i."scandalKey" = ${id} ORDER BY d."totalHighHuf" DESC LIMIT 1
    `) as unknown as Promise<DamageRow[]>,
    db.execute(sql`
      SELECT "proceduralStage", "competentAuthority" FROM "Investigation"
      WHERE "scandalKey" = ${id} AND status NOT IN ('merged','dismissed')
      ORDER BY "articleCount" DESC NULLS LAST LIMIT 1
    `) as unknown as Promise<ProcRow[]>,
    db.execute(sql`
      SELECT id, "caseName", "primaryPersonName", "primaryEntityName", "articleCount"
      FROM "Investigation"
      WHERE "scandalKey" = ${id} AND status NOT IN ('merged','dismissed')
      ORDER BY "articleCount" DESC NULLS LAST
    `) as unknown as Promise<Member[]>,
    db.execute(sql`
      SELECT sc.id, sc.name, sc.person, sc.institution, sc.article_count, sc.damage_huf,
        (SELECT string_agg(o."labelHu", ', ' ORDER BY o."sortOrder")
         FROM "OffenceTypeRef" o WHERE o.code = ANY(sc.offence_codes)) AS offence_labels
      FROM "ScandalCatalog" sc
      WHERE sc.id <> ${id}
        AND ((${scandal.person}::text IS NOT NULL AND sc.person = ${scandal.person})
          OR (${scandal.institution}::text IS NOT NULL AND sc.institution = ${scandal.institution}))
      ORDER BY sc.damage_huf DESC LIMIT 8
    `) as unknown as Promise<CrossRef[]>,
    db.execute(sql`
      SELECT DISTINCT n.id, n.headline, n.excerpt, n."sourceUrl", n."publishedAt", s.name AS source_name
      FROM "InvestigationArticleLink" l
      JOIN "Investigation" i ON i.id = l."investigationId"
      JOIN "NewsArticle" n ON n.id::text = l."articleId" AND l."articleSource" = 'news'
      LEFT JOIN "Source" s ON s.id = n."sourceId"
      WHERE i."scandalKey" = ${id}
      ORDER BY n."publishedAt" DESC LIMIT 24
    `) as unknown as Promise<Article[]>,
    // InvestigationArticleLink → KmdbArticle; több cikket kérünk, hogy cím alapján rangsorolhassuk
    (db.execute(sql`
      SELECT DISTINCT k.news_id, k.title, k.source_url, k.newspaper, k.pub_time
      FROM "InvestigationArticleLink" l
      JOIN "Investigation" i ON i.id = l."investigationId"
      JOIN "KmdbArticle" k ON k.news_id::text = l."articleId" AND l."articleSource" = 'kmonitor'
      WHERE i."scandalKey" = ${id}
      ORDER BY k.pub_time DESC LIMIT 20
    `) as unknown as Promise<KmdbRow[]>).catch(() => [] as KmdbRow[]),
    // Phase 2: if a curated K-Monitor filesKey exists, query by case (precise);
    // otherwise fall back to person-wide articles (broader but less specific).
    (db.execute(gen?.filesKey
      ? sql`SELECT news_id, title, source_url, kmdb_url, newspaper, pub_time,
                   count(*) OVER()::int AS total
            FROM "KmdbArticle"
            WHERE ${gen.filesKey} = ANY(files)
            ORDER BY pub_time DESC LIMIT 40`
      : sql`SELECT news_id, title, source_url, kmdb_url, newspaper, pub_time,
                   count(*) OVER()::int AS total
            FROM "KmdbArticle"
            WHERE ${scandal.person}::text IS NOT NULL AND ${scandal.person} = ANY(persons)
            ORDER BY pub_time DESC LIMIT 40`
    ) as unknown as Promise<KmdbRow[]>).catch(() => [] as KmdbRow[]),
  ]);

  const damage = BigInt(scandal.damage_huf);
  const dmg = damageRows[0];
  const proc = procRows[0];

  // ── Honest damage (FR-005) ──
  const basis = dmg?.basis ?? null;
  const conf = dmg?.confidence ?? null;
  const numberInName = NUMBER_IN_NAME.test(scandal.name);
  const autoSuppress =
    basis !== 'procurement_modeled' &&
    ((numberInName && scandal.article_count <= 2) || (conf === 'low' && basis === 'estimated_rough'));
  const damageSuppressed = override?.hideAutoDamage ?? autoSuppress;
  // Clean one-liner basis only — never the reprice LLM's internal notes/confidence.
  const basisText = override?.damageText ?? (basis ? BASIS_LABEL[basis] : null);

  // ── Hero ──
  const title = autoDisplayTitle(scandal.name, scandal.person, override?.title ?? gen?.title);
  const galeriaEntry = override?.hidePhoto
    ? null
    : override?.galeriaId
      ? GALERIA.find((g) => g.id === override.galeriaId)
      : GALERIA.find((g) => norm(g.name) === norm(scandal.person));
  const watchEntry = (!override?.hidePhoto && !galeriaEntry)
    ? WATCH_LIST.find((w) => norm(w.name) === norm(scandal.person))
    : null;
  const personPhotoEntry = (!override?.hidePhoto && !galeriaEntry && !watchEntry)
    ? (PERSON_PHOTOS[scandal.person ?? ''] ?? null)
    : null;
  const photoUrl = galeriaEntry?.photoUrl ?? watchEntry?.photoUrl ?? personPhotoEntry?.photoUrl ?? null;
  const photoCredit = galeriaEntry?.photoCredit ?? watchEntry?.photoCredit ?? personPhotoEntry?.photoCredit ?? null;
  const photoObjectPosition = galeriaEntry?.photoObjectPosition ?? watchEntry?.objectPosition ?? personPhotoEntry?.photoObjectPosition ?? null;
  const initials = (scandal.person ?? scandal.name).split(' ').slice(0, 2).map((w) => w[0]).join('');
  const badgeColor = scandal.is_open ? '#e31937' : '#4a6a8a';

  // "Minden X-ról" cross-promo csak akkor, ha ennek az ügynek a személye a
  // 10 GALERIA-profillal is rendelkező kiemelt személy egyike — ugyanaz a
  // feltétel, mint a person-rollup oldalon.
  const personRollupConfig = galeriaEntry
    ? PERSON_ROLLUPS.find((p) => norm(p.personName) === norm(galeriaEntry.name))
    : null;
  const personRollupStats = personRollupConfig
    ? await getPersonStats(db, personRollupConfig.personName, personRollupConfig.excludeIds ?? [])
    : null;

  const offenceLabels = override?.crimeTypes ??
    (scandal.offence_labels ? scandal.offence_labels.split(', ').filter(Boolean) : []);

  // Never render the old DB summary — it carries unsupported procedural claims.
  // Only a vetted editorial summary appears in the hero.
  const summaryText = override?.summary ?? null;

  // Per-person YouTube video (registry); override.video wins.
  const caseVideo = override?.video || override?.hideVideo ? null : getCaseVideo(scandal.person);

  // Auto-fetch title + channel from YouTube oEmbed (cached 24h server-side).
  const [caseVideoMeta, overrideVideoMeta] = await Promise.all([
    caseVideo ? fetchYouTubeMeta(caseVideo.videoId) : Promise.resolve(null),
    override?.video ? fetchYouTubeMeta(override.video.id) : Promise.resolve(null),
  ]);

  // Related news: curated (generated) set if present, otherwise the responsible
  // person's real K-Monitor articles. Plus any daily-scrape linked articles.
  const usingGenNews = (gen?.relatedNews?.length ?? 0) > 0;
  const newsList: { source: string; date: string | null; headline: string; url: string }[] = [
    ...(usingGenNews
      ? gen!.relatedNews!.map((a) => ({ source: a.source, date: a.date, headline: a.headline, url: a.url }))
      : kmdbArticles.map((a) => ({ source: a.newspaper ?? 'Forrás', date: a.pub_time, headline: a.title, url: a.source_url }))),
    ...articles.map((a) => ({ source: a.source_name ?? 'Forrás', date: a.publishedAt.toISOString(), headline: a.headline, url: a.sourceUrl })),
  ];
  const kmdbTotal = kmdbArticles[0]?.total ?? 0;

  // Ha a leírásban nincs article-card, injektálunk egyet — csak ügy-specifikus forrásból.
  // Prioritás: 1) filesKey-szűrt K-Monitor, 2) legjobb cím-egyezésű linked KmdbArticle,
  // 3) legjobb cím-egyezésű scrape-elt NewsArticle. Ha nincs min. 1 tokenegyezés, nem injektálunk.
  const hasArticleCard = richBlocks?.some(b => b.type === 'article-card') ?? false;
  let injectedCard: DescriptionBlock | null = null;
  if (!hasArticleCard) {
    const byFilesKey = gen?.filesKey && kmdbArticles.length > 0 ? kmdbArticles[0] : null;
    const linked = linkedKmdbArticles.length > 0
      ? [...linkedKmdbArticles].sort((a, b) => scoreTitle(b.title, id) - scoreTitle(a.title, id)).find(a => scoreTitle(a.title, id) > 0) ?? null
      : null;
    const scraped = articles.length > 0
      ? [...articles].sort((a, b) => scoreTitle(b.headline, id) - scoreTitle(a.headline, id)).find(a => scoreTitle(a.headline, id) > 0) ?? null
      : null;
    const src = byFilesKey ?? linked ?? scraped ?? null;
    if (src) {
      injectedCard = 'headline' in src
        ? { type: 'article-card', source: src.source_name ?? 'Forrás', headline: src.headline, date: src.publishedAt.toISOString().slice(0, 10), url: src.sourceUrl }
        : { type: 'article-card', source: src.newspaper ?? 'K-Monitor', headline: src.title, date: src.pub_time ?? undefined, url: src.source_url };
    }
  }
  const displayBlocks: DescriptionBlock[] | undefined =
    richBlocks && injectedCard ? [...richBlocks, injectedCard] : richBlocks;

  // Pinned cross-refs: override-ban megadott ID-k kerülnek előre.
  // Ha egy pinned ügy nem szerepel az auto-lekérdezésben (más person/institution),
  // külön fetch-eljük és beillesztjük az elejére.
  const pinnedIds = override?.pinnedCrossRefIds ?? [];
  let orderedCrossRefs = crossRefs;
  if (pinnedIds.length > 0) {
    const missingIds = pinnedIds.filter(pid => !crossRefs.find(r => r.id === pid));
    const extraRefs: CrossRef[] = missingIds.length > 0
      ? (await db.execute(sql`
          SELECT sc.id, sc.name, sc.person, sc.institution, sc.article_count, sc.damage_huf,
            (SELECT string_agg(o."labelHu", ', ' ORDER BY o."sortOrder")
             FROM "OffenceTypeRef" o WHERE o.code = ANY(sc.offence_codes)) AS offence_labels
          FROM "ScandalCatalog" sc
          WHERE sc.id IN (${sql.join(missingIds.map((v) => sql`${v}`), sql`, `)})
        `) as unknown as CrossRef[])
      : [];
    const allRefs = [...crossRefs, ...extraRefs];
    orderedCrossRefs = [
      ...pinnedIds.map(pid => allRefs.find(r => r.id === pid)).filter((r): r is CrossRef => r != null),
      ...allRefs.filter(r => !pinnedIds.includes(r.id)),
    ];
  }

  // Procedural stage is only meaningful when we actually have corroborating
  // coverage. A lone default 'reported' on a 1-article case is noise, not fact.
  const procWeak =
    !proc?.proceduralStage ||
    (proc.proceduralStage === 'reported' && articles.length === 0 && (scandal.article_count ?? 0) <= 1);

  // ── Related persons: editorial override ids ∪ auto-derived galeria persons
  // who appear in this scandal's member investigations or cross-referenced
  // cases (excluding the primary person). Real data only — no fabrication. ──
  type RelatedPerson = { id: string; name: string; subtitle: string; photoUrl: string | null; href: string; kind: 'galeria' | 'watch' };
  const relatedPersons: RelatedPerson[] = [];
  const seenPersonIds = new Set<string>();
  function pushPerson(p: RelatedPerson) {
    if (seenPersonIds.has(p.id)) return;
    seenPersonIds.add(p.id);
    relatedPersons.push(p);
  }
  const galeriaCard = (g: (typeof GALERIA)[number]): RelatedPerson => ({
    id: g.id, name: g.name, subtitle: (g.subtitle.split('·')[0] ?? '').trim(),
    photoUrl: g.photoUrl ?? null, href: `/galeria/${g.id}`, kind: 'galeria',
  });

  // 1) editorial override ids (galeria or watchlist)
  for (const pid of override?.relatedPersonIds ?? []) {
    const gal = GALERIA.find((g) => g.id === pid);
    if (gal) { pushPerson(galeriaCard(gal)); continue; }
    const w = WATCH_LIST.find((x) => x.id === pid);
    if (w) pushPerson({ id: w.id, name: w.name, subtitle: w.institution, photoUrl: w.photoUrl ?? null, href: `/lemondasok/${w.id}`, kind: 'watch' });
  }

  // 2) auto: galeria persons co-occurring in members / cross-refs (not the main person)
  const mainNorm = norm(scandal.person);
  const coNames = [
    ...members.map((m) => m.primaryPersonName),
    ...crossRefs.map((c) => c.person),
  ].filter((n): n is string => Boolean(n));
  for (const nm of coNames) {
    if (norm(nm) === mainNorm) continue;
    const gal = GALERIA.find((g) => norm(g.name) === norm(nm));
    if (gal) pushPerson(galeriaCard(gal));
  }

  return (
    <div className="person-page ugy-page">
      {/* ── Hero ── */}
      <div className="person-hero">
        <div className="person-hero-inner">
          <div className="person-hero-photo">
            {photoUrl ? (
              <img src={imgSrc(photoUrl)} alt={scandal.person ?? title} className="person-photo-img" style={photoObjectPosition ? { objectPosition: photoObjectPosition } : undefined} />
            ) : (
              <div className="person-photo-placeholder"><span>{initials || '?'}</span></div>
            )}
            {photoCredit && <div className="photo-credit">{photoCredit}</div>}
          </div>

          <div className="person-hero-text">
            <div className="person-hero-eyebrow">Adatbázis · ügy</div>
            <h1 className="person-hero-name">{title}</h1>
            <div className="person-hero-sub">
              {[scandal.person, override?.institution ?? scandal.institution].filter(Boolean).join(' · ') || '—'}
            </div>

            <div className="person-hero-amount">
              <DamageFigure huf={damage} suppressed={damageSuppressed} basisText={basisText} label={override?.damageLabel ?? 'Érintett közpénz'} />
            </div>

            {summaryText && <p className="person-hero-desc">{summaryText}</p>}

            {offenceLabels.length > 0 && (
              <div className="person-hero-tags">
                {offenceLabels.map((c) => <span key={c} className="tag">{c}</span>)}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="person-body">
        {/* ── Curated body / summary ── */}
        <div className="ugy-description">
          <h2 className="person-section-title">Az ügy ismertetése</h2>
          <p className="person-section-note">
            Sajtójelentések és nyilvánosan hozzáférhető dokumentumok alapján. Jogerős ítélet
            hiányában az érintett személyek ártatlannak tekintendők.
          </p>
          <div className="ugy-description-body">
            {displayBlocks?.length ? (
              displayBlocks.map((b, i) => <DescBlock key={i} block={b} />)
            ) : summaryText ? (
              <p>{summaryText}</p>
            ) : (
              <p style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
                Részletes ismertető még nem készült ehhez az ügyhöz. Az alábbi szekciók a
                nyilvánosan elérhető adatokból, automatikusan épülnek.
              </p>
            )}
          </div>
          {gen?.attribution && (
            <p className="ugy-sources-disclaimer" style={{ marginTop: 16 }}>{gen.attribution}</p>
          )}
        </div>

        {/* ── Case video (registry, by primary person) ── */}
        {caseVideo && (caseVideo.linkOnly ? (
          <a
            href={`https://www.youtube.com/watch?v=${caseVideo.videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ugy-block-article-card"
            style={{ margin: 0 }}
          >
            <div className="ugy-block-article-meta">
              <span className="ugy-block-article-source">{caseVideoMeta?.channel ?? 'YouTube'}</span>
            </div>
            <div className="ugy-block-article-headline">
              {caseVideoMeta?.title ?? 'Videó megtekintése'}
            </div>
            {caseVideo.summary && <p className="ugy-block-article-lead">{caseVideo.summary}</p>}
            <span className="ugy-block-article-arrow">Videó megtekintése →</span>
          </a>
        ) : (
          <div className="person-video-section">
            {((caseVideoMeta?.channel ?? caseVideo.channel) || (caseVideoMeta?.title ?? caseVideo.title) || caseVideo.summary) && (
              <div className="person-video-teaser">
                {(caseVideoMeta?.channel ?? caseVideo.channel) && <div className="person-video-teaser-channel">{caseVideoMeta?.channel ?? caseVideo.channel}</div>}
                {(caseVideoMeta?.title ?? caseVideo.title) && <h3 className="person-video-teaser-title">{caseVideoMeta?.title ?? caseVideo.title}</h3>}
                {caseVideo.summary && <p className="person-video-teaser-desc">{caseVideo.summary}</p>}
              </div>
            )}
            <div className="person-video-wrap">
              <iframe
                src={`https://www.youtube.com/embed/${caseVideo.videoId}`}
                title={caseVideoMeta?.title ?? caseVideo.title ?? title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            {caseVideo.moreUrl && (
              <Link href={caseVideo.moreUrl} className="person-case-source" style={{ marginTop: 12, display: 'inline-block' }}>
                {caseVideo.moreLabel ?? 'Tovább →'}
              </Link>
            )}
          </div>
        ))}

        {/* ── Procedural timeline (only when corroborated, not a default stub) ── */}
        {/* Eljárási állapot elrejtve: a pipeline proceduralStage-e megbízhatatlan,
            forrással nem alátámasztott — csak hivatkozott adatból mutatjuk majd. */}
        {false && !procWeak && (
          <div className="case-section">
            <h2 className="person-section-title">Eljárási állapot</h2>
            <CaseTimeline stage={proc?.proceduralStage ?? null} authority={proc?.competentAuthority ?? null} />
          </div>
        )}

        {/* ── Curated videos ── */}
        {override?.video && (
          <div className="person-video-section">
            {((overrideVideoMeta?.channel ?? override.video.channel) || (overrideVideoMeta?.title ?? override.video.title) || override.video.summary) && (
              <div className="person-video-teaser">
                {(overrideVideoMeta?.channel ?? override.video.channel) && <div className="person-video-teaser-channel">{overrideVideoMeta?.channel ?? override.video.channel}</div>}
                {(overrideVideoMeta?.title ?? override.video.title) && <h3 className="person-video-teaser-title">{overrideVideoMeta?.title ?? override.video.title}</h3>}
                {override.video.summary && <p className="person-video-teaser-desc">{override.video.summary}</p>}
              </div>
            )}
            <div className="person-video-wrap">
              <iframe
                src={`https://www.youtube.com/embed/${override.video.id}`}
                title={overrideVideoMeta?.title ?? override.video.title ?? title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        )}
        {override?.additionalVideos && override.additionalVideos.length > 0 && (
          <div className="ugy-extra-videos">
            <h2 className="person-section-title">Kapcsolódó videók</h2>
            <div className="ugy-extra-videos-grid">
              {override.additionalVideos.map((v) => (
                <div key={v.id} className="ugy-extra-video">
                  <div className="ugy-extra-video-meta">
                    <span className="ugy-extra-video-label">{v.label}</span>
                    <span className="ugy-extra-video-title">{v.title}</span>
                  </div>
                  <div className="ugy-extra-video-wrap">
                    <iframe
                      src={`https://www.youtube.com/embed/${v.id}`}
                      title={v.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Related cases — galeria numbered "person-case" design (1:1) ── */}
        {orderedCrossRefs.length > 0 && (
          <div className="person-cases">
            <h2 className="person-section-title">Kapcsolódó ügyek</h2>
            <p className="person-section-note">
              Ugyanahhoz a személyhez vagy intézményhez köthető további ügyek az adatbázisból.
            </p>
            {orderedCrossRefs.map((r, i) => {
              const rd = BigInt(r.damage_huf);
              const showDmg = rd > 0n && r.article_count >= 3;
              const tags = r.offence_labels ? r.offence_labels.split(', ').filter(Boolean) : [];
              return (
                <div key={r.id} className="person-case-card">
                  <div className="person-case-num">/ {String(i + 1).padStart(2, '0')}</div>
                  <div className="person-case-body">
                    <Link href={`/adatbazis/${encodeURIComponent(toAsciiId(r.id))}`} className="person-case-title">{cleanTitle(r.name)}</Link>
                    {(r.person || r.institution) && (
                      <p className="person-case-desc">
                        {[r.person, r.institution].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    <div className="person-case-footer">
                      {showDmg && (
                        <div className="person-case-dmg">
                          <span className="person-case-dmg-lbl">Érintett közpénz</span>
                          <span className="person-case-dmg-val"><FtValue n={rd} /></span>
                        </div>
                      )}
                      {tags.length > 0 && (
                        <div className="person-case-crimes">
                          {tags.map((t) => <span key={t} className="tag">{t}</span>)}
                        </div>
                      )}
                      <Link href={`/adatbazis/${encodeURIComponent(toAsciiId(r.id))}`} className="person-case-source">
                        Részletek →
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Member investigations (clickable cards) ── */}
        {scandal.investigation_count > 1 && (
          <div className="case-section">
            <h2 className="person-section-title">Kapcsolódó ügyrészek</h2>
            <div className="ugyek-more-grid">
              {members.map((m) => (
                <Link
                  key={m.id}
                  href={`/adatbazis?q=${encodeURIComponent(m.primaryPersonName ?? m.caseName ?? '')}`}
                  className="ugyek-more-card"
                >
                  <div className="ugyek-more-eyebrow">{fmtNumber(m.articleCount)} cikk</div>
                  <div className="ugyek-more-title">{m.caseName ?? '—'}</div>
                  {m.primaryPersonName && (
                    <div className="ugyek-more-sub">
                      {m.primaryPersonName}
                      {m.primaryEntityName ? ` · ${m.primaryEntityName}` : ''}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Related news — curated set, else the person's real K-Monitor articles ── */}
        {newsList.length > 0 ? (
          <div className="person-news">
            <h2 className="person-section-title">Kapcsolódó hírek</h2>
            <p className="person-section-note">
              {usingGenNews
                ? 'A K-Monitor sajtóadatbázisból — az ügyhöz kötődő legfontosabb cikkek.'
                : gen?.filesKey
                  ? `A K-Monitor sajtóadatbázisból — ${fmtNumber(kmdbTotal)} cikk ehhez az ügyhez (a 40 legfrissebb).`
                  : `A K-Monitor sajtóadatbázisból — ${fmtNumber(kmdbTotal)} cikk a felelős személyhez (a 40 legfrissebb).`}
            </p>
            <div className="person-news-list">
              {newsList.map((a, i) => (
                <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="person-news-item">
                  <span className="person-news-source">{a.source}</span>
                  <span className="person-news-date">
                    {a.date && !Number.isNaN(Date.parse(a.date)) ? fmtDate(new Date(a.date)) : ''}
                  </span>
                  <span className="person-news-headline">{a.headline}</span>
                </a>
              ))}
            </div>
          </div>
        ) : (
          <div className="person-news">
            <h2 className="person-section-title">Kapcsolódó hírek</h2>
            <div className="person-news-empty">
              Még nincs hír ehhez az ügyhöz — a következő scrape során frissül.
            </div>
          </div>
        )}

        {/* ── Related persons ── */}
        {relatedPersons.length > 0 && (
          <div className="ugy-related-persons">
            <h2 className="person-section-title">Kapcsolódó személyek</h2>
            <div className="ugy-related-persons-grid">
              {relatedPersons.map((p) => (
                <Link key={p.id} href={p.href} className="ugy-related-person-card">
                  <div className="ugy-related-person-photo">
                    {p.photoUrl ? (
                      <img src={imgSrc(p.photoUrl)} alt={p.name} className="ugy-related-person-img" />
                    ) : (
                      <div className="ugy-related-person-placeholder">
                        <span>{p.name.split(' ').slice(0, 2).map((w) => w[0]).join('')}</span>
                      </div>
                    )}
                  </div>
                  <div className="ugy-related-person-text">
                    <div className="ugy-related-person-name">{p.name}</div>
                    <div className="ugy-related-person-sub">{p.subtitle}</div>
                    <div className="ugy-related-person-cta">{p.kind === 'galeria' ? 'Kiemelt személy →' : 'Felszólított →'}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Sources (override) ── */}
        {override?.sourceRefs && override.sourceRefs.length > 0 && (
          <div className="ugy-sources">
            <div className="ugy-sources-label">Forrás</div>
            <ul className="ugy-sources-list">
              {override.sourceRefs.map((ref, i) => (
                <li key={i}>
                  <a href={ref.url} target="_blank" rel="noopener noreferrer">{ref.label} →</a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── Footer nav ── */}
      <div className="person-more-section">
        <div className="person-more-inner">
          <Link href="/adatbazis" className="back-link">← Vissza az adatbázisba</Link>
        </div>
      </div>

      <div className="cross-promo-section">
        <div className="cross-promo-section-inner">
          {galeriaEntry && personRollupConfig && personRollupStats && (
            <PersonGaleriaPromo
              personName={galeriaEntry.name}
              caseCount={personRollupStats.caseCount}
              total={personRollupStats.total}
              photoUrl={photoUrl}
            />
          )}
          <CrossAdatbazisSzemelyek />
          <CrossUgyek />
          <CrossBirosag />
        </div>
      </div>
    </div>
  );
}
