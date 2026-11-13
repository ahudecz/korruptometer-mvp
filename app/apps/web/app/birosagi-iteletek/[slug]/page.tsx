import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, desc, eq, gte, ilike, or } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { LETARTOZTATOTTAK, getDetaineeProfile, type DetaineeBlock, type DetaineeVideo } from '../../_home/letartoztatottak-config';
import { UGYEK } from '../../_home/ugyek-config';
import { rollupHref } from '../../_home/person-rollup-config';
import { BreakingUpdateBox } from '../../_home/breaking-update-box';
import { PodcastVideoBox } from '../../_home/podcast-video-box';
import { CrossLemondosok, CrossMegszunt, CrossErdekesUgyek } from '../../_home/cross-promo';

// 2026-11-13: „Börtönben van-e?” személyenkénti aloldal (l. letartoztatottak-config.ts).
// A hírfolyam élő (minden új cikk azonnal megjelenik), ezért 2 perces ISR,
// ugyanúgy, mint a /birosagi-iteletek listaoldal.
export const revalidate = 120;

export function generateStaticParams() {
  return LETARTOZTATOTTAK.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getDetaineeProfile(slug);
  if (!p) return {};
  return {
    title: { absolute: `${p.name} — miért tartóztatták le?` },
    description: p.seoDescription,
    alternates: { canonical: `/birosagi-iteletek/${p.slug}` },
    openGraph: { images: [{ url: p.photo.replace(/\.webp$/, '.png') }] },
  };
}

const HU_MONTHS = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];
function fmtDate(d: Date): string {
  return `${d.getFullYear()}. ${HU_MONTHS[d.getMonth()]} ${d.getDate()}.`;
}

function VideoBlock({ video }: { video: DetaineeVideo }) {
  return (
    <div className="ugy-block-video detainee-video">
      <div className="ugy-block-video-meta">
        <span className="ugy-block-video-label">{video.label}</span>
        <span className="ugy-block-video-title">{video.title}</span>
      </div>
      <p className="ugy-block-video-summary">{video.summary}</p>
      <PodcastVideoBox videoId={video.id} title={video.title} wrapClassName="ugy-block-video-wrap" />
    </div>
  );
}

function RelatedUgyCard({ ugyId }: { ugyId: string }) {
  const u = UGYEK.find((x) => x.id === ugyId);
  if (!u) return null;
  return (
    <Link href={`/ugyek/${u.id}`} className="person-related-case-card detainee-related-ugy">
      <div className="person-related-case-eyebrow">Kiemelt ügy · {(u.eyebrow.split('·')[0] ?? '').trim()}</div>
      <div className="person-related-case-title">{u.title}</div>
      <p className="detainee-related-ugy-summary">{u.summary}</p>
      {u.estimatedDamage && (
        <div className="person-related-case-dmg">
          <span className="person-related-case-dmg-lbl">{u.estimatedDamageLabel ?? 'Érintett közpénz'}</span>
          <span className="person-related-case-dmg-val">{u.estimatedDamage}</span>
        </div>
      )}
      <div className="person-related-case-cta">A teljes ügy →</div>
    </Link>
  );
}

function Block({ block, relatedUgyId }: { block: DetaineeBlock; relatedUgyId?: string }) {
  switch (block.type) {
    case 'text':
      return (
        <div className="detainee-text">
          {block.heading && <h3 className="detainee-subheading">{block.heading}</h3>}
          {block.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
        </div>
      );
    case 'articles':
      return (
        <div className="detainee-articles">
          {block.items.map((a) => (
            <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer" className="ugy-block-article-card">
              <div className="ugy-block-article-meta">
                <span className="ugy-block-article-source">{a.source}</span>
                <span className="ugy-block-article-date">{a.date}</span>
              </div>
              <div className="ugy-block-article-headline">{a.headline}</div>
              {a.lead && <p className="ugy-block-article-lead">{a.lead}</p>}
              <span className="ugy-block-article-arrow">Cikk olvasása →</span>
            </a>
          ))}
        </div>
      );
    case 'video':
      return <VideoBlock video={block.video} />;
    case 'quote':
      return (
        <blockquote className="verdict-reaction-quote detainee-quote">
          <p>„{block.text}”</p>
          <a href={block.url} target="_blank" rel="noopener noreferrer" className="detainee-quote-attr">— {block.attribution}</a>
        </blockquote>
      );
    case 'related-ugy':
      return relatedUgyId ? <RelatedUgyCard ugyId={relatedUgyId} /> : null;
  }
}

export default async function DetaineePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getDetaineeProfile(slug);
  if (!p) notFound();

  const ugy = p.relatedUgyId ? UGYEK.find((u) => u.id === p.relatedUgyId) : undefined;
  const breaking = p.showUgyBreaking ? ugy?.breakingUpdate : undefined;

  // Hírek azóta — defenzíven: egy DB-hiba ne vigye el az egész oldalt.
  let articles: { id: string; headline: string; sourceUrl: string; publishedAt: Date; sourceName: string | null }[] = [];
  let newsError = false;
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: schema.newsArticles.id,
        headline: schema.newsArticles.headline,
        sourceUrl: schema.newsArticles.sourceUrl,
        publishedAt: schema.newsArticles.publishedAt,
        sourceName: schema.sources.name,
      })
      .from(schema.newsArticles)
      .leftJoin(schema.sources, eq(schema.sources.id, schema.newsArticles.sourceId))
      .where(
        and(
          or(...p.newsKeywords.map((kw) => ilike(schema.newsArticles.headline, `%${kw}%`))),
          gte(schema.newsArticles.publishedAt, new Date(p.newsSince)),
        ),
      )
      .orderBy(desc(schema.newsArticles.publishedAt))
      .limit(60);
    const ex = (p.newsExcludeKeywords ?? []).map((k) => k.toLowerCase());
    articles = (rows ?? []).filter((a) => !ex.some((k) => a.headline.toLowerCase().includes(k))).slice(0, 40);
  } catch {
    newsError = true;
  }

  return (
    <div className="person-page detainee-page">
      <div className="person-hero">
        <div className="person-hero-inner">
          <div className="person-hero-photo">
            <img src={p.photo} alt={p.photoAlt} className="person-photo-img" />
            <div className="person-status-badge" style={{ background: '#e31937' }}>{p.statusLabel}</div>
            {p.photoCredit && <div className="photo-credit">{p.photoCredit}</div>}
          </div>
          <div className="person-hero-text">
            <div className="person-hero-eyebrow">
              <Link href="/birosagi-iteletek" className="detainee-eyebrow-link">Börtönben van-e?</Link> · Letartóztatottak
            </div>
            <h1 className="person-hero-name">{p.name}</h1>
            <div className="person-hero-sub">{p.subtitle}</div>
            <div className="person-hero-amount">
              <span className="person-hero-amount-lbl">{p.amountLabel}</span>
              <span className="person-hero-amount-val">{p.amount}</span>
            </div>
            <p className="person-hero-desc">{p.intro}</p>
            <div className="person-hero-tags">
              {p.crimes.map((c) => <span key={c} className="tag">{c}</span>)}
            </div>
          </div>
        </div>
      </div>

      <div className="person-body">
        {breaking && <BreakingUpdateBox update={breaking} />}

        {p.featuredVideo && (
          <div className="detainee-featured-video">
            <VideoBlock video={p.featuredVideo} />
          </div>
        )}

        <div className="ugy-status-summary detainee-status">
          {p.statusItems.map((s) => (
            <div key={s.label} className="ugy-status-summary-row">
              <span className="ugy-status-summary-icon">{s.icon}</span>
              <div className="ugy-status-summary-body">
                <div className="ugy-status-summary-label">{s.label}</div>
                <div className="ugy-status-summary-value">{s.value}</div>
              </div>
            </div>
          ))}
        </div>

        {p.sections.map((sec) => (
          <section key={sec.id} id={sec.id} className="detainee-section">
            <h2 className="person-section-title">{sec.title}</h2>
            {sec.blocks.map((b, i) => <Block key={i} block={b} relatedUgyId={p.relatedUgyId} />)}
          </section>
        ))}

        {p.rollupSlug && (
          <Link href={rollupHref(p.rollupSlug)} className="detainee-rollup-link">
            <span>{p.name} összes dokumentált ügye a K-Monitor adatbázisában</span>
            <span>Adatbázis →</span>
          </Link>
        )}

        <div className="person-news">
          <h2 className="person-section-title">Hírek azóta</h2>
          <p className="person-section-note">
            Automatikusan szűrve a napi hírfolyamból — minden új cikk azonnal megjelenik.
          </p>
          {newsError ? (
            <div className="person-news-empty">
              A hírek most nem tölthetők be. <Link href={`/birosagi-iteletek/${p.slug}`}>Próbáld újra →</Link>
            </div>
          ) : articles.length === 0 ? (
            <div className="person-news-empty">Még nincs beindexelt hír — a következő frissítéskor megjelenik.</div>
          ) : (
            <div className="person-news-list">
              {articles.map((a) => (
                <a key={a.id} href={a.sourceUrl} target="_blank" rel="noopener noreferrer" className="person-news-item">
                  <span className="person-news-source">{a.sourceName ?? 'Forrás'}</span>
                  <span className="person-news-date">{fmtDate(a.publishedAt)}</span>
                  <span className="person-news-headline">{a.headline}</span>
                </a>
              ))}
            </div>
          )}
        </div>

        <Link href="/birosagi-iteletek" className="detainee-back">← Vissza a „Börtönben van-e?” listához</Link>
      </div>

      <div className="cross-promo-below-more">
        <div className="cross-promo-below-more-inner">
          <CrossErdekesUgyek pageKey={`/birosagi-iteletek/${p.slug}`} />
          <CrossLemondosok />
          <CrossMegszunt />
        </div>
      </div>
    </div>
  );
}
