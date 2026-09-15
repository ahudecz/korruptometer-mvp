import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { UGYEK } from '../../../_home/ugyek-config';
import { UGY_SUBPAGES, getSubpage, type InlineLink, type SubpageBlock, type TableCell, type UgySubpage } from '../../../_home/ugyek-subpages';
import { CrossLemondosok, CrossMegszunt, CrossGaleria, CrossFelszolitottak } from '../../../_home/cross-promo';
import { loadCaseDetentions, isStillDetained, type CaseDetentionRow } from '@/lib/case-detentions';

// SEO-szempontból a lényeg, hogy a Googlebot azonnal kiszolgált HTML-t
// kapjon, ezért ISR-rel dolgozunk. 10 perc: a letartóztatás-táblázat élő
// adatot olvas a CourtVerdict táblából (l. case-detentions.ts), és egy új
// NKA-s letartóztatás ennyi időn belül magától megjelenik itt is.
export const revalidate = 600;

const SITE = 'https://www.kegyencjarat.hu';

const HU_MONTHS_LONG = [
  'január', 'február', 'március', 'április', 'május', 'június',
  'július', 'augusztus', 'szeptember', 'október', 'november', 'december',
];

/** '2026-09-15' → '2026. szeptember 15.' — a strukturált adat marad ISO. */
function huDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${y}. ${HU_MONTHS_LONG[m - 1]} ${d}.`;
}

export async function generateStaticParams() {
  return UGY_SUBPAGES.map((s) => ({ id: s.parentId, topic: s.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string; topic: string }> }) {
  const { id, topic } = await params;
  const sub = getSubpage(id, topic);
  if (!sub) return {};
  const url = `${SITE}/ugyek/${sub.parentId}/${sub.id}`;
  return {
    title: { absolute: `${sub.seoTitle} — Kegyencjárat` },
    description: sub.seoDescription,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      title: sub.seoTitle,
      description: sub.seoDescription,
      locale: 'hu_HU',
      siteName: 'Kegyencjárat',
      publishedTime: sub.publishedAt,
      modifiedTime: sub.updatedAt,
    },
    twitter: {
      card: 'summary_large_image',
      title: sub.seoTitle,
      description: sub.seoDescription,
    },
  };
}

/** A tartalom-blokkokból tartalomjegyzék — a `heading`-gel és `id`-val ellátottakból. */
function tocItems(sub: UgySubpage): { id: string; label: string }[] {
  const items = sub.blocks
    .filter((b): b is Extract<SubpageBlock, { id?: string }> & { heading: string } =>
      'id' in b && !!b.id && 'heading' in b && !!b.heading)
    .map((b) => ({ id: b.id!, label: b.heading }));
  if (sub.faq.length > 0) items.push({ id: 'gyik', label: 'Gyakran ismételt kérdések' });
  return items;
}

/**
 * A bekezdésben megadott szövegrészletekből linket csinál. Szándékosan
 * egyszerű: szó szerinti darabolás, nem regex/HTML — ha egy `links[].text`
 * nem szerepel a bekezdésben, az csak annyit jelent, hogy nem lesz belőle
 * link, a szöveg attól még hibátlanul megjelenik.
 */
function withLinks(content: string, links?: InlineLink[]): React.ReactNode {
  if (!links || links.length === 0) return content;
  let parts: React.ReactNode[] = [content];
  links.forEach((link, li) => {
    const next: React.ReactNode[] = [];
    for (const part of parts) {
      if (typeof part !== 'string' || !part.includes(link.text)) {
        next.push(part);
        continue;
      }
      const [before, ...rest] = part.split(link.text);
      next.push(before);
      next.push(
        link.external ? (
          <a key={`l-${li}`} href={link.href} target="_blank" rel="noopener noreferrer">{link.text}</a>
        ) : (
          <Link key={`l-${li}`} href={link.href}>{link.text}</Link>
        ),
      );
      next.push(rest.join(link.text));
    }
    parts = next;
  });
  return parts.map((p, i) => <React.Fragment key={i}>{p}</React.Fragment>);
}

/** Táblázatcella: sima szöveg, vagy kattintható forrás — a /lemondasok tábla
 *  mintáját követve „→" nyíllal zárva. */
function tableCell(cell: TableCell): React.ReactNode {
  if (typeof cell === 'string') return cell;
  return (
    <a href={cell.href} target="_blank" rel="noopener noreferrer">
      {cell.text} →
    </a>
  );
}

function DetentionTable({
  block,
  rows,
}: {
  block: Extract<SubpageBlock, { type: 'detention-table' }>;
  rows: CaseDetentionRow[];
}) {
  // Előzetesben lévők előre, a szabadlábra helyezettek a lista végére —
  // ugyanaz a partíció, mint a /birosagi-iteletek verdict-stats.ts-ében.
  const sorted = [...rows].sort((a, b) => {
    const da = isStillDetained(a.verdictType) ? 0 : 1;
    const db = isStillDetained(b.verdictType) ? 0 : 1;
    if (da !== db) return da - db;
    return b.verdictDate.getTime() - a.verdictDate.getTime();
  });
  const detained = sorted.filter((r) => isStillDetained(r.verdictType)).length;
  return (
    <div className="ugy-block-text" id={block.id}>
      <h2 className="ugy-block-heading">{block.heading}</h2>
      {block.intro && <p>{block.intro}</p>}
      {sorted.length === 0 ? (
        <p className="seo-table-note">
          A lista éppen nem elérhető — nézd meg addig a{' '}
          <Link href="/birosagi-iteletek">Börtönben van-e? oldalt</Link>.
        </p>
      ) : (
        <>
          <p className="seo-detention-count">
            <strong>{sorted.length}</strong> nyilvántartott kényszerintézkedés ·{' '}
            <strong>{detained}</strong> érintett van jelenleg is előzetes letartóztatásban
          </p>
          <div className="seo-table-wrap">
            <table className="seo-table seo-detention-table">
              <thead>
                <tr>
                  <th scope="col">Név</th>
                  <th scope="col">Pozíció</th>
                  <th scope="col">Státusz</th>
                  <th scope="col">Dátum</th>
                  <th scope="col">Gyanú</th>
                  <th scope="col">Forrás</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.id}>
                    <th scope="row">{r.personName}</th>
                    <td>{r.position}</td>
                    <td>
                      <span
                        className={
                          isStillDetained(r.verdictType)
                            ? 'seo-status seo-status-in'
                            : 'seo-status seo-status-out'
                        }
                      >
                        {isStillDetained(r.verdictType) ? 'Előzetesben' : 'Szabadlábon'}
                      </span>
                    </td>
                    <td>{huDate(r.verdictDate.toISOString().slice(0, 10))}</td>
                    <td>{r.crimes.length > 0 ? r.crimes.join(', ') : '—'}</td>
                    <td>
                      {r.sourceUrl ? (
                        <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer">
                          {r.sourceName ?? 'Forrás'} →
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {block.note && <p className="seo-table-note">{block.note}</p>}
    </div>
  );
}

function Block({ block, detentions }: { block: SubpageBlock; detentions: CaseDetentionRow[] }) {
  switch (block.type) {
    case 'text':
      return (
        <div className="ugy-block-text" id={block.id}>
          {block.heading && <h2 className="ugy-block-heading">{block.heading}</h2>}
          <p>{withLinks(block.content, block.links)}</p>
        </div>
      );
    case 'callout':
      return (
        <aside className="seo-callout">
          <h3 className="seo-callout-heading">{block.heading}</h3>
          <p>{block.content}</p>
        </aside>
      );
    case 'steps':
      return (
        <div className="ugy-block-text" id={block.id}>
          <h2 className="ugy-block-heading">{block.heading}</h2>
          {block.intro && <p>{block.intro}</p>}
          <ol className="seo-steps">
            {block.items.map((it, i) => (
              <li key={i} className="seo-step">
                <h3 className="seo-step-title">{it.title}</h3>
                <p className="seo-step-body">{it.body}</p>
              </li>
            ))}
          </ol>
        </div>
      );
    case 'checklist':
      return (
        <div className="ugy-block-text" id={block.id}>
          <h2 className="ugy-block-heading">{block.heading}</h2>
          {block.intro && <p>{block.intro}</p>}
          <ul className="seo-checklist">
            {block.items.map((it, i) => (
              <li key={i} className="seo-check">
                <span className="seo-check-mark" aria-hidden="true">⚠</span>
                <div>
                  <h3 className="seo-check-title">{it.title}</h3>
                  <p className="seo-check-body">{it.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      );
    case 'table':
      return (
        <div className="ugy-block-text" id={block.id}>
          <h2 className="ugy-block-heading">{block.heading}</h2>
          {block.intro && <p>{block.intro}</p>}
          <div className="seo-table-wrap">
            <table className="seo-table">
              <thead>
                <tr>{block.columns.map((c) => <th key={c} scope="col">{c}</th>)}</tr>
              </thead>
              <tbody>
                {block.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      j === 0
                        ? <th key={j} scope="row">{tableCell(cell)}</th>
                        : <td key={j}>{tableCell(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {block.note && <p className="seo-table-note">{block.note}</p>}
        </div>
      );
    case 'detention-table':
      return <DetentionTable block={block} rows={detentions} />;
    case 'image':
      // A fekvő ábrák 400px-en olvashatatlanra zsugorodnak, ezért ahol van
      // álló változat, ott a böngésző azt tölti le (és CSAK azt — a <picture>
      // nem tölt le mindkettőt).
      return (
        <figure className="seo-figure">
          <picture>
            {block.srcMobile && <source media="(max-width: 640px)" srcSet={block.srcMobile} />}
            <img src={block.src} alt={block.alt} loading="lazy" className="seo-figure-img" />
          </picture>
          {block.caption && <figcaption className="seo-figure-caption">{block.caption}</figcaption>}
        </figure>
      );
    case 'article-card':
      return (
        <a href={block.url} target="_blank" rel="noopener noreferrer" className="ugy-block-article-card">
          <div className="ugy-block-article-meta">
            <span className="ugy-block-article-source">{block.source}</span>
            {block.date && <span className="ugy-block-article-date">{block.date}</span>}
          </div>
          <div className="ugy-block-article-headline">{block.headline}</div>
          <p className="ugy-block-article-lead">{block.lead}</p>
          <span className="ugy-block-article-arrow">Cikk olvasása →</span>
        </a>
      );
    case 'video':
      return (
        <div className="ugy-block-video">
          <div className="ugy-block-video-meta">
            {block.label && <span className="ugy-block-video-label">{block.label}</span>}
            <span className="ugy-block-video-title">{block.title}</span>
          </div>
          {block.summary && <p className="ugy-block-video-summary">{block.summary}</p>}
          <div className="ugy-block-video-wrap">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${block.id}`}
              title={block.title}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      );
  }
}

export default async function UgySubPage({ params }: { params: Promise<{ id: string; topic: string }> }) {
  const { id, topic } = await params;
  const sub = getSubpage(id, topic);
  if (!sub) notFound();
  const parent = UGYEK.find((u) => u.id === sub.parentId);
  if (!parent) notFound();

  const url = `${SITE}/ugyek/${sub.parentId}/${sub.id}`;
  const toc = tocItems(sub);

  // A letartóztatás-táblázat élő adata. Egyetlen lekérdezés akkor is, ha
  // több ilyen blokk lenne; ha nincs ilyen blokk, nincs DB-hívás sem.
  const detentionBlock = sub.blocks.find(
    (b): b is Extract<SubpageBlock, { type: 'detention-table' }> => b.type === 'detention-table',
  );
  const detentions = detentionBlock
    ? await loadCaseDetentions({ ugyId: detentionBlock.ugyId, acronym: detentionBlock.acronym })
    : [];

  // Strukturált adat. A DR-0 domainnek ez az egyik kevés eszköze, amivel a
  // találati listán a puszta rangsoron felül is helyet foglalhat (GYIK-
  // kinyitható találat, morzsamenü a cím alatt).
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${url}#article`,
        headline: sub.seoTitle,
        description: sub.seoDescription,
        inLanguage: 'hu-HU',
        datePublished: sub.publishedAt,
        dateModified: sub.updatedAt,
        mainEntityOfPage: url,
        image: sub.blocks.find((b) => b.type === 'image')
          ? `${SITE}${(sub.blocks.find((b) => b.type === 'image') as Extract<SubpageBlock, { type: 'image' }>).src}`
          : undefined,
        author: { '@type': 'Organization', name: 'Kegyencjárat', url: SITE },
        publisher: { '@type': 'Organization', name: 'Kegyencjárat', url: SITE },
        isPartOf: { '@type': 'WebPage', '@id': `${SITE}/ugyek/${sub.parentId}` },
        citation: sub.sources.map((s) => ({ '@type': 'CreativeWork', name: s.label, url: s.url })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Kezdőlap', item: SITE },
          { '@type': 'ListItem', position: 2, name: 'Kiemelt ügyek', item: `${SITE}/ugyek` },
          { '@type': 'ListItem', position: 3, name: parent.title, item: `${SITE}/ugyek/${sub.parentId}` },
          { '@type': 'ListItem', position: 4, name: sub.h1, item: url },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: sub.faq.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  };

  return (
    <div className="person-page ugy-page seo-subpage">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="person-hero">
        <div className="person-hero-inner">
          {sub.heroImage && (
            <div className="person-hero-photo">
              <img src={sub.heroImage.src} alt={sub.heroImage.alt} className="person-photo-img" />
              {sub.heroImage.credit && <div className="photo-credit">{sub.heroImage.credit}</div>}
            </div>
          )}
          <div className="person-hero-text">
            <nav className="seo-breadcrumb" aria-label="Morzsamenü">
              <Link href="/">Kezdőlap</Link>
              <span aria-hidden="true">/</span>
              <Link href="/ugyek">Kiemelt ügyek</Link>
              <span aria-hidden="true">/</span>
              <Link href={`/ugyek/${sub.parentId}`}>{parent.title}</Link>
            </nav>
            <div className="person-hero-eyebrow">{sub.eyebrow}</div>
            <h1 className="person-hero-name">{sub.h1}</h1>
            <p className="person-hero-desc">{sub.lead}</p>
            <div className="seo-updated">Frissítve: {huDate(sub.updatedAt)}</div>
          </div>
        </div>
      </div>

      <div className="person-body">
        {toc.length > 0 && (
          <nav className="seo-toc" aria-label="Tartalomjegyzék">
            <div className="seo-toc-label">Ezen az oldalon</div>
            <ol>
              {toc.map((t) => (
                <li key={t.id}><a href={`#${t.id}`}>{t.label}</a></li>
              ))}
            </ol>
          </nav>
        )}

        <div className="ugy-description">
          <p className="person-section-note">
            Nyilvános hatósági közlemények, az NKA saját tájékoztatói és sajtóértesülések alapján.
            Jogerős ítélet hiányában minden érintett ártatlannak tekintendő.
          </p>
          <div className="ugy-description-body">
            {sub.blocks.map((b, i) => <Block key={i} block={b} detentions={detentions} />)}
          </div>

          {sub.faq.length > 0 && (
            <div className="seo-faq" id="gyik">
              <h2 className="person-section-title">Gyakran ismételt kérdések</h2>
              {sub.faq.map((f, i) => (
                <details key={i} className="seo-faq-item" open={i === 0}>
                  <summary className="seo-faq-q"><h3>{f.q}</h3></summary>
                  <p className="seo-faq-a">{f.a}</p>
                </details>
              ))}
            </div>
          )}

          <div className="ugy-sources">
            <p className="ugy-sources-disclaimer">
              Ez az összefoglaló az alábbi nyilvános források tartalmaiból készült — nem saját szerkesztőségi tartalom.
            </p>
            <div className="ugy-sources-label">Források</div>
            <ul className="ugy-sources-list">
              {sub.sources.map((s, i) => (
                <li key={i}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">{s.label} →</a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="seo-internal-links">
          <h2 className="person-section-title">Hogyan tovább az oldalon</h2>
          <div className="seo-internal-grid">
            {sub.internalLinks.map((l) => (
              <Link key={l.href} href={l.href} className="seo-internal-card">
                <span className="seo-internal-title">{l.label}</span>
                <span className="seo-internal-note">{l.note}</span>
                <span className="seo-internal-cta">Megnézem →</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="person-more-section">
        <div className="person-more-inner">
          <div className="person-more-label">Többi kiemelt ügy</div>
          <div className="ugyek-more-grid">
            {UGYEK.filter((e) => e.id !== parent.id).map((e) => (
              <Link key={e.id} href={`/ugyek/${e.id}`} className="ugyek-more-card">
                <div className="ugyek-more-eyebrow">{(e.eyebrow.split('·')[0] ?? '').trim()}</div>
                <div className="ugyek-more-title">{e.title}</div>
                {e.responsible && <div className="ugyek-more-sub">{e.responsible}</div>}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className="cross-promo-below-more">
        <div className="cross-promo-below-more-inner">
          <CrossLemondosok />
          <CrossGaleria />
          <CrossMegszunt />
          <CrossFelszolitottak />
        </div>
      </div>
    </div>
  );
}
