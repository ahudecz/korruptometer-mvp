import Link from 'next/link';
import { notFound } from 'next/navigation';
import { desc, ilike, or, eq } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { Mugshot } from '@korr/ui/mugshot';
import { GALERIA, type GaleriaDetention, type GaleriaHair } from '../../_home/galeria-config';

export const dynamic = 'force-dynamic';

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

  const db = getDb();

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
              <div className="photo-credit">Fotó: {entry.photoCredit}</div>
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
        {/* Video placeholder */}
        <div className="person-video-wrap">
          {entry.videoId ? (
            <iframe
              src={`https://www.youtube.com/embed/${entry.videoId}`}
              title={`${entry.name} – összefoglaló videó`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="person-video-placeholder">
              <div className="person-video-icon">▶</div>
              <p>Összefoglaló videó hamarosan</p>
            </div>
          )}
        </div>

        {/* Individual cases */}
        {entry.personCases && entry.personCases.length > 0 && (
          <div className="person-cases">
            <h2 className="person-section-title">Feltárt ügyek és gyanúsítások</h2>
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
                  <div className="person-case-footer">
                    {c.estimatedDamage && (
                      <div className="person-case-dmg">
                        <span className="person-case-dmg-lbl">Becsült kár</span>
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
                </div>
              </div>
            ))}
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
    </div>
  );
}
