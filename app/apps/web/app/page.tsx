import Link from 'next/link';
import { asc, count, desc, eq } from 'drizzle-orm';

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
import { HomeMobilePreview } from './_home/mobile-preview';
import { SubmissionCTA } from './_home/submission-cta';

export const dynamic = 'force-dynamic';

const PALETTE_MONEY = ['#e31937', '#171a20', '#5c5e62', '#9b9da1', '#cccccc', '#e6e6e6'];
const PALETTE_PRISON = ['#171a20', '#e31937', '#5c5e62', '#9b9da1', '#cccccc', '#e6e6e6'];

type Hair = 'short' | 'bald' | 'wave' | 'cap' | 'slick';
type Detention = 'loose' | 'wanted' | 'busted' | 'pretrial' | 'investig';

type SectorEntry = { name: string; value: number };

function pillClass(s: string): string {
  if (s === 'Lezárva') return 'pill lezarva';
  if (s === 'Vádemelés') return 'pill vad';
  return 'pill folyamatban';
}

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

  const top10 = await db
    .select({ case: schema.cases, rogue: schema.rogueProfiles })
    .from(schema.cases)
    .leftJoin(schema.rogueProfiles, eq(schema.rogueProfiles.caseId, schema.cases.id))
    .orderBy(desc(schema.cases.amount), asc(schema.cases.id))
    .limit(10);

  const topResignations = await db
    .select()
    .from(schema.politicalResignations)
    .orderBy(desc(schema.politicalResignations.pinned), desc(schema.politicalResignations.resignationDate))
    .limit(10);

  const topClosures = await db
    .select()
    .from(schema.mediaClosures)
    .orderBy(desc(schema.mediaClosures.eventDate))
    .limit(10);

  const [resignationCountRow] = await db
    .select({ resignationCount: count() })
    .from(schema.politicalResignations);
  const resignationCount = resignationCountRow?.resignationCount ?? 0;

  const [closureCountRow] = await db
    .select({ closureCount: count() })
    .from(schema.mediaClosures);
  const closureCount = closureCountRow?.closureCount ?? 0;
  const recentCases = await db
    .select()
    .from(schema.cases)
    .orderBy(desc(schema.cases.amount))
    .limit(8);

  const recentArticles = await db
    .select({
      id: schema.newsArticles.id,
      headline: schema.newsArticles.headline,
      excerpt: schema.newsArticles.excerpt,
      sourceUrl: schema.newsArticles.sourceUrl,
      publishedAt: schema.newsArticles.publishedAt,
      tag: schema.newsArticles.tag,
      featured: schema.newsArticles.featured,
      sourceName: schema.sources.name,
    })
    .from(schema.newsArticles)
    .leftJoin(schema.sources, eq(schema.sources.id, schema.newsArticles.sourceId))
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
  const totalPrisonYears = snapshot?.totalPrisonYears ?? 0;
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
              <div className="stat-label">Kár — Összesen</div>
              <div className="stat-id">/ KPI–01</div>
            </div>
            <div className="stat-value">{fmtFt(totalDamage)}</div>
            <div className="stat-unit">
              Dokumentált, fiktív tesztadatok · {fmtNumber(activeCases)} ügy ·{' '}
              {minYear}–{maxYear}
            </div>
            <Pie3D slices={moneySlices} palette={PALETTE_MONEY} className="donut" ariaLabel="Kár szektoronként" />
          </div>

          <div className="stat-card">
            <div className="stat-card-head">
              <div className="stat-label">Kiszabott börtönévek</div>
              <div className="stat-id">/ KPI–02</div>
            </div>
            <div className="stat-value">{fmtNumber(totalPrisonYears)} év</div>
            <div className="stat-unit">
              Halmozott szabadságvesztés · {fmtNumber(activeCases)} ügy · átlag{' '}
              {activeCases > 0
                ? (totalPrisonYears / activeCases).toFixed(1).replace('.', ',')
                : '0'}{' '}
              év
            </div>
            <Pie3D slices={prisonSlices} palette={PALETTE_PRISON} className="donut" ariaLabel="Börtönévek szektoronként" />
          </div>
        </div>
      </section>

      {/* ───── TICKER ───── */}
      <Ticker items={tickerItems} />

      {/* ───── ROGUES GALLERY ───── */}
      <section className="rogues" id="rogues">
        <div className="rogues-inner">
          <div className="section-head">
            <div className="section-num">02 / Galéria</div>
            <h2 className="section-title">A tíz legnagyobb.</h2>
          </div>
          <p className="rogues-deck">
            A legtöbbet ellopó tíz alany — sorrendben, dokumentált kár szerint. Aki{' '}
            <span className="red">rács mögött van</span>, BUSTED. Aki <b>menekül</b>,
            körözött. Aki szabadlábon várja a tárgyalást, megtalálható.
          </p>

          <div className="rogues-key">
            <div className="k">
              <span className="dot busted"></span> Elítélve · börtönben
            </div>
            <div className="k">
              <span className="dot pretrial"></span> Előzetes letartóztatásban
            </div>
            <div className="k">
              <span className="dot loose"></span> Szabadlábon · tárgyalás alatt
            </div>
            <div className="k">
              <span className="dot wanted"></span> Körözött · menekül
            </div>
            <div className="k">
              <span className="dot investig"></span> Vizsgálat alatt
            </div>
          </div>

          <div className="rogues-grid">
            {top10.map(({ case: c, rogue: r }, idx) => {
              const detention: Detention = (r?.detention as Detention) ?? 'loose';
              const isBusted = detention === 'busted';
              const isWanted = detention === 'wanted';
              const rank = String(idx + 1).padStart(2, '0');
              return (
                <Link
                  key={c.id}
                  href={`/adatbazis/${c.id}`}
                  className={`rogue r-${detention}`}
                  style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}
                >
                  <div className="rogue-rank">
                    <span>№ {rank}</span>
                    <span className="id">{c.id}</span>
                  </div>
                  <div className={`rogue-mug ${isBusted ? 'desat' : ''}`}>
                    <div className="corner-tag">
                      № {c.id} / {rank}
                    </div>
                    <Mugshot
                      caseId={c.id}
                      name={c.name}
                      variant={r?.variant ?? 0}
                      glasses={r?.glasses ?? false}
                      hair={(r?.hair as Hair) ?? 'short'}
                      detention={detention}
                    />
                    {isBusted && (
                      <>
                        <div className="stamp">BUSTED</div>
                        <div className="face-cross"></div>
                      </>
                    )}
                    {isWanted && <div className="stamp small">WANTED</div>}
                    <div className={`status-strip ${detention}`}>
                      {r?.detentionLabel ?? '—'}
                    </div>
                  </div>
                  <div className="rogue-name">{c.name}</div>
                  <div className="rogue-pos">
                    {c.position} · {c.region} · {c.caseYear}
                  </div>
                  <div className="rogue-tags">
                    {(r?.crimes ?? []).slice(0, 3).map((cr) => (
                      <span key={cr} className="tag">
                        {cr}
                      </span>
                    ))}
                  </div>
                  <div className="rogue-amount">
                    <span className="lbl">Gyanúsítva</span>
                    <span className="val">{fmtFt(c.amount)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ───── DATABASE PREVIEW ───── */}
      <section className="section" id="database">
        <div className="section-head">
          <div className="section-num">03 / Adatbázis</div>
          <h2 className="section-title">Az ügyek nyilvántartása.</h2>
        </div>

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
        </section>
      </div>

      {/* ───── RESIGNATIONS ───── */}
      <ResignationsSection resignations={topResignations} />

      {/* ───── MEDIA CLOSURES ───── */}
      <MediaClosuresSection closures={topClosures} />

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

      {/* ───── MOBILE PREVIEW ───── */}
      <HomeMobilePreview
        topCases={top10.slice(0, 4).map(({ case: c }) => ({
          id: c.id,
          name: c.name,
          position: c.position,
          region: c.region,
          caseYear: c.caseYear,
          amount: fmtFt(c.amount),
        }))}
        topNews={recentArticles.slice(0, 5).map((a) => ({
          id: a.id,
          headline: a.headline,
          tag: a.featured ? '★ Kiemelt' : a.tag ?? 'Hír',
          time: fmtRelative(a.publishedAt),
        }))}
        kpiMoney={fmtFt(totalDamage)}
        kpiYears={`${fmtNumber(totalPrisonYears)}`}
        moneySlices={moneySlices}
        prisonSlices={prisonSlices}
        moneyPalette={PALETTE_MONEY}
        prisonPalette={PALETTE_PRISON}
      />
    </>
  );
}
