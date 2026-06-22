import Link from 'next/link';
import { asc, count, desc, eq, ilike, or, sql } from 'drizzle-orm';

import { fmtFt, fmtNumber } from '@korr/shared/format';
import { caseQuerySchema } from '@korr/shared/schemas/cases';
import type { SortValue } from '@korr/shared/cursor';
import { Pie3D, type PieSlice } from '@korr/ui/pie3d';
import { Ticker } from '@korr/ui/ticker';
import { Mugshot } from '@korr/ui/mugshot';

import { getDb, schema } from '@/lib/db';
import { CaseFilters } from './adatbazis/case-filters';
import { ResignationsSection } from './_home/resignations-section';
import { MediaClosuresSection } from './_home/media-closures-section';
import { SubmissionCTA } from './_home/submission-cta';
import { SocialFeed } from './_home/social-feed';
import { BigCasesSection, type BigCaseConfig } from './_home/big-cases-section';
import { GALERIA, type GaleriaDetention, type GaleriaHair } from './_home/galeria-config';
import { NewsCardImage } from './hirek/news-card-image';

export const dynamic = 'force-dynamic';

const PALETTE_MONEY = ['#e31937', '#171a20', '#5c5e62', '#9b9da1', '#cccccc', '#e6e6e6'];
const PALETTE_PRISON = ['#171a20', '#e31937', '#5c5e62', '#9b9da1', '#cccccc', '#e6e6e6'];


type SectorEntry = { name: string; value: number };

function pillClass(s: string): string {
  if (s === 'Lezárva') return 'pill lezarva';
  if (s === 'Vádemelés') return 'pill vad';
  return 'pill folyamatban';
}

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

  const snapshot = await db.query.kpiSnapshots.findFirst({
    where: eq(schema.kpiSnapshots.id, 'singleton'),
  });


  const topResignations = await db
    .select()
    .from(schema.politicalResignations)
    .orderBy(desc(schema.politicalResignations.pinned), desc(schema.politicalResignations.resignationDate))
    .limit(10);

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

  const nkaArticles = await articleSelect()
    .where(eq(schema.newsArticles.tag, 'NKA'))
    .orderBy(desc(schema.newsArticles.publishedAt))
    .limit(5);

  const mnbArticles = await articleSelect()
    .where(eq(schema.newsArticles.tag, 'MNB'))
    .orderBy(desc(schema.newsArticles.publishedAt))
    .limit(5);

  const hatvanArticles = await articleSelect()
    .where(ilike(schema.newsArticles.headline, '%hatvanpuszta%'))
    .orderBy(desc(schema.newsArticles.publishedAt))
    .limit(5);

  const aranyArticles = await articleSelect()
    .where(ilike(schema.newsArticles.headline, '%aranykonvoj%'))
    .orderBy(desc(schema.newsArticles.publishedAt))
    .limit(5);

  const volvoArticles = await articleSelect()
    .where(or(
      ilike(schema.newsArticles.headline, '%volvo gate%'),
      ilike(schema.newsArticles.headline, '%volvo-gate%'),
      ilike(schema.newsArticles.headline, '%bánki erik%'),
      ilike(schema.newsArticles.headline, '%tüke busz%'),
      eq(schema.newsArticles.tag, 'volvo-gate'),
    ))
    .orderBy(desc(schema.newsArticles.publishedAt))
    .limit(5);

  const lelegArticles = await articleSelect()
    .where(or(
      ilike(schema.newsArticles.headline, '%lélegeztetőgép%'),
      ilike(schema.newsArticles.headline, '%fourcardinal%'),
    ))
    .orderBy(desc(schema.newsArticles.publishedAt))
    .limit(5);

  const resignationCount = (await db.select({ c: count() }).from(schema.politicalResignations))[0]?.c ?? 0;

  const resignationsByType = await db
    .select({
      type: schema.politicalResignations.resignationType,
      cnt: sql<number>`count(*)::int`,
    })
    .from(schema.politicalResignations)
    .where(sql`${schema.politicalResignations.resignationType} != 'Hivatalban van'`)
    .groupBy(schema.politicalResignations.resignationType)
    .orderBy(sql`count(*) desc`);

  const closureCount = (await db.select({ c: count() }).from(schema.mediaClosures))[0]?.c ?? 0;

  const allRecoveries = await db
    .select()
    .from(schema.assetRecoveries)
    .orderBy(desc(schema.assetRecoveries.recoveredAt));
  const latestRecoveries = allRecoveries.slice(0, 5);
  const totalRecoveredFt = allRecoveries.reduce((s, r) => s + r.amountFt, 0n);

  const latestResignations5 = await db
    .select()
    .from(schema.politicalResignations)
    .orderBy(desc(schema.politicalResignations.resignationDate))
    .limit(5);
  const recentCases = await db
    .select()
    .from(schema.cases)
    .orderBy(desc(schema.cases.amount))
    .limit(8);

  const HOMEPAGE_NEWS_TOPICS = [
    '%NKA%', '%MNB%', '%KESMA%', '%Mediaworks%',
    '%lélegeztetőgép%', '%aranykonvoj%', '%hatvanpuszta%', '%batida%',
    '%Mészáros Lőrinc%', '%Rogán%', '%Matolcsy%',
    '%Tiborcz%', '%Balásy%', '%Lázár János%',
    '%volvo%gate%', '%volvo-gate%',
    '%pesti srácok%', '%világgazdaság%',
  ] as const;

  const recentArticles = await db
    .select({
      id: schema.newsArticles.id,
      headline: schema.newsArticles.headline,
      excerpt: schema.newsArticles.excerpt,
      sourceUrl: schema.newsArticles.sourceUrl,
      publishedAt: schema.newsArticles.publishedAt,
      tag: schema.newsArticles.tag,
      featured: schema.newsArticles.featured,
      imageUrl: schema.newsArticles.imageUrl,
      sourceName: schema.sources.name,
    })
    .from(schema.newsArticles)
    .leftJoin(schema.sources, eq(schema.sources.id, schema.newsArticles.sourceId))
    .where(
      or(
        eq(schema.newsArticles.featured, true),
        ...HOMEPAGE_NEWS_TOPICS.map(p => ilike(schema.newsArticles.headline, p)),
      )
    )
    .orderBy(desc(schema.newsArticles.publishedAt))
    .limit(5);

  const regionRows = await db
    .selectDistinct({ region: schema.cases.region })
    .from(schema.cases)
    .orderBy(asc(schema.cases.region));
  const regions = regionRows.map((r) => r.region);

  const filterDefaults = caseQuerySchema.parse({});
  const previewSortLabels: Record<SortValue, string> = {
    amount_desc: 'Kár ↓',
    amount_asc: 'Kár ↑',
    sentence_desc: 'Évek ↓',
    year_desc: 'Dátum ↓',
    name_asc: 'Név A–Z',
  };

  // Fall back gracefully if a fresh DB is empty (avoids a 500 page).
  const totalDamage = snapshot ? BigInt(snapshot.totalDamage) : 0n;
  // No final convictions yet since the 2026-04-12 government change — hardcoded 0.
  const totalPrisonYears = 0;
  const activeCases = snapshot?.activeCases ?? 0;
  const newIndictments = snapshot?.newIndictmentsThisWeek ?? 0;
  const partnerCount = snapshot?.partnerCount ?? 0;
  const bySector = (snapshot?.bySector ?? []) as SectorEntry[];

  // Aggregate prison years by sector for the second donut.
  const prisonBySector = new Map<string, number>();
  for (const r of recentCases) {
    prisonBySector.set(r.sector, (prisonBySector.get(r.sector) ?? 0) + r.sentenceYears);
  }
  const prisonSlices: PieSlice[] = Array.from(prisonBySector.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

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


  const years = recentCases.map((c) => c.caseYear).sort((a, b) => a - b);
  const minYear = years[0] ?? 2017;
  const maxYear = years[years.length - 1] ?? 2023;

  const updatedAt = snapshot?.computedAt ?? new Date();
  const featured = recentArticles.find((a) => a.featured) ?? recentArticles[0];
  const restArticles = recentArticles.filter((a) => a.id !== featured?.id).slice(0, 4);

  const tickerItems = [
    `${fmtNumber(activeCases)} aktív ügy`,
    `${fmtNumber(newIndictments)} új vádemelés ezen a héten`,
    `${fmtNumber(totalPrisonYears)} év halmozott börtönbüntetés`,
    `${fmtFt(totalDamage)} dokumentált kár`,
    `${fmtNumber(partnerCount)} sajtótermék együttműködésével`,
    `Utolsó frissítés: ${fmtUpdatedAt(updatedAt)}`,
  ];

  return (
    <>
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
              <div className="hero-stat-value">{fmtFt(totalDamage)}</div>
              <div className="hero-stat-label">Dokumentált kár összesen</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-value">{fmtNumber(activeCases)}</div>
              <div className="hero-stat-label">Dokumentált korrupciós ügy</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-value">{fmtNumber(totalPrisonYears)} év</div>
              <div className="hero-stat-label">Kiszabott börtönbüntetés összesen</div>
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
            <div className="stat-value">{fmtFt(totalDamage)}</div>
            <div className="stat-unit">
              K-Monitor adatbázis · valós dokumentált adatok · 8 ügy · 2017–2021
            </div>
            <Pie3D slices={moneySlices} palette={PALETTE_MONEY} className="donut" ariaLabel="Kár szektoronként" />
          </div>

          <div className="stat-card">
            <div className="stat-card-head">
              <div className="stat-label">Kiszabott börtönévek</div>
              <div className="stat-id">/ KPI–02</div>
            </div>
            {totalPrisonYears === 0 ? (
              <>
                <div className="stat-value">0 év</div>
                <div className="stat-unit stat-unit-notice">
                  2026. április 12-i rendszerváltás óta még nem ítéltek el jogerősen senkit.
                </div>
              </>
            ) : (
              <>
                <div className="stat-value">{fmtNumber(totalPrisonYears)} év</div>
                <div className="stat-unit">
                  Halmozott szabadságvesztés · {fmtNumber(activeCases)} ügy · átlag{' '}
                  {activeCases > 0
                    ? (totalPrisonYears / activeCases).toFixed(1).replace('.', ',')
                    : '0'}{' '}
                  év
                </div>
                <Pie3D slices={prisonSlices} palette={PALETTE_PRISON} className="donut" ariaLabel="Börtönévek szektoronként" />
              </>
            )}
          </div>

          <div className="stat-card">
            <div className="stat-card-head">
              <div className="stat-label">Visszaszerzett vagyon</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="stat-id">/ KPI–03</div>
                <Link href="/visszaszerzett-vagyon" className="stat-card-list-link">Teljes lista →</Link>
              </div>
            </div>
            <div className="stat-value">{totalRecoveredFt > 0n ? fmtFt(totalRecoveredFt) : '—'}</div>
            <div className="stat-unit stat-unit-fresh">
              frissül az eljárások előrehaladásával
            </div>
            <h3 className="stat-card-list-title">Legfrissebb visszaszerzések</h3>
            <div className="stat-recovered-list">
              {latestRecoveries.map((r) => (
                <div key={r.id} className="stat-recovered-item">
                  <div className="stat-recovered-bar" />
                  <div className="stat-recovered-body">
                    <span className="stat-recovered-case">{r.caseLabel}</span>
                    <span className="stat-recovered-amt">{fmtFt(r.amountFt)}</span>
                  </div>
                  <div className="stat-recovered-note">{r.description} · {fmtRecoveryDate(r.recoveredAt)}</div>
                </div>
              ))}
              {latestRecoveries.length === 0 && (
                <div className="stat-recovered-more">Még nincs rögzített visszaszerzés.</div>
              )}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-head">
              <div className="stat-label">Lemondások és kirúgások</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="stat-id">/ KPI–04</div>
                <Link href="/lemondasok" className="stat-card-list-link">Teljes lista →</Link>
              </div>
            </div>
            <div className="stat-value">{fmtNumber(resignationCount)}</div>
            <div className="stat-unit stat-unit-fresh">
              2026. április 12. óta
            </div>
            <h3 className="stat-card-list-title">Legfrissebb személyi változások</h3>
            {latestResignations5.length > 0 ? (
              <div className="stat-resigned-list">
                {latestResignations5.map((r) => (
                  <div key={r.id} className="stat-resigned-item">
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
                  </div>
                ))}
              </div>
            ) : (
              <div className="stat-unit" style={{ marginTop: 24 }}>Még nem érkezett adat.</div>
            )}
          </div>
        </div>
      </section>

      {/* ───── TICKER ───── */}
      {/* <Ticker items={tickerItems} /> */}

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
            eyebrow: 'Aktív · Nyomozás alatt',
            title: 'NKA botrány',
            responsible: 'Hankó Balázs',
            summary: 'Hankó Balázs volt kulturális miniszter a 2026-os választások előtt szabálytalanul osztott ki milliárdos NKA-támogatásokat. A NAV hűtlen kezelés és költségvetési csalás gyanújával nyomoz — Győrben is indult eljárás. Tarr Zoltán közel 400 millió forintnyi támogatást vont vissza.',
            videoId: 'NRA-QuItdUA',
            statusItems: [
              { icon: '⚖️', label: 'Nyomozás', value: 'NAV — hűtlen kezelés + költségvetési csalás (Győr is)' },
              { icon: '💰', label: 'Visszaszerzett vagyon', value: '~2,1 milliárd Ft visszaadva + 22 milliárd Ft visszakövetelve (Élvonal)' },
              { icon: '👤', label: 'Felelős', value: 'Hankó Balázs — volt kulturális miniszter' },
              { icon: '🚪', label: 'Lemondások', value: 'Bús Balázs (alelnök, ápr. 28.) · Báán László (ápr. 30.) · Vidnyánszky Attila (máj. 2.) — mind lemondtak az NKA bizottságból' },
            ],
            articleTag: 'NKA',
            moreUrl: '/ugyek/nka-botrany',
            articles: nkaArticles.map(a => ({ ...a, publishedAt: a.publishedAt.toISOString() })),
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

        <CaseFilters
          regions={regions}
          initial={filterDefaults}
          sortLabels={previewSortLabels}
        />

        <div className="db-meta">
          <div className="db-count">
            <strong>{recentCases.length}</strong> találat {fmtNumber(activeCases)}{' '}
            ügyből
          </div>
          <div className="db-sort">
            <Link href="/adatbazis?sort=amount_desc" className="db-sort-link">
              <button type="button" className="active">
                Kár ↓
              </button>
            </Link>
            <Link href="/adatbazis?sort=sentence_desc" className="db-sort-link">
              <button type="button">Évek ↓</button>
            </Link>
            <Link href="/adatbazis?sort=year_desc" className="db-sort-link">
              <button type="button">Dátum ↓</button>
            </Link>
          </div>
        </div>

        <table className="db-table">
          <thead>
            <tr>
              <th>Ügy</th>
              <th>Pozíció</th>
              <th>Régió</th>
              <th>Év</th>
              <th>Státusz</th>
              <th className="num">Kár (Ft)</th>
              <th className="num">Évek</th>
            </tr>
          </thead>
          <tbody>
            {recentCases.map((c) => (
              <tr key={c.id}>
                <td data-label="Ügy">
                  <div className="case-id">{c.id}</div>
                  <Link href={`/adatbazis/${c.id}`} className="case-name">
                    {c.name}
                  </Link>
                </td>
                <td data-label="Pozíció">
                  <div style={{ fontSize: 14, color: 'var(--ink)' }}>{c.position}</div>
                </td>
                <td data-label="Régió">{c.region}</td>
                <td data-label="Év">{c.caseYear}</td>
                <td data-label="Státusz">
                  <span className={pillClass(c.status)}>{c.status}</span>
                </td>
                <td className="num" data-label="Kár">
                  {fmtFt(c.amount)}
                </td>
                <td className="num" data-label="Évek">
                  {c.sentenceYears}
                </td>
              </tr>
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
      <ResignationsSection resignations={topResignations} />

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
              Jelents be.
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
