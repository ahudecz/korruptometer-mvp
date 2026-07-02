import Link from 'next/link';
import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm';

import { fmtFt, fmtNumber } from '@korr/shared/format';
import { Pie3D, type PieSlice } from '@korr/ui/pie3d';
import { Ticker } from '@korr/ui/ticker';
import { Mugshot } from '@korr/ui/mugshot';

import { getDb, schema } from '@/lib/db';
import { getActiveBreaking } from '@/lib/breaking';
import { CaseFilters } from './adatbazis/case-filters';
import { ResignationsSection } from './_home/resignations-section';
import { MediaClosuresSection } from './_home/media-closures-section';
import { SubmissionCTA } from './_home/submission-cta';
import { SocialFeed } from './_home/social-feed';
import { FtValue } from './_home/ft-value';
import { CaseRow } from './adatbazis/_components/case-row';
import { BigCasesSection, type BigCaseConfig } from './_home/big-cases-section';
import { BreakingBanner } from './_home/breaking-banner';
import { GALERIA, type GaleriaDetention, type GaleriaHair } from './_home/galeria-config';
import { UGYEK } from './_home/ugyek-config';
import { autoDisplayTitle, getCaseDisplayTitle } from './_home/case-detail-config';
import { NewsCardImage } from './hirek/news-card-image';

export const dynamic = 'force-dynamic';
// Supabase Transaction Pooler cold start akár 15-20s; 30s limit megakadályozza
// a Vercel 10s default timeout-ot.
export const maxDuration = 30;

const PALETTE_MONEY = ['#e31937', '#171a20', '#5c5e62', '#9b9da1', '#cccccc', '#e6e6e6'];


type SectorEntry = { name: string; value: number };


const HU_MONTHS_SHORT = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];

function fmtShortDate(d: Date): string {
  return `${HU_MONTHS_SHORT[d.getMonth()]} ${d.getDate()}.`;
}

function fmtRecoveryDate(d: Date): string {
  return `${d.getFullYear()}. ${HU_MONTHS_SHORT[d.getMonth()]}`;
}

const RESIGNATION_TYPE_COLOR: Record<string, string> = {
  'lemondás': '#4B7AFF',
  'kirúgás': '#E31937',
  'felmentés': '#FF9D00',
  'egyéb': '#888',
};

function fmtRelative(d: Date): string {
  const diff = Date.now() - d.getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'most';
  if (h < 24) return `${h} órája`;
  if (h < 48) return 'tegnap';
  const days = Math.floor(h / 24);
  return `${days} napja`;
}

function fmtUpdatedAt(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd}. ${hh}:${mi}`;
}

export default async function HomePage() {
  const db = getDb();

  function articleSelect() {
    return db.select({
      id: schema.newsArticles.id,
      headline: schema.newsArticles.headline,
      sourceUrl: schema.newsArticles.sourceUrl,
      publishedAt: schema.newsArticles.publishedAt,
      sourceName: schema.sources.name,
    })
    .from(schema.newsArticles)
    .leftJoin(schema.sources, eq(schema.sources.id, schema.newsArticles.sourceId));
  }

  const HOMEPAGE_NEWS_TOPICS = [
    '%NKA%', '%MNB%', '%KESMA%', '%Mediaworks%',
    '%lélegeztetőgép%', '%aranykonvoj%', '%hatvanpuszta%', '%batida%',
    '%Mészáros Lőrinc%', '%Rogán%', '%Matolcsy%',
    '%Tiborcz%', '%Balásy%', '%Lázár János%',
    '%volvo%gate%', '%volvo-gate%',
    '%pesti srácok%', '%világgazdaság%',
    '%parkfenntart%', '%Őrsi Gergely%',
    '%Mandiner%',
  ] as const;

  // Összes független DB-lekérdezés párhuzamosan — cold start hatás minimalizálva.
  const [
    snapshot,
    topResignations,
    nkaArticles,
    mnbArticles,
    hatvanArticles,
    aranyArticles,
    volvoArticles,
    lelegArticles,
    parkArticles,
    resignationCountRaw,
    resignationsByType,
    closureCountRaw,
    pretrialCountDb,
    eliteltCountDb,
    pretrialByUgy,
    allRecoveries,
    latestResignations5,
    recentScandals,
    offRows,
    recentArticlesRaw,
    breakingArticles,
    yearSpanRes,
    totalPrisonYearsRaw,
  ] = await Promise.all([
    db.query.kpiSnapshots.findFirst({ where: eq(schema.kpiSnapshots.id, 'singleton') }),
    db.select().from(schema.politicalResignations)
      .where(eq(schema.politicalResignations.reviewStatus, 'approved'))
      .orderBy(desc(schema.politicalResignations.pinned), desc(schema.politicalResignations.resignationDate))
      .limit(20),
    articleSelect().where(eq(schema.newsArticles.tag, 'NKA')).orderBy(desc(schema.newsArticles.publishedAt)).limit(5),
    articleSelect().where(eq(schema.newsArticles.tag, 'MNB')).orderBy(desc(schema.newsArticles.publishedAt)).limit(5),
    articleSelect().where(ilike(schema.newsArticles.headline, '%hatvanpuszta%')).orderBy(desc(schema.newsArticles.publishedAt)).limit(5),
    articleSelect().where(ilike(schema.newsArticles.headline, '%aranykonvoj%')).orderBy(desc(schema.newsArticles.publishedAt)).limit(5),
    articleSelect().where(or(
      ilike(schema.newsArticles.headline, '%volvo gate%'),
      ilike(schema.newsArticles.headline, '%volvo-gate%'),
      ilike(schema.newsArticles.headline, '%bánki erik%'),
      ilike(schema.newsArticles.headline, '%tüke busz%'),
      eq(schema.newsArticles.tag, 'volvo-gate'),
    )).orderBy(desc(schema.newsArticles.publishedAt)).limit(5),
    articleSelect().where(or(
      ilike(schema.newsArticles.headline, '%lélegeztetőgép%'),
      ilike(schema.newsArticles.headline, '%fourcardinal%'),
    )).orderBy(desc(schema.newsArticles.publishedAt)).limit(5),
    articleSelect().where(or(
      ilike(schema.newsArticles.headline, '%parkfenntartás%'),
      ilike(schema.newsArticles.headline, '%parkfenntartá%'),
      ilike(schema.newsArticles.headline, '%Őrsi Gergely%'),
      ilike(schema.newsArticles.headline, '%Puskás Péter%'),
    )).orderBy(desc(schema.newsArticles.publishedAt)).limit(5),
    // A szerkesztőségi tömeges kirúgások a MediaClosure táblában "leépítés"-ként vannak nyilvántartva
    // ezért itt kihagyjuk őket, hogy a /lemondasok oldal összegzésével egyezzen a szám.
    db.select({ c: count() }).from(schema.politicalResignations)
      .where(sql`${schema.politicalResignations.reviewStatus} = 'approved' AND ${schema.politicalResignations.resignationType} IN ('lemondás','kirúgás','felmentés') AND ${schema.politicalResignations.name} NOT ILIKE '%szerkesztőség%'`)
      .then(r => r[0]?.c ?? 0),
    db.select({ type: schema.politicalResignations.resignationType, cnt: sql<number>`count(*)::int` })
      .from(schema.politicalResignations)
      .where(sql`${schema.politicalResignations.reviewStatus} = 'approved' AND ${schema.politicalResignations.resignationType} != 'Hivatalban van'`)
      .groupBy(schema.politicalResignations.resignationType)
      .orderBy(sql`count(*) desc`),
    db.select({ c: count() }).from(schema.mediaClosures)
      .where(eq(schema.mediaClosures.reviewStatus, 'approved'))
      .then(r => r[0]?.c ?? 0),
    db.select({ c: count() }).from(schema.courtVerdicts)
      .where(and(eq(schema.courtVerdicts.reviewStatus, 'approved'), eq(schema.courtVerdicts.verdictType, 'előzetesben')))
      .then(r => r[0]?.c ?? 0),
    db.select({ c: count() }).from(schema.courtVerdicts)
      .where(sql`${schema.courtVerdicts.reviewStatus} = 'approved' AND ${schema.courtVerdicts.verdictType} != 'előzetesben'`)
      .then(r => r[0]?.c ?? 0),
    db.select({ ugyId: schema.courtVerdicts.personUgyId, n: sql<number>`count(*)::int` })
      .from(schema.courtVerdicts)
      .where(and(eq(schema.courtVerdicts.reviewStatus, 'approved'), eq(schema.courtVerdicts.verdictType, 'előzetesben')))
      .groupBy(schema.courtVerdicts.personUgyId)
      .orderBy(sql`count(*) desc`),
    db.select().from(schema.assetRecoveries).orderBy(desc(schema.assetRecoveries.recoveredAt)),
    db.select().from(schema.politicalResignations)
      .where(eq(schema.politicalResignations.reviewStatus, 'approved'))
      .orderBy(desc(schema.politicalResignations.resignationDate))
      .limit(5),
    db.execute(sql`
      SELECT id, name, person, institution, article_count, investigation_count, damage_huf, is_open
      FROM "ScandalCatalog" ORDER BY damage_huf DESC, id ASC LIMIT 8
    `) as unknown as Promise<Array<{ id: string; name: string; person: string | null; institution: string | null; article_count: number; investigation_count: number; damage_huf: string; is_open: boolean }>>,
    db.execute(sql`SELECT code, "labelHu" AS label FROM "OffenceTypeRef" ORDER BY "sortOrder", "labelHu"`) as unknown as Promise<Array<{ code: string; label: string }>>,
    db.select({
        id: schema.newsArticles.id,
        headline: schema.newsArticles.headline,
        excerpt: schema.newsArticles.excerpt,
        sourceUrl: schema.newsArticles.sourceUrl,
        publishedAt: schema.newsArticles.publishedAt,
        tag: schema.newsArticles.tag,
        featured: schema.newsArticles.featured,
        imageUrl: schema.newsArticles.imageUrl,
        isBreakingCandidate: schema.newsArticles.isBreakingCandidate,
        breakingOverride: schema.newsArticles.breakingOverride,
        sourceName: schema.sources.name,
      })
      .from(schema.newsArticles)
      .leftJoin(schema.sources, eq(schema.sources.id, schema.newsArticles.sourceId))
      .where(or(
        eq(schema.newsArticles.featured, true),
        eq(schema.newsArticles.breakingOverride, true),
        eq(schema.newsArticles.isBreakingCandidate, true),
        ...HOMEPAGE_NEWS_TOPICS.map(p => ilike(schema.newsArticles.headline, p)),
      ))
      .orderBy(desc(schema.newsArticles.publishedAt))
      .limit(10),
    getActiveBreaking(),
    db.execute(sql`
      SELECT min(extract(year from "publishedAt"))::int AS min_y,
             max(extract(year from "publishedAt"))::int AS max_y
      FROM "NewsArticle"
    `) as unknown as Promise<Array<{ min_y: number | null; max_y: number | null }>>,
    db.select({ s: sql<number>`coalesce(sum(${schema.courtVerdicts.sentenceYears}), 0)::int` })
      .from(schema.courtVerdicts)
      .where(sql`${schema.courtVerdicts.verdictType} != 'előzetesben'`)
      .then(r => r[0]?.s ?? 0),
  ]);

  const resignationCount = resignationCountRaw;
  const closureCount = closureCountRaw;
  const latestRecoveries = allRecoveries.slice(0, 5);
  const totalRecoveredFt = allRecoveries.reduce((s, r) => s + r.amountFt, 0n);
  const offences = offRows.map((o) => ({ code: o.code, label: o.label }));
  const recentArticles = recentArticlesRaw.map(a => ({
    ...a,
    isBreaking: (a.breakingOverride ?? a.isBreakingCandidate) === true,
  }));

  // Fall back gracefully if a fresh DB is empty (avoids a 500 page).
  const totalDamage = snapshot ? BigInt(snapshot.totalDamage) : 0n;
  const totalPrisonYears = totalPrisonYearsRaw;
  const activeCases = snapshot?.activeCases ?? 0;
  const newIndictments = snapshot?.newIndictmentsThisWeek ?? 0;
  const partnerCount = snapshot?.partnerCount ?? 0;
  const bySector = (snapshot?.bySector ?? []) as SectorEntry[];

  const moneySlices: PieSlice[] = bySector
    .map((e) => ({ name: e.name, value: e.value }))
    .sort((a, b) => b.value - a.value);

  const RESIGNATION_TYPE_HU: Record<string, string> = {
    'lemondás': 'Lemondás',
    'kirúgás': 'Kirúgás',
    'felmentés': 'Felmentés',
    'egyéb': 'Egyéb',
  };
  const resignationSlices: PieSlice[] = resignationsByType.map(r => ({
    name: RESIGNATION_TYPE_HU[r.type] ?? r.type,
    value: r.cnt,
  }));


  const minYear = yearSpanRes[0]?.min_y ?? 2017;
  const maxYear = yearSpanRes[0]?.max_y ?? new Date().getFullYear();


  const updatedAt = snapshot?.computedAt ?? new Date();
  const featuredBreaking = recentArticles.filter(a => a.isBreaking).sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())[0] ?? null;
  const featuredNormal = recentArticles.find(a => a.featured) ?? recentArticles[0];
  const featured = featuredBreaking ?? featuredNormal;
  const restArticles = recentArticles.filter((a) => a.id !== featured?.id).slice(0, 4);

  const tickerItems = [
    `${fmtNumber(activeCases)} aktív ügy`,
    `${fmtNumber(newIndictments)} új vádemelés ezen a héten`,
    totalPrisonYears > 0
      ? `${fmtNumber(totalPrisonYears)} év halmozott börtönbüntetés`
      : `${fmtNumber(pretrialCountDb)} fő előzetes letartóztatásban`,
    `${fmtFt(totalDamage)} dokumentált kár`,
    `${fmtNumber(partnerCount)} sajtótermék együttműködésével`,
    `Utolsó frissítés: ${fmtUpdatedAt(updatedAt)}`,
  ];

  return (
    <>
      {/* ───── BREAKING BANNER ───── */}
      <BreakingBanner />

      {/* ───── HERO ───── */}
      <section className="hero" id="dashboard">
        <div className="hero-inner">
          <div className="hero-left">
            <div className="hero-eyebrow">A rendszerváltás adatbázisa</div>
            <h1 className="hero-title">
              Számon
              <br />
              tartjuk
              <br />
              <em>őket.</em>
            </h1>
            <p className="hero-sub">
              Független, közforrású adatbázis a Magyarországon dokumentált
              korrupciós ügyekről, a 2026. április 12-i rendszerváltás óta történt
              személyi változásokról és a propaganda megszűnéséről. Minden
              korrupciós eset nyomon követhető a vádemeléstől az ítéletig —
              adatokra, nem szólamokra alapozva.
            </p>
          </div>

          <div className="hero-stats">
            <div className="hero-stat">
              <div className="hero-stat-value"><FtValue n={totalDamage} mode="long" /></div>
              <div className="hero-stat-label">Dokumentált kár összesen</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-value">{fmtNumber(activeCases)}</div>
              <div className="hero-stat-label">Dokumentált korrupciós ügy</div>
            </div>
            <div className="hero-stat">
              {totalPrisonYears > 0 ? (
                <>
                  <div className="hero-stat-value">{fmtNumber(totalPrisonYears)} év</div>
                  <div className="hero-stat-label">
                    Kiszabott börtönbüntetés
                    {pretrialCountDb > 0 ? ` · ${fmtNumber(pretrialCountDb)} fő előzetesben` : ' összesen'}
                  </div>
                </>
              ) : (
                <>
                  <div className="hero-stat-value">{fmtNumber(pretrialCountDb)} fő</div>
                  <div className="hero-stat-label">Előzetes letartóztatásban</div>
                </>
              )}
            </div>
            <div className="hero-stat">
              <div className="hero-stat-value">{resignationCount + closureCount}</div>
              <div className="hero-stat-label">Lemondás, kirúgás és bezárás április 12. óta</div>
            </div>
          </div>
        </div>

        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-card-head">
              <div className="stat-label">Becsült / lehetséges kár</div>
              <div className="stat-id">/ KPI–01</div>
            </div>
            <div className="stat-value"><FtValue n={totalDamage} mode="short" /></div>
            <div className="stat-unit">
              K-Monitor adatbázis · valós dokumentált adatok · 8 ügy · 2017–2021
            </div>
            <Pie3D slices={moneySlices} palette={PALETTE_MONEY} className="donut" ariaLabel="Kár szektoronként" />
          </div>

          <div className="stat-card">
            <div className="stat-card-head">
              <div className="stat-label">Börtönben van-e?</div>
              <div className="stat-id">/ KPI–02</div>
            </div>
            <div className="stat-status-grid stat-status-grid--2">
              <div className="stat-status-item">
                <div className="stat-value stat-status-value--red" style={{ marginBottom: 4 }}>{pretrialCountDb}</div>
                <div className="stat-status-label">Előzetesben van</div>
              </div>
              <div className="stat-status-item">
                <div className="stat-value" style={{ marginBottom: 4 }}>{eliteltCountDb}</div>
                <div className="stat-status-label">Jogerősen elítélt</div>
              </div>
            </div>
            <div className="stat-unit stat-unit-notice" style={{ marginTop: 16 }}>
              {pretrialByUgy.map(({ ugyId, n }) => {
                const ugy = ugyId ? UGYEK.find(u => u.id === ugyId) : null;
                const label = ugy?.title ?? ugyId ?? 'Egyéb';
                const href = ugy ? `/ugyek/${ugyId}` : '/birosagi-iteletek';
                return (
                  <div key={ugyId ?? '__other'} style={{ marginBottom: 2 }}>
                    <Link href={href} className="stat-case-link">
                      {label}
                    </Link>
                    {': '}{n} fő előzetesben
                  </div>
                );
              })}
            </div>
            <Link href="/birosagi-iteletek" className="stat-card-list-link stat-card-corner-link">Részletek →</Link>
          </div>

          <div className="stat-card">
            <div className="stat-card-head">
              <div className="stat-label">Visszaszerzett vagyon</div>
              <div className="stat-id">/ KPI–03</div>
            </div>
            <div className="stat-value">{totalRecoveredFt > 0n ? <FtValue n={totalRecoveredFt} /> : '—'}</div>
            <div className="stat-unit stat-unit-fresh">
              frissül az eljárások előrehaladásával
            </div>
            <h3 className="stat-card-list-title">Legfrissebb visszaszerzések</h3>
            <div className="stat-recovered-list">
              {latestRecoveries.map((r) => (
                <Link key={r.id} href={`/ugyek/${r.caseId}`} className="stat-recovered-item stat-recovered-item--link">
                  <div className="stat-recovered-bar" />
                  <div className="stat-recovered-body">
                    <span className="stat-recovered-case">{r.caseLabel}</span>
                    <span className="stat-recovered-amt"><FtValue n={r.amountFt} /></span>
                  </div>
                  <div className="stat-recovered-note">{r.description} · {fmtRecoveryDate(r.recoveredAt)}</div>
                </Link>
              ))}
              {latestRecoveries.length === 0 && (
                <div className="stat-recovered-more">Még nincs rögzített visszaszerzés.</div>
              )}
            </div>
            <Link href="/visszaszerzett-vagyon" className="stat-card-list-link stat-card-corner-link">Teljes lista →</Link>
          </div>

          <div className="stat-card">
            <div className="stat-card-head">
              <div className="stat-label">Lemondások és kirúgások</div>
              <div className="stat-id">/ KPI–04</div>
            </div>
            <div className="stat-value">{fmtNumber(resignationCount)}</div>
            <div className="stat-unit stat-unit-fresh">
              2026. április 12. óta
            </div>
            <h3 className="stat-card-list-title">Legfrissebb személyi változások</h3>
            {latestResignations5.length > 0 ? (
              <div className="stat-resigned-list">
                {latestResignations5.map((r) => {
                  const sourceUrl = r.sourceUrls?.[0];
                  const inner = (
                    <>
                      <span
                        className="stat-resigned-dot"
                        style={{ background: RESIGNATION_TYPE_COLOR[r.resignationType] ?? '#888' }}
                      />
                      <div className="stat-resigned-body">
                        <span className="stat-resigned-name">{r.name}</span>
                        <span className="stat-resigned-pos">{r.position}</span>
                      </div>
                      {r.description && (
                        <span className="stat-resigned-desc">{r.description}</span>
                      )}
                      <span className="stat-resigned-date">{fmtShortDate(r.resignationDate)}</span>
                    </>
                  );
                  return sourceUrl ? (
                    <a key={r.id} href={sourceUrl} target="_blank" rel="noopener noreferrer" className="stat-resigned-item stat-resigned-item--link">
                      {inner}
                    </a>
                  ) : (
                    <div key={r.id} className="stat-resigned-item">
                      {inner}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="stat-unit" style={{ marginTop: 24 }}>Még nem érkezett adat.</div>
            )}
            <Link href="/lemondasok" className="stat-card-list-link stat-card-corner-link">Teljes lista →</Link>
          </div>
        </div>
      </section>

      {/* ───── ROGUES GALLERY ───── */}
      <section className="rogues" id="rogues">
        <div className="rogues-inner">
          <div className="section-head">
            <div className="section-num">02 / Galéria</div>
            <h2 className="section-title">10 kiemelt személy.</h2>
          </div>
          <p className="rogues-deck">
            A közérdeklődésre leginkább számot tartó ügyek és személyek — sajtójelentések és
            nyilvánosan hozzáférhető dokumentumok alapján. A státuszok a hiteles médiumok
            cikkei szerint naponta frissülnek.
          </p>

          <div className="rogues-key">
            <div className="k">
              <span className="dot busted"></span> Jogerősen elítélve
            </div>
            <div className="k">
              <span className="dot pretrial"></span> Előzetes letartóztatásban
            </div>
            <div className="k">
              <span className="dot investig"></span> Feljelentés / nyomozás
            </div>
            <div className="k">
              <span className="dot loose"></span> Nincs ismert eljárás
            </div>
            <div className="k">
              <span className="dot wanted"></span> Körözési parancs kiadva
            </div>
          </div>

          <div className="rogues-grid">
            {GALERIA.slice(0, 10).map((entry, idx) => {
              const detention = entry.detention as GaleriaDetention;
              const isBusted = detention === 'busted';
              const isWanted = detention === 'wanted';
              const rank = String(idx + 1).padStart(2, '0');
              return (
                <Link key={entry.id} href={`/galeria/${entry.id}`} className={`rogue r-${detention}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                  <div className="rogue-rank">
                    <span>№ {rank}</span>
                    <span className="id">{entry.id}</span>
                  </div>
                  <div className={`rogue-mug ${isBusted ? 'desat' : ''}`}>
                    <div className="corner-tag">
                      № {entry.id} / {rank}
                    </div>
                    {entry.photoUrl ? (
                      <img
                        src={entry.photoUrl.startsWith('/') || entry.photoUrl.includes('wikimedia.org') ? entry.photoUrl : `/api/img-proxy?url=${encodeURIComponent(entry.photoUrl)}`}
                        alt={entry.name}
                        className="rogue-photo"
                      />
                    ) : (
                      <Mugshot
                        caseId={entry.id}
                        name={entry.name}
                        variant={entry.variant ?? 0}
                        glasses={entry.glasses ?? false}
                        hair={(entry.hair as GaleriaHair) ?? 'short'}
                        detention={detention}
                      />
                    )}
                    {isBusted && (
                      <>
                        <div className="stamp">BUSTED</div>
                        <div className="face-cross"></div>
                      </>
                    )}
                    {isWanted && <div className="stamp small">KÖRÖZÖTT</div>}
                    <div className={`status-strip ${detention}`}>
                      {entry.detentionLabel}
                    </div>
                  </div>
                  <div className="rogue-name">{entry.name}</div>
                  <div className="rogue-pos">{entry.subtitle}</div>
                  <div className="rogue-tags">
                    {entry.crimes.slice(0, 3).map((cr) => (
                      <span key={cr} className="tag">{cr}</span>
                    ))}
                  </div>
                  <div className="rogue-amount">
                    <span className="lbl">{entry.amountLabel}</span>
                    <span className="val">{entry.amount}</span>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="rogues-footer">
            <Link href="/galeria" className="rogues-more-btn">
              Részletes leírások és teljes ügyirat →
            </Link>
          </div>
        </div>
      </section>

      {/* ───── BIGGEST CASES ───── */}
      {(() => {
        const bigCases: BigCaseConfig[] = [
          {
            id: 'nka-botrany',
            eyebrow: 'Aktív · 6 személy előzetesben',
            title: 'NKA botrány',
            responsible: 'Hankó Balázs',
            summary: 'Hankó Balázs volt kulturális miniszter a 2026-os választások előtt szabálytalanul osztott ki milliárdos NKA-támogatásokat. A NAV hűtlen kezelés bűntett gyanújával nyomoz — az ügy 17+ milliárd Ft-ot érint. Tarr Zoltán a kifizetések visszavizsgálását rendelte el.',
            breakingAlert: {
              source: 'NAV / Telex',
              headline: 'Hat személyt vett őrizetbe a NAV — köztük Bús Balázs',
              lead: '2026. június 23-án a NAV hat személyt vett előzetesbe hűtlen kezelés bűntett megalapozott gyanúja miatt — az NKTK és KIM alkalmazottait. Bús Balázs részletes vallomást tett.',
              url: 'https://telex.hu/belfold/2026/06/23/nka-botrany-hat-szemelyt-orizetbe-vett-a-nav-hanko-balazs-tarr-zoltan',
            },
            videoId: 'NRA-QuItdUA',
            statusItems: [
              { icon: '🔴', label: 'Őrizetbe vétel', value: '6 személy előzetesben — köztük Bús Balázs (óbudai) és Ughy Attila (XVIII. ker.) volt polgármesterek (jún. 23.)' },
              { icon: '⚖️', label: 'Nyomozás', value: 'NAV — hűtlen kezelés bűntett, 17+ milliárd Ft érintett összeg' },
              { icon: '💰', label: 'Visszaszerzett vagyon', value: '~2,1 milliárd Ft visszaadva + 22 milliárd Ft visszakövetelve (Élvonal)' },
              { icon: '👤', label: 'Felelős', value: 'Hankó Balázs — volt kulturális miniszter' },
            ],
            articleTag: 'NKA',
            moreUrl: '/ugyek/nka-botrany',
            articles: nkaArticles.map(a => ({ ...a, publishedAt: a.publishedAt.toISOString() })),
          },
          {
            id: 'parkfenntartas',
            eyebrow: 'Aktív · 7 személy előzetesben',
            title: 'Parkfenntartási kenőpénzbotrány',
            responsible: 'Több felelős — minden pártból',
            videoId: '7A-NUGjuKGg',
            summary: '8 személyt tartóztattak le 2026. június 4-én — köztük Őrsi Gergely (DK) II. kerületi polgármestert, Láng Zsolt (Fidesz) volt polgármestert és négy más politikust. Puskás Péter letartóztatását 2026. július 1-jén megszüntette az ügyészség. A maradék 7 letartóztatását +3 hónappal hosszabbították meg.',
            breakingAlert: {
              source: 'Telex',
              headline: 'Puskás Péter kiengedve — a többi 7 gyanúsított marad előzetesben',
              lead: 'Az ügyészség 2026. július 1-jén megszüntette Puskás Péter letartóztatását, mert különös okai megszűntek. Őrsi Gergely, Láng Zsolt, Molnár Zsolt, Szkaliczki Tünde, Matisz Károly és a két vállalkozó letartóztatása +3 hónappal hosszabbodik.',
              url: 'https://telex.hu/belfold/2026/07/01/obudai-korrupcios-ugy-vadlott-letartoztatas-megszuntetese-fidesz',
            },
            statusItems: [
              { icon: '🟡', label: 'Letartóztatva', value: '7 személy előzetesben — Puskás Péter (Fidesz) kiengedve 2026. júl. 1.' },
              { icon: '⚖️', label: 'Gyanú', value: 'Befolyással üzérkedés · Vesztegetés · 30 nap előzetes' },
              { icon: '💰', label: 'Kenőpénz', value: '2+ milliárd Ft kenőpénz · 35+ Mrd Ft szerződésállomány' },
              { icon: '🏙️', label: 'Területek', value: 'II., III., VIII., XIII., XIV. ker. + vidéki önkormányzatok' },
            ],
            moreUrl: '/ugyek/parkfenntartas',
            articles: parkArticles.map(a => ({ ...a, publishedAt: a.publishedAt.toISOString() })),
          },
          {
            id: 'lelegeztetogep',
            eyebrow: 'Lezáratlan · Nincs felelős',
            title: 'Lélegeztetőgép-botrány',
            responsible: 'Takács Péter',
            videoId: 'DrHUAmHMZBM',
            summary: '2020-ban a magyar kormány az EU legdrágábban vásárolta a kínai lélegeztetőgépeket — 17 ezer darabot, egységenként 17–20 millió forintért, miközben az EU-s átlag 4 millió volt. A 300 milliárdos ügyletből Orbán főtanácsadójának fivére és Takács Péter sógora milliárdokat vett fel osztalékként. Büntetőeljárás mind a mai napig nincs.',
            statusItems: [
              { icon: '💰', label: 'Érintett összeg', value: '~300 milliárd Ft — EU legdrágább lélegeztetőgép-vásárlása' },
              { icon: '👤', label: 'Érintett', value: 'Takács Péter sógora — 8 Mrd Ft osztalékot vett fel a Fourcardinalból' },
              { icon: '⚖️', label: 'Státusz', value: 'Nincs büntetőeljárás — KEHI és NAV "nem talált szabálytalanságot"' },
            ],
            moreUrl: '/ugyek/lelegeztetogep',
            articles: lelegArticles.map(a => ({ ...a, publishedAt: a.publishedAt.toISOString() })),
          },
          {
            id: 'hatvanpuszta',
            eyebrow: 'Lezáratlan · Nincs eljárás',
            title: 'Hatvanpuszta',
            responsible: 'Orbán Viktor',
            videoId: 'HiW9r1M32ug',
            summary: 'Orbán Viktor 250 hektáros, ~20 milliárd forintra becsült majorságának valódi tulajdonosa és finanszírozási forrása ismeretlen — az ingatlan értéke összeegyeztethetetlen Orbán nyilvánosan bejelentett vagyonával. A sajtó többször vetette fel a vagyonnyilatkozat megsértését.',
            statusItems: [
              { icon: '🏡', label: 'Becsült érték', value: '~20 milliárd Ft · 250 hektár · Vas megye' },
              { icon: '❓', label: 'Forrás', value: 'Ismeretlen — összeegyeztethetetlen a vagyonnyilatkozattal' },
              { icon: '⚖️', label: 'Státusz', value: 'Nincs ismert büntetőeljárás' },
            ],
            moreUrl: '/ugyek/hatvanpuszta',
            articles: hatvanArticles.map(a => ({ ...a, publishedAt: a.publishedAt.toISOString() })),
          },
          {
            id: 'aranykonvoj',
            eyebrow: 'Aktív · Feljelentés benyújtva',
            title: 'Aranykonvoj-ügy',
            responsible: 'Orbán Viktor',
            videoId: 'cLBTdDVztR0',
            summary: '2026 tavaszán a NAV és a titkosszolgálat megállított egy Ukrajna határán átkelő konvojt, amely aranyat és devizát szállított. Az ügyvéd feljelentése terrorcselekmény-gyanút is tartalmaz. Az ügy közvetlenül az Orbán-körhöz köthető személyekhez vezet.',
            statusItems: [
              { icon: '⚖️', label: 'Eljárás', value: 'Feljelentés benyújtva — terrorcselekmény gyanúja is' },
              { icon: '🏦', label: 'Lefoglalt', value: 'Arany + deviza — pontos összeg nem nyilvános' },
              { icon: '👤', label: 'Kapcsolat', value: 'Orbán-körhöz köthető személyek érintettségét veti fel az ügyvéd' },
            ],
            moreUrl: '/ugyek/aranykonvoj',
            articles: aranyArticles.map(a => ({ ...a, publishedAt: a.publishedAt.toISOString() })),
          },
          {
            id: 'mnb-botrany',
            eyebrow: 'Aktív · Nyomozás folyamatban',
            title: 'MNB botrány',
            responsible: 'Matolcsy György',
            videoId: 'bgA0PTDFKlY',
            summary: 'Matolcsy György az MNB elnökeként 266 milliárd forintot csatornázott alapítványokon keresztül. Az ÁSZ kiszivárgott jelentés-tervezete súlyos vagyonvesztést és szabálytalanságokat tárt fel. Az ügyészség 2026-ban nyomozást indított hűtlen kezelés és más bűncselekmények gyanúja miatt.',
            statusItems: [
              { icon: '💰', label: 'Érintett közpénz', value: '266+ milliárd Ft — MNB alapítványokon átfolyva' },
              { icon: '📋', label: 'Feltárta', value: 'ÁSZ (Állami Számvevőszék) — kiszivárgott jelentés-tervezet' },
              { icon: '⚖️', label: 'Nyomozás', value: 'Ügyészség 2026-ban indított nyomozást — hűtlen kezelés gyanúja' },
            ],
            moreUrl: '/ugyek/mnb-botrany',
            articles: mnbArticles.map(a => ({ ...a, publishedAt: a.publishedAt.toISOString() })),
          },
          {
            id: 'zsolt-bacsi',
            eyebrow: 'Parlamenti vizsgálóbizottság alakult',
            title: 'Ki az a Zsolt bácsi?',
            videoId: 'QXW84vh1hV8',
            summary: '"Zsolt bácsi" a NER egyházi szárnyának feje — ő koordinálta az egyházi ingatlan-visszaadások, az aránytalanul magas egyházi normatívák és a KDNP mint Fidesz-mellékvállalkozás egész rendszerét. Az Országgyűlés 2026-ban vizsgálóbizottságot alakított az egyházi finanszírozási rendszer átvilágítására.',
            statusItems: [
              { icon: '🏛️', label: 'Parlamenti vizsgálóbizottság', value: 'Az Országgyűlés vizsgálóbizottságot alakított az egyházi finanszírozási rendszer átvilágítására' },
              { icon: '⛪', label: 'Egyházi normatíva-különbözet', value: '30–40%-kal több, mint állami iskoláknak · évente több tízmilliárd Ft' },
              { icon: '🏠', label: 'Ingatlanvisszaadás', value: 'Milliárd négyzetméternyi állami ingatlan egyházaknak — sokszor bizonyítatlan igény alapján' },
            ],
            moreUrl: '/ugyek/zsolt-bacsi',
            articles: [],
          },
          {
            id: 'pecsi-volvo-gate',
            eyebrow: 'Aktív · Újabb nyomozás indult',
            title: 'Pécsi Volvo-gate',
            responsible: 'Bánki Erik',
            videoId: 'feWPUeFNDmU',
            summary: 'A pécsi Tüke Zrt. 2010-ben 115 használt Volvo buszt vásárolt Hollandiából 3,5 milliárd forintért — miközben azonos buszokat pár hónappal korábban 2,8 milliárdért kínáltak. A ~700 millió forintos közkárból 170 millió forint egy Bánki Erik fideszes képviselőhöz köthető cégnek folyt ki, 550 000 EUR részben Thaiföldre vándorolt. Éveken át eltussolták; Hadházy 2026-os feljelentése nyomán újabb nyomozás indult.',
            statusItems: [
              { icon: '💰', label: 'Becsült közkár', value: '~700 millió Ft (3,5 Mrd helyett 2,8 Mrd lett volna a piaci ár)' },
              { icon: '💸', label: 'Bánki-közeli céghez folyt', value: '52 M Ft Bánki cégéhez · 550 000 EUR Thaiföldre utalva (170 M Ft)' },
              { icon: '⚖️', label: 'Eljárás', value: 'Szekszárdi Törvényszék újratárgyalja · 2026-ban Hadházy feljelentése nyomán újabb nyomozás indult (Fejér Megyei Rendőrség)' },
              { icon: '👤', label: 'Érintett', value: 'Bánki Erik — fideszes képviselő · tanúként harmadszor hallgatták meg 2025-ben' },
            ],
            moreUrl: '/ugyek/pecsi-volvo-gate',
            articles: volvoArticles.map(a => ({ ...a, publishedAt: a.publishedAt.toISOString() })),
          },
        ];
        return <BigCasesSection cases={bigCases} />;
      })()}

      <div className="block-divider" />

      {/* ───── DATABASE PREVIEW ───── */}
      <section className="section" id="database">
        <div className="section-head">
          <div className="section-num">03 / Adatbázis</div>
          <h2 className="section-title">Az ügyek nyilvántartása.</h2>
        </div>
        <p className="section-partner-note">
          Együttműködő partnerünk a{' '}
          <a href="https://k-monitor.hu" target="_blank" rel="noopener noreferrer">
            <strong>K-Monitor</strong>
          </a>{' '}
          — az ő teljes, nyilvánosan hozzáférhető adatbázisuk (64 000+ dokumentált eset) szolgál
          az itt látható elemzés alapjául. Az adatokat feldolgoztuk, szűrtük és rendszerezve jelenítjük meg.
        </p>

        <CaseFilters offences={offences} initial={{ sort: 'damage_desc' }} />

        <div className="db-meta">
          <div className="db-count">
            <strong>{recentScandals.length}</strong> kiemelt ügy {fmtNumber(activeCases)}{' '}
            ügyből
          </div>
          <div className="db-sort">
            <Link href="/adatbazis?sort=damage_desc" className="db-sort-link">
              <button type="button" className="active">
                Kár ↓
              </button>
            </Link>
            <Link href="/adatbazis?sort=recent" className="db-sort-link">
              <button type="button">Friss ↓</button>
            </Link>
            <Link href="/adatbazis?sort=name" className="db-sort-link">
              <button type="button">Név A–Z</button>
            </Link>
          </div>
        </div>

        <table className="db-table">
          <thead>
            <tr>
              <th>Ügy</th>
              <th>Felelős</th>
              <th>Intézmény</th>
              <th className="num">Cikkek</th>
              <th className="num">Becsült kár (Ft)</th>
            </tr>
          </thead>
          <tbody>
            {recentScandals.map((c) => (
              <CaseRow key={c.id} href={`/adatbazis/${encodeURIComponent(c.id)}`}>
                <td data-label="Ügy">
                  <Link href={`/adatbazis/${encodeURIComponent(c.id)}`} className="case-name">
                    {autoDisplayTitle(c.name, c.person ?? null, getCaseDisplayTitle(c.id))}
                  </Link>
                  {c.investigation_count > 1 && (
                    <div className="case-id">{fmtNumber(c.investigation_count)} kapcsolódó ügy</div>
                  )}
                </td>
                <td data-label="Felelős">
                  <div style={{ fontSize: 14, color: 'var(--ink)' }}>{c.person ?? '—'}</div>
                </td>
                <td data-label="Intézmény">{c.institution ?? '—'}</td>
                <td className="num" data-label="Cikkek">
                  {fmtNumber(c.article_count)}
                </td>
                <td className="num db-damage-cell" data-label="Becsült kár">
                  {BigInt(c.damage_huf) > 0n ? <FtValue n={BigInt(c.damage_huf)} /> : '—'}
                </td>
              </CaseRow>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: 32, textAlign: 'right' }}>
          <Link
            href="/adatbazis"
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--ink)',
            }}
          >
            Tovább az adatbázishoz →
          </Link>
        </div>
      </section>

      {/* ───── NEWS ───── */}
      <div className="news-section-wrap">
        <section className="section" id="news">
          <div className="section-head">
            <div className="section-num">04 / Hírfolyam</div>
            <h2 className="section-title">Élő riportok az ügyekről.</h2>
          </div>

          {recentArticles.length === 0 ? (
            <div className="empty-state">
              Még nem érkezett friss cikk a hírfolyamba.
            </div>
          ) : (
            <div className="news-grid">
              {featured && (
                <a
                  href={featured.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="news-card feature"
                >
                  {featured.imageUrl && <NewsCardImage src={featured.imageUrl} />}
                  {featured.isBreaking && (
                    <div className="news-breaking-badge">
                      <span className="news-breaking-dot" />
                      BREAKING
                    </div>
                  )}
                  <div className="news-meta">
                    <span className="news-tag">★ Kiemelt</span>
                    <span className="news-time">{fmtRelative(featured.publishedAt)}</span>
                  </div>
                  <h3 className="news-headline">{featured.headline}</h3>
                  <p className="news-excerpt">{featured.excerpt}</p>
                  <span className="news-source">{featured.sourceName ?? 'Forrás'}</span>
                </a>
              )}
              {restArticles.map((a) => (
                <a
                  key={a.id}
                  href={a.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="news-card"
                >
                  {a.imageUrl && <NewsCardImage src={a.imageUrl} />}
                  <div className="news-meta">
                    <span className="news-tag">{a.tag ?? 'Hír'}</span>
                    <span className="news-time">{fmtRelative(a.publishedAt)}</span>
                  </div>
                  <h3 className="news-headline">{a.headline}</h3>
                  <p className="news-excerpt">{a.excerpt}</p>
                  <span className="news-source">{a.sourceName ?? 'Forrás'}</span>
                </a>
              ))}
            </div>
          )}
          <div className="news-more-wrap">
            <Link href="/hirek" className="news-more-btn">Tovább az összes hírre →</Link>
          </div>
        </section>
      </div>

      {/* ───── RESIGNATIONS ───── */}
      <ResignationsSection resignations={topResignations} breaking={breakingArticles} />

      {/* ───── MEDIA CLOSURES ───── */}
      <MediaClosuresSection />

      {/* ───── SOCIAL FEED ───── */}
      <SocialFeed />

      {/* ───── SUBMISSION CTA ───── */}
      <section className="submission" id="submission">
        <div className="submission-inner">
          <div className="submission-left">
            <div className="section-num">07 / Bejelentés</div>
            <h2>
              Hiányzik egy <em>név</em>?<br />
              Jelentsd be.
            </h2>
            <p>
              Ha tudsz olyan ügyről, ami még nem szerepel az adatbázisban, küldd el —
              anonim is megteheted. Minden bejelentést közforrások alapján ellenőrzünk.
            </p>
            <div className="submission-assurance">
              <strong>Forrásvédelem</strong>
              Az IP-címedet nem rögzítjük. Anonim bejelentés esetén nincs olyan adat,
              amely rád mutatna.
            </div>
          </div>

          <SubmissionCTA />
        </div>
      </section>

      {/* HomeMobilePreview hidden */}
    </>
  );
}
