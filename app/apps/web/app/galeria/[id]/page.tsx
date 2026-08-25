import Link from 'next/link';
import { notFound } from 'next/navigation';
import { desc, ilike, or, eq, sql } from 'drizzle-orm';

import { fmtNumber } from '@korr/shared/format';
import { FtValue } from '../../_home/ft-value';
import { getDb, schema } from '@/lib/db';
import { Mugshot } from '@korr/ui/mugshot';
import { GALERIA, type GaleriaDetention, type GaleriaHair } from '../../_home/galeria-config';
import { UGYEK } from '../../_home/ugyek-config';
import { getPersonRollup } from '../../_home/person-rollup-config';
import { CrossLemondosok, CrossMegszunt } from '../../_home/cross-promo';
import { getRelatedComplaintsForGaleria } from '@/lib/related-complaints';
import { RelatedComplaintCard } from '../../_home/related-complaint-card';

export const dynamic = 'force-dynamic';

// Kézzel írt SEO-leírás mind a 10 galéria-profilra — nem az on-page
// `description` gépi levágása (2026-07-31, user kérés). Egy tömör, konkrét
// tényt emel ki, ami a 155 karakteres kereten belül is önmagában megáll.
const GALERIA_SEO: Record<string, string> = {
  'orban-viktor': '16 éves kormányzása alatt állami vagyon és közpénz áramlott a hozzá közelálló vállalkozókhoz.',
  'rogan-antal': 'Belügyminiszterként felügyelte a letelepedésikötvény-programot — a jutalékok Rogán-közeli offshore-okba folytak.',
  'meszaros-lorinc': 'Orbán gyerekkori barátjaként pár száz milliós vagyonból 2026-ra közel 900 milliárd forintos vagyont épített.',
  'tiborcz-istvan': 'Orbán veje 50 milliárdos EU-s közvilágítási szerződést szerzett — az OLAF 16 milliárd visszafizetését javasolta.',
  'szijjarto-peter': 'Külügyminiszterként azeri és orosz energetikai cégekhez fűződő kapcsolatai parlamenti vizsgálat tárgyát képezik.',
  'takacs-peter': 'A lélegeztetőgép-botrányban sógora és Orbán főtanácsadójának fivére milliárdos osztalékot vont ki egy közös cégből.',
  'matolcsy-gyorgy': 'MNB-elnökként 266 milliárd forintot csatornázott alapítványokba — 2026-ban nyomozás indult ellene.',
  'lazar-janos': '46 ingatlan, 3 luxusautó — batidai kastélyát 3,3 milliárd forint közpénzből újíttatta fel saját miniszterségeként.',
  'balasy-gyula': 'A New Land Media alapítója 700 milliárd forintnyi állami reklámpénzt csatornázott a Fidesz-közeli médián keresztül.',
  'semjen-zsolt': 'KDNP-elnökként az egyházi normatívák és ingatlan-visszaadások révén évi tízmilliárdokat juttatott egyházaknak.',
};
const GALERIA_CTA = 'Kattints, és nézd meg az összes ügyét!';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = GALERIA.find((e) => e.id === id);
  if (!entry) return {};
  const base = GALERIA_SEO[id] ?? entry.description;
  return {
    title: { absolute: entry.name },
    description: `${base} ${GALERIA_CTA}`,
  };
}

// The one rollup page still living at its own historic slug rather than
// /adatbazis/szemely/[slug] — see meszaros-lorinc-osszes-ugye/page.tsx.
const ROLLUP_HREF_OVERRIDES: Record<string, string> = {
  'meszaros-lorinc': '/adatbazis/meszaros-lorinc-osszes-ugye',
};

const HU_MONTHS = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];

function fmtDate(d: Date): string {
  return `${d.getFullYear()}. ${HU_MONTHS[d.getMonth()]} ${d.getDate()}.`;
}

export async function generateStaticParams() {
  return GALERIA.map((e) => ({ id: e.id }));
}

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = GALERIA.find((e) => e.id === id);
  if (!entry) notFound();

  const relatedCases = UGYEK.filter(u => u.relatedPersonIds?.includes(id));

  const db = getDb();

  // Cross-link to this person's /adatbazis rollup page, when one exists.
  const rollupConfig = getPersonRollup(id);
  let rollup: { href: string; caseCount: number; total: bigint } | null = null;
  if (rollupConfig) {
    const excluded = rollupConfig.excludeIds ?? [];
    const rollupRows = (await db.execute(sql`
      SELECT COUNT(*)::int AS n, COALESCE(SUM(damage_huf), 0)::text AS total
      FROM "ScandalCatalog"
      WHERE person = ${rollupConfig.personName}
        ${excluded.length > 0 ? sql`AND id NOT IN (${sql.join(excluded.map((v) => sql`${v}`), sql`, `)})` : sql``}
    `)) as unknown as Array<{ n: number; total: string }>;
    const row = rollupRows[0];
    if (row && row.n > 0) {
      rollup = {
        href: ROLLUP_HREF_OVERRIDES[rollupConfig.slug] ?? `/adatbazis/szemely/${rollupConfig.slug}`,
        caseCount: row.n,
        total: BigInt(row.total),
      };
    }
  }

  // Build news query from tag + keywords
  const conditions = [];
  if (entry.newsTag) {
    conditions.push(ilike(schema.newsArticles.tag, `%${entry.newsTag}%`));
  }
  if (entry.newsKeywords) {
    for (const kw of entry.newsKeywords) {
      conditions.push(ilike(schema.newsArticles.headline, `%${kw}%`));
    }
  }

  const rawArticles = conditions.length > 0
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

  const excludeKws = entry.newsExcludeKeywords ?? [];
  const articles = excludeKws.length === 0
    ? rawArticles
    : rawArticles.filter(a =>
        !excludeKws.some(kw => a.headline.toLowerCase().includes(kw.toLowerCase()))
      );

  // user kérés, 2026-08-25 — a személyhez kapcsolódó feljelentések kiemelt
  // keretes hírként (l. related-complaints.ts).
  const relatedComplaints = await getRelatedComplaintsForGaleria(entry.name, entry.newsKeywords ?? []);

  const detentionColors: Record<string, string> = {
    investig: '#c9a800',
    loose: '#4a6a8a',
    pretrial: '#e31937',
    busted: '#e31937',
    wanted: '#e31937',
  };

  return (
    <div className="person-page">
      {/* Hero */}
      <div className="person-hero">
        <div className="person-hero-inner">
          <div className="person-hero-photo">
            {entry.photoUrl ? (
              <img src={entry.photoUrl.startsWith('/') || entry.photoUrl.includes('wikimedia.org') ? entry.photoUrl : `/api/img-proxy?url=${encodeURIComponent(entry.photoUrl)}`} alt={entry.name} className="person-photo-img" />
            ) : (
              <div className="person-photo-placeholder">
                <span>{entry.name.split(' ').map(w => w[0]).join('').slice(0, 2)}</span>
              </div>
            )}
            <div
              className="person-status-badge"
              style={{ background: detentionColors[entry.detention] ?? '#5c5e62' }}
            >
              {entry.detentionLabel}
            </div>
            {entry.photoCredit && (
              <div className="photo-credit">{entry.photoCredit}</div>
            )}
          </div>

          <div className="person-hero-text">
            <div className="person-hero-eyebrow">10 kiemelt személy</div>
            <h1 className="person-hero-name">{entry.name}</h1>
            <div className="person-hero-sub">{entry.subtitle}</div>
            <div className="person-hero-amount">
              <span className="person-hero-amount-lbl">{entry.amountLabel}</span>
              <span className="person-hero-amount-val">{entry.amount}</span>
            </div>
            <p className="person-hero-desc">{entry.description}</p>
            <div className="person-hero-tags">
              {entry.crimes.map(c => (
                <span key={c} className="tag">{c}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="person-body">
        {/* Kapcsolódó feljelentések — kiemelt keretes hír, LEGFELÜL (user
            kérés, 2026-08-25: friss/breaking hírnek a lap tetején a helye,
            nem a hírfolyam alatt). Óvatos megfogalmazás: egy feljelentés
            önmagában nem jelent felelősséget/ítéletet, ezért "köthető"
            helyett semlegesebb "érintő" — l. user report. */}
        {relatedComplaints.length > 0 && (
          <div className="person-news" style={{ marginBottom: 40 }}>
            <h2 className="person-section-title">Kapcsolódó feljelentések</h2>
            <p className="person-section-note">
              Nyilvánosan dokumentált feljelentések, amelyek érintik ezt a személyt — ítélet, felelősség megállapítása nélkül.
            </p>
            {relatedComplaints.slice(0, 3).map((c) => (
              <RelatedComplaintCard key={c.id} complaint={c} />
            ))}
          </div>
        )}

        {rollup && (
          <Link href={rollup.href} className="adatbazis-promo">
            <div className="adatbazis-promo-eyebrow">Adatbázis · {fmtNumber(rollup.caseCount)} dokumentált ügy</div>
            <div className="adatbazis-promo-body">
              <div className="adatbazis-promo-text">
                <div className="adatbazis-promo-title">
                  {entry.name} {fmtNumber(rollup.caseCount)} üggyel szerepel a K-Monitor adatbázisában
                </div>
                <p className="adatbazis-promo-desc">
                  Ha az összes hozzá köthető, tételesen dokumentált ügyre és az összesített
                  érintett közpénzre vagy kíváncsi, nézd meg a teljes áttekintést.
                </p>
              </div>
              <div className="adatbazis-promo-stat">
                <div className="adatbazis-promo-stat-lbl">Összesített érintett közpénz</div>
                <div className="adatbazis-promo-stat-val"><FtValue n={rollup.total} mode="long" /></div>
                <span className="adatbazis-promo-cta">{entry.name} összes ügye →</span>
              </div>
            </div>
          </Link>
        )}

        {entry.videoId && (
          <div className="person-video-section">
            {(entry.videoTitle || entry.videoSummary) && (
              <div className="person-video-teaser">
                {entry.videoChannel && <div className="person-video-teaser-channel">{entry.videoChannel}</div>}
                {entry.videoTitle && <h3 className="person-video-teaser-title">{entry.videoTitle}</h3>}
                {entry.videoSummary && <p className="person-video-teaser-desc">{entry.videoSummary}</p>}
              </div>
            )}
            <div className="person-video-wrap">
              <iframe
                src={`https://www.youtube.com/embed/${entry.videoId}`}
                title={entry.videoTitle ?? `${entry.name} – összefoglaló videó`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        )}
        {!entry.videoId && (
          <div className="person-video-wrap">
            <div className="person-video-placeholder">
              <div className="person-video-icon">▶</div>
              <p>Összefoglaló videó hamarosan</p>
            </div>
          </div>
        )}

        {/* Featured article */}
        {entry.featuredArticle && (
          <a
            href={entry.featuredArticle.url}
            target="_blank"
            rel="noopener noreferrer"
            className="person-featured-article"
          >
            <div className="person-featured-article-meta">
              <span className="person-featured-article-source">{entry.featuredArticle.source}</span>
              {entry.featuredArticle.date && (
                <span className="person-featured-article-date">{entry.featuredArticle.date}</span>
              )}
            </div>
            <div className="person-featured-article-headline">{entry.featuredArticle.headline}</div>
            <p className="person-featured-article-lead">{entry.featuredArticle.lead}</p>
            <span className="person-featured-article-arrow">Cikk olvasása →</span>
          </a>
        )}

        {/* Individual cases */}
        {entry.personCases && entry.personCases.length > 0 && (
          <div className="person-cases">
            <h2 className="person-section-title">Feltárt ügyek</h2>
            <p className="person-section-note">
              Az alábbi esetek sajtócikkeken és nyilvánosan hozzáférhető dokumentumokon alapulnak.
              Jogerős ítélet hiányában bűnösséget nem állítanak.
            </p>
            {entry.personCases.map((c, i) => (
              <div key={i} className="person-case-card">
                <div className="person-case-num">/ {String(i + 1).padStart(2, '0')}</div>
                <div className="person-case-body">
                  <h3 className="person-case-title">{c.title}</h3>
                  <p className="person-case-desc">{c.description}</p>
                  {c.pinnedArticles && c.pinnedArticles.map((a, ai) => (
                    <a
                      key={ai}
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ugy-block-article-card"
                    >
                      <div className="ugy-block-article-meta">
                        <span className="ugy-block-article-source">{a.source}</span>
                      </div>
                      <div className="ugy-block-article-headline">{a.headline}</div>
                      {a.lead && <p className="ugy-block-article-lead">{a.lead}</p>}
                      <span className="ugy-block-article-arrow">Cikk olvasása →</span>
                    </a>
                  ))}
                  {c.videoId && (
                    <div className="person-case-video">
                      {(c.videoTitle || c.videoSummary) && (
                        <div className="person-case-video-header">
                          {c.videoChannel && <div className="person-case-video-channel">{c.videoChannel}</div>}
                          {c.videoTitle && <div className="person-case-video-title">{c.videoTitle}</div>}
                          {c.videoSummary && <p className="person-case-video-summary">{c.videoSummary}</p>}
                        </div>
                      )}
                      <div className="person-case-video-wrap">
                        <iframe
                          src={`https://www.youtube.com/embed/${c.videoId}`}
                          title={c.videoTitle ?? c.title}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    </div>
                  )}
                  <div className="person-case-footer">
                    {c.estimatedDamage && (
                      <div className="person-case-dmg">
                        <span className="person-case-dmg-lbl">Érintett közpénz</span>
                        <span className="person-case-dmg-val">{c.estimatedDamage}</span>
                      </div>
                    )}
                    <div className="person-case-crimes">
                      {c.crimeTypes.map(cr => (
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

                  {/* Sub-cases */}
                  {c.subCases && c.subCases.length > 0 && (
                    <div className="person-subcases">
                      {c.subCases.map((sc, si) => (
                        <div key={si} className="person-subcase-card">
                          <div className="person-subcase-num">/ {String(i + 1).padStart(2, '0')}.{si + 1}</div>
                          <div className="person-subcase-body">
                            <h4 className="person-subcase-title">{sc.title}</h4>
                            <p className="person-subcase-desc">{sc.description}</p>
                            <div className="person-subcase-footer">
                              {sc.estimatedDamage && (
                                <div className="person-case-dmg">
                                  <span className="person-case-dmg-lbl">Érintett közpénz</span>
                                  <span className="person-case-dmg-val">{sc.estimatedDamage}</span>
                                </div>
                              )}
                              <div className="person-case-crimes">
                                {sc.crimeTypes.map(cr => (
                                  <span key={cr} className="tag tag-sm">{cr}</span>
                                ))}
                              </div>
                              {sc.sourceUrl && (
                                <a
                                  href={sc.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="person-case-source"
                                >
                                  Forrás: {sc.sourceLabel ?? 'link'} →
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Related big cases */}
        {relatedCases.length > 0 && (
          <div className="person-related-cases">
            <h2 className="person-section-title">Kapcsolódó nagy ügyek</h2>
            <p className="person-section-note">
              Az alábbi ügyek sajtójelentések alapján hozhatók összefüggésbe ezzel a személlyel.
            </p>
            <div className="person-related-cases-grid">
              {relatedCases.map(u => (
                <Link key={u.id} href={`/ugyek/${u.id}`} className="person-related-case-card">
                  <div className="person-related-case-eyebrow">{(u.eyebrow.split('·')[0] ?? '').trim()}</div>
                  <div className="person-related-case-title">{u.title}</div>
                  {u.estimatedDamage && (
                    <div className="person-related-case-dmg">
                      <span className="person-related-case-dmg-lbl">Érintett közpénz</span>
                      <span className="person-related-case-dmg-val">{u.estimatedDamage}</span>
                    </div>
                  )}
                  {u.crimeTypes && u.crimeTypes.length > 0 && (
                    <div className="person-related-case-tags">
                      {u.crimeTypes.slice(0, 2).map(c => (
                        <span key={c} className="tag tag-sm">{c}</span>
                      ))}
                    </div>
                  )}
                  <div className="person-related-case-cta">Teljes ügy →</div>
                </Link>
              ))}
            </div>
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
              {articles.map(a => (
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

      {/* More persons navigation */}
      <div className="person-more-section">
        <div className="person-more-inner">
          <div className="person-more-label">Többi kiemelt személy</div>
          <div className="person-more-grid">
            {GALERIA.filter(e => e.id !== entry.id).map(e => (
              <Link key={e.id} href={`/galeria/${e.id}`} className="person-more-card">
                <div className={`person-more-mug r-${e.detention}`}>
                  {e.photoUrl ? (
                    <img
                      src={e.photoUrl.startsWith('/') || e.photoUrl.includes('wikimedia.org') ? e.photoUrl : `/api/img-proxy?url=${encodeURIComponent(e.photoUrl)}`}
                      alt={e.name}
                      className="person-more-img"
                    />
                  ) : (
                    <Mugshot
                      caseId={e.id}
                      name={e.name}
                      variant={e.variant ?? 0}
                      glasses={e.glasses ?? false}
                      hair={(e.hair as GaleriaHair) ?? 'short'}
                      detention={e.detention as GaleriaDetention}
                    />
                  )}
                </div>
                <div className="person-more-name">{e.name}</div>
                <div className="person-more-sub">{(e.subtitle.split('·')[0] ?? '').trim()}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className="cross-promo-below-more">
        <div className="cross-promo-below-more-inner">
          <CrossLemondosok />
          <CrossMegszunt />
        </div>
      </div>
    </div>
  );
}
