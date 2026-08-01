import Link from 'next/link';
import { notFound } from 'next/navigation';
import { desc, ilike, or, eq } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { WATCH_LIST, type WatchPerson } from '../../_home/watchlist-config';
import { WATCHLIST_DETAIL, type WatchlistBreakingBlock } from '../../_home/watchlist-detail-config';
import { CrossGaleria, CrossUgyek, CrossLemondosok } from '../../_home/cross-promo';
export const dynamic = 'force-dynamic';

// Kézzel írt, a személyre szabott — nem a bio/nerRole gépi levágásából
// összerakott — SEO-leírás mind a 8 WATCH_LIST-es emberre (2026-07-31, user
// kérés: a truncate(bio)+generikus CTA "csak annyit ér, mint amit a Google
// magától is csinálna"). A CTA mindenkinél ugyanaz, és szó szerint a cím
// kérdésére felel — nem az általános "hogy áll most" volt előtte.
const RESIGNATION_SEO: Record<string, string> = {
  'sulyok-tamas': 'Sulyok Tamás köztársasági elnökként egyetlen kényelmetlen törvényt sem küldött vissza az Országgyűlésnek.',
  'polt-peter': 'Polt Péter 21 évig volt legfőbb ügyész — egyetlen NER-közeli korrupciós ügyet sem vitt vádig.',
  'nagy-gabor-balint': 'Nagy Gábor Bálint Polt Péter utódjaként folytatja a szelektív igazságszolgáltatás gyakorlatát legfőbb ügyészként.',
  'varga-zs-andras': 'Varga Zs. András Kúria-elnökként törvénysértően bocsátott el bírókat, és feljelentette a Tisza-appot letöltőket.',
  'windisch-laszlo': 'Windisch László ÁSZ-elnökként az ellenzéket bünteti, a NER-projekteket érintetlenül hagyja.',
  'rigo-csaba-balazs': 'Rigó Csaba Balázs GVH-elnökként nem vizsgálta az oligarchák monopóliumait, és kirúgta a kritikus közgazdászt.',
  'koltay-andras': 'Koltay András NMHH-elnökként védte a NER-médiumokat, majd 2026 júliusában távozott posztjáról.',
  'senyei-gyorgy': 'Senyei György OBH-elnökként kormányülésen vett részt, és jó viszonyban áll a korrupt Schadl Györggyel.',
};
const RESIGNATION_CTA = 'Kattints, és nézd meg, lemondott-e már!';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const person = WATCH_LIST.find((p) => p.id === id);
  if (!person) return {};
  const base = RESIGNATION_SEO[id] ?? `${person.name} — ${person.institution}. Lemondásra felszólítva.`;
  return {
    // absolute: a "%s — Kegyencjárat" root-template ne toldja meg — a
    // Google-találatban úgyis ott a domain, felesleges duplikáció (user kérés).
    title: { absolute: `Lemondott-e már ${person.name}?` },
    description: `${base} ${RESIGNATION_CTA}`,
  };
}

const HU_MONTHS = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];

function fmtDate(d: Date): string {
  return `${d.getFullYear()}. ${HU_MONTHS[d.getMonth()]} ${d.getDate()}.`;
}

function statusLabel(status: WatchPerson['status']): string {
  if (status === 'active') return 'Hivatalban van';
  if (status === 'resigned') return 'Lemondott';
  if (status === 'removed') return 'Eltávolítva';
  return status;
}

function statusColor(status: WatchPerson['status']): string {
  if (status === 'active') return '#2a8a4a';
  return '#e31937';
}

// 2026-07-26 — user kérés: ez a végoldal KIZÁRÓLAG a 8 CALLED_TO_RESIGN
// (WATCH_LIST) tisztségviselőé (l. generateStaticParams fentebb) — ők
// mindannyian a PERMANENT_BREAKING_NAMES listán vannak, tehát a BREAKING
// jelölés itt SOSE jár le, függetlenül attól, mikor történt a távozás
// (korábban 7 nap után eltűnt, l. BREAKING_BADGE_DAYS — ez a lejárat most
// megszűnt).
function isStillBreaking(_detectedAt: string | undefined): boolean {
  return true;
}

function photoSrc(url: string): string {
  if (url.startsWith('/')) return url;
  return `/api/img-proxy?url=${encodeURIComponent(url)}`;
}

export async function generateStaticParams() {
  return WATCH_LIST.map((p) => ({ id: p.id }));
}

export default async function WatchlistPersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const staticPerson = WATCH_LIST.find((p) => p.id === id);
  if (!staticPerson) notFound();

  const detail = WATCHLIST_DETAIL.find((d) => d.id === id);

  const db = getDb();

  // detect-watchlist-removals.ts írhat ide egy sort, ha legalább 2 független
  // forrás megerősítette, hogy a megbízatás ténylegesen megszűnt — ez felülírja
  // a statikus configot, amíg valaki kézzel be nem ír egy végleges státuszt.
  // Try/catch: a WatchlistRemoval tábla a 0038 migráció lefuttatásáig nem
  // létezik éles DB-n — enélkül a védelem nélkül egy hiányzó tábla ledöntötte
  // ezt a végoldalt is (2026-07-10).
  let dbRemoval: typeof schema.watchlistRemovals.$inferSelect | undefined;
  try {
    const rows = await db
      .select()
      .from(schema.watchlistRemovals)
      .where(eq(schema.watchlistRemovals.personId, id))
      .limit(1);
    dbRemoval = rows[0];
  } catch {
    dbRemoval = undefined;
  }

  const person: WatchPerson = dbRemoval
    ? { ...staticPerson, status: dbRemoval.removalType === 'resigned' ? 'resigned' : 'removed' }
    : staticPerson;

  const breakingBlock: WatchlistBreakingBlock | undefined = dbRemoval
    ? {
        source: dbRemoval.sourceName ?? 'Forrás',
        date: dbRemoval.sourceDateLabel ?? '',
        headline: dbRemoval.sourceHeadline,
        lead: dbRemoval.lead ?? undefined,
        url: dbRemoval.sourceUrl,
        detectedAt: dbRemoval.detectedAt.toISOString().slice(0, 10),
      }
    : detail?.breakingBlock;

  const conditions = [];
  if (detail?.newsKeywords) {
    for (const kw of detail.newsKeywords) {
      conditions.push(ilike(schema.newsArticles.headline, `%${kw}%`));
    }
  }

  const articles = conditions.length > 0
    ? await db
        .select({
          id: schema.newsArticles.id,
          headline: schema.newsArticles.headline,
          excerpt: schema.newsArticles.excerpt,
          sourceUrl: schema.newsArticles.sourceUrl,
          publishedAt: schema.newsArticles.publishedAt,
          sourceName: schema.sources.name,
        })
        .from(schema.newsArticles)
        .leftJoin(schema.sources, eq(schema.sources.id, schema.newsArticles.sourceId))
        .where(or(...conditions))
        .orderBy(desc(schema.newsArticles.publishedAt))
        .limit(20)
    : [];

  const others = WATCH_LIST.filter((p) => p.id !== id);

  return (
    <div className="person-page">
      {/* Status stripe — full-width bar above hero */}
      {person.status !== 'active' && (
        <div className={`person-status-stripe${person.status === 'resigned' ? ' person-status-stripe--resigned' : ''}`}>
          {person.status === 'removed' ? 'ELTÁVOLÍTVA' : 'LEMONDOTT'}
        </div>
      )}

      {/* Hero */}
      <div className="person-hero">
        <div className="person-hero-inner">
          <div className="person-hero-photo">
            {person.photoUrl ? (
              <img
                src={photoSrc(person.photoUrl)}
                alt={person.name}
                className="person-photo-img"
                style={person.objectPosition ? { objectPosition: person.objectPosition } : undefined}
              />
            ) : (
              <div className="person-photo-placeholder">
                <span>{person.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>
              </div>
            )}
            <div
              className="person-status-badge"
              style={{ background: statusColor(person.status) }}
            >
              {statusLabel(person.status)}
            </div>
            {person.photoCredit && (
              <div className="photo-credit">{person.photoCredit}</div>
            )}
          </div>

          <div className="person-hero-text">
            <div className="person-hero-eyebrow">Lemondásra felszólított személy</div>
            <h1 className="person-hero-name">{person.name}</h1>
            <div className="person-hero-sub">{person.institution}</div>
            {detail?.nerRole && (
              <p className="person-hero-desc">{detail.nerRole}</p>
            )}
          </div>
        </div>
      </div>

      <div className="person-body">
        {/* Bio + breaking block grouped so they share one gap slot */}
        {(detail?.bio || breakingBlock) && (
          <div className="person-bio-section">
            {detail?.bio && (
              <div className="person-bio">
                <p>{detail.bio}</p>
              </div>
            )}
            {breakingBlock && (
              <a
                href={breakingBlock.url || undefined}
                target="_blank"
                rel="noopener noreferrer"
                className={`ugy-block-article-card ugy-block-article-card--breaking${!breakingBlock.url ? ' no-link' : ''}`}
              >
                {isStillBreaking(breakingBlock.detectedAt) && (
                  <div className="ugy-block-article-breaking-badge">
                    <span className="ugy-block-article-breaking-dot" />
                    BREAKING
                  </div>
                )}
                <div className="ugy-block-article-meta">
                  <span className="ugy-block-article-source">{breakingBlock.source}</span>
                  {breakingBlock.date && (
                    <span className="ugy-block-article-date">{breakingBlock.date}</span>
                  )}
                </div>
                <div className="ugy-block-article-headline">{breakingBlock.headline}</div>
                {breakingBlock.lead && (
                  <p className="ugy-block-article-lead">{breakingBlock.lead}</p>
                )}
                {breakingBlock.url && (
                  <span className="ugy-block-article-arrow">Cikk olvasása →</span>
                )}
              </a>
            )}
          </div>
        )}

        {/* Video */}
        {detail?.videoId ? (
          <div className="person-video-section">
            {detail.videoSummary && (
              <div className="person-video-teaser">
                <div className="person-video-teaser-channel">{detail.videoSummary.source}</div>
                <div className="person-video-teaser-title">{detail.videoSummary.title}</div>
                <p className="person-video-teaser-desc">{detail.videoSummary.description}</p>
              </div>
            )}
            <div className="person-video-wrap">
              <iframe
                src={`https://www.youtube.com/embed/${detail.videoId}`}
                title={`${person.name} – összefoglaló videó`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        ) : (
          <div className="person-video-wrap">
            <div className="person-video-placeholder">
              <div className="person-video-icon">▶</div>
              <p>Összefoglaló videó hamarosan</p>
            </div>
          </div>
        )}

        {/* Key cases */}
        {detail?.keyCases && detail.keyCases.length > 0 && (
          <div className="person-cases">
            <h2 className="person-section-title">Főbb szerepek és ügyek</h2>
            <p className="person-section-note">
              Az alábbi esetek sajtócikkeken és nyilvánosan hozzáférhető dokumentumokon alapulnak.
              Jogerős ítélet hiányában bűnösséget nem állítanak.
            </p>
            {detail.keyCases.map((c, i) => (
              <div key={i} className="person-case-card">
                <div className="person-case-num">/ {String(i + 1).padStart(2, '0')}</div>
                <div className="person-case-body">
                  <h3 className="person-case-title">{c.title}</h3>
                  <p className="person-case-desc">{c.description}</p>
                  {c.videoId && (
                    <div className="ugy-block-video" style={{ marginTop: '16px' }}>
                      <div className="ugy-block-video-meta">
                        {c.videoLabel && <span className="ugy-block-video-label">{c.videoLabel}</span>}
                        {c.videoTitle && <span className="ugy-block-video-title">{c.videoTitle}</span>}
                      </div>
                      {c.videoSummary && <p className="ugy-block-video-summary">{c.videoSummary}</p>}
                      <div className="ugy-block-video-wrap">
                        <iframe
                          src={`https://www.youtube.com/embed/${c.videoId}`}
                          title={c.title}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    </div>
                  )}
                  <div className="person-case-footer">
                    <div className="person-case-crimes">
                      {c.crimeTypes.map((cr) => (
                        <span key={cr} className="tag">{cr}</span>
                      ))}
                    </div>
                    {c.sourceUrl && (
                      <a
                        href={c.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="person-case-source"
                      >
                        Forrás: {c.sourceLabel ?? 'link'} →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Source refs */}
        {detail?.pinnedLinks && detail.pinnedLinks.length > 0 && (
          <div className="ugy-sources">
            <p className="ugy-sources-disclaimer">
              A fenti összefoglaló az alábbi cikkek tartalmaiból készült — nem saját szerkesztőségi tartalom.
            </p>
            <div className="ugy-sources-label">Forrás</div>
            <ul className="ugy-sources-list">
              {detail.pinnedLinks.map((l, i) => (
                <li key={i}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer">
                    {l.title} →
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* News */}
        {articles.length > 0 && (
          <div className="person-news">
            <h2 className="person-section-title">Kapcsolódó hírek</h2>
            <p className="person-section-note">
              Automatikusan szűrve a napi hírfolyamból — minden új cikk azonnal megjelenik.
            </p>
            <div className="person-news-list">
              {articles.map((a) => (
                <a
                  key={a.id}
                  href={a.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="person-news-item"
                >
                  <span className="person-news-source">{a.sourceName}</span>
                  <span className="person-news-date">{fmtDate(a.publishedAt)}</span>
                  <span className="person-news-headline">{a.headline}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {articles.length === 0 && (
          <div className="person-news-empty">
            Még nincs beindexelt hír ehhez a személyhez — a következő scrape során frissül.
          </div>
        )}
      </div>

      {/* Other watchlist persons */}
      <div className="person-more-section">
        <div className="person-more-inner">
          <div className="person-more-label">Többi felszólított személy</div>
          <div className="person-more-grid">
            {others.map((p) => (
              <Link key={p.id} href={`/lemondasok/${p.id}`} className="person-more-card">
                <div className="person-more-mug r-loose">
                  {p.photoUrl ? (
                    <img
                      src={photoSrc(p.photoUrl)}
                      alt={p.name}
                      className="person-more-img"
                    />
                  ) : (
                    <div className="person-photo-placeholder">
                      <span>{p.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>
                    </div>
                  )}
                </div>
                <div className="person-more-name">{p.name}</div>
                <div className="person-more-sub">{p.institution}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Cross-promo */}
      <div className="cross-promo-below-more">
        <div className="cross-promo-below-more-inner">
          <CrossGaleria />
          <CrossUgyek />
          <CrossLemondosok />
        </div>
      </div>
    </div>
  );
}
