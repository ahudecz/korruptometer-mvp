import React, { Fragment } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  FELTAROK,
  GROUP_META,
  RENDSZERVALTAS_HUB,
  getFeltaro,
  contentUpdatedAt,
  type Feltaro,
  type FeltaroCase as FeltaroCaseType,
  type FeltaroLink,
  type InlineLink,
} from '../../_home/rendszervaltas-config';
import { CrossLemondosok, CrossMegszunt, CrossGaleria, CrossFelszolitottak } from '../../_home/cross-promo';
import { FeltaroVideo } from '../../_home/feltaro-video';
import { withAutoLinks } from '../../_home/auto-link-text';
import { PodcastVideoBox } from '../../_home/podcast-video-box';
import styles from '../dicsosegfal.module.css';

// Statikus tartalom, DB-hívás nélkül. Napi újragenerálás bőven elég ahhoz,
// hogy egy config-módosítás kimenjen, és a Googlebot mindig kész HTML-t kapjon.
export const revalidate = 86400;

const SITE = 'https://www.kegyencjarat.hu';

// A kanonikus URL SZÁNDÉKOSAN pontos név-egyezés: /rendszervaltas/hadhazy-akos,
// /rendszervaltas/marki-zay-peter. A szegmens maga a keresett kifejezés
// ékezet nélküli, kötőjeles alakja — semmilyen toldalék („-profil”, „-ugyei”)
// nem kerül bele, mert az rontja a találati egyezést.
function urlFor(id: string): string {
  return `${SITE}/rendszervaltas/${id}`;
}

const HU_MONTHS_LONG = [
  'január', 'február', 'március', 'április', 'május', 'június',
  'július', 'augusztus', 'szeptember', 'október', 'november', 'december',
];

function huDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${y}. ${HU_MONTHS_LONG[m - 1]} ${d}.`;
}

/**
 * Olvashatóság: egy bekezdés se legyen ~90 szónál hosszabb (user, 2026-09-16
 * — „100 szavanként legyen sortörés vagy kevesebb"). Mondathatáron vág, így
 * sosem szakít félbe gondolatot. A renderelőben van, nem a configban, hogy
 * MINDEN végoldalra és minden szövegmezőre egyszerre vonatkozzon.
 */
const MAX_WORDS = 90;

function splitParas(text: string): string[] {
  const words = text.split(/\s+/).length;
  if (words <= MAX_WORDS) return [text];
  // Mondatvégek: pont/kérdőjel/felkiáltójel után szóköz és nagybetű.
  const sentences = text.split(/(?<=[.!?…])\s+(?=[A-ZÁÉÍÓÖŐÚÜŰ„])/);
  const out: string[] = [];
  let buf: string[] = [];
  let n = 0;
  for (const s of sentences) {
    const w = s.split(/\s+/).length;
    if (n > 0 && n + w > MAX_WORDS) {
      out.push(buf.join(' '));
      buf = [];
      n = 0;
    }
    buf.push(s);
    n += w;
  }
  if (buf.length > 0) out.push(buf.join(' '));
  return out;
}

/** „Hatvanpuszta — a mezőgazdasági létesítmény…" → rövid cím + a többi.
 *  Mobilon a szám mellett CSAK a rövid cím áll, a folytatás új sorban,
 *  teljes szélességben (user, 2026-09-16). */
function splitTitle(title: string): [string, string | null] {
  const m = title.match(/^(.*?)\s+[—–]\s+(.*)$/);
  return m ? [m[1]!, m[2]!] : [title, null];
}

function initials(name: string): string {
  return name.split(/[\s-]+/).filter(Boolean).map((w) => w[0]!).join('').slice(0, 2).toUpperCase();
}


/**
 * SZÁNDÉKOSAN ÜRES — ezek az oldalak nem a buildben készülnek el, hanem az
 * első kérésre, és onnantól ISR-ből (l. `revalidate` fentebb).
 *
 * 2026-09-17, mért ok: három egymást követő deploy hasalt el azon, hogy
 * ezeknek a lapoknak a statikus generálása túllépte a Next 60 másodperces
 * per-oldal limitjét — „Failed to build /rendszervaltas/[slug]/page:
 * /rendszervaltas/juhasz-peter (attempt 3 of 3)". A build Clevelandben fut,
 * az adatbázis Európában van, tehát minden lekérdezés ~150 ms oda-vissza; a
 * lap alján négy cross-promo blokk kérdez, és ezek a lapok a site
 * leghosszabb HTML-jei (~400 kB). Négy mag, hat lap egyszerre — ez nem fért
 * bele. Ugyanez a build EURÓPAI gépen, az éles adatbázissal, nulla
 * időtúllépéssel átmegy: nem a kód lassú, hanem a földrajz.
 *
 * Futásidőben a lap a frankfurti régióban generálódik, az adatbázis mellett,
 * és a kérés-limit 300 másodperc — ott ez a munka bőven belefér. Az első
 * kérés után az eredmény cache-elve van, a Googlebot is kész HTML-t kap.
 * A sitemap továbbra is felsorolja őket (l. sitemap.ts).
 *
 * Ha ez valaha visszakerül a buildbe, a cross-promo blokkokat kell előbb
 * kivenni ezekről a lapokról — nem a limitet kell kerülgetni.
 */
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const f = getFeltaro(slug);
  if (!f || !f.live) return {};
  const title = f.detail?.seoTitle ?? `${f.name} — mit tárt fel?`;
  const description =
    f.detail?.seoDescription ??
    `${f.name} (${f.role}) a Kegyencjárat Dicsőségfalán. ${f.tagline}`.slice(0, 300);
  return {
    title: { absolute: `${title} — Kegyencjárat` },
    description,
    alternates: { canonical: urlFor(f.id) },
    openGraph: { type: 'profile', url: urlFor(f.id), title, description },
  };
}

/**
 * Hivatkozott cikkek. Két bevált formát használ a site-ról (user, 2026-09-16):
 *  - lead NÉLKÜL: „Kapcsolódó hírek"-sor (person-news-item) — FORRÁS · DÁTUM · CÍM
 *  - lead-del: keretes article-card (ugy-block-article-card), a végén
 *    „Cikk olvasása →" — ez a „keretes” forma az ügyoldalakról.
 * Saját (kegyencjarat.hu) hivatkozásnál nem nyitunk új ablakot.
 */
function Sources({ sources, label }: { sources: FeltaroLink[]; label?: string }) {
  const rows = sources.filter((s) => !s.lead);
  const cards = sources.filter((s) => s.lead);
  return (
    <>
      {cards.map((c) => (
        <a
          key={c.url}
          href={c.url}
          target="_blank"
          rel="noopener noreferrer"
          className="ugy-block-article-card"
        >
          {c.image && (
            <figure className={styles.cardFigure}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.image.src} alt={c.image.alt} loading="lazy" className={styles.cardFigureImg} />
              <figcaption className={styles.caseFigureCaption}>
                {c.image.caption ? `${c.image.caption} ` : ''}
                <span className={styles.caseFigureCredit}>Fotó: {c.image.credit}</span>
              </figcaption>
            </figure>
          )}
          <div className="ugy-block-article-meta">
            <span className="ugy-block-article-source">{c.source}</span>
            {c.date && <span className="ugy-block-article-date">{c.date}</span>}
          </div>
          <div className="ugy-block-article-headline">{c.headline}</div>
          <p className="ugy-block-article-lead">{c.lead}</p>
          <span className="ugy-block-article-arrow">Cikk olvasása →</span>
        </a>
      ))}
      {rows.length > 0 && (
        <div className="feltaro-news">
          {label && <div className="feltaro-news-label">{label}</div>}
          <div className="person-news-list">
            {rows.map((r) => (
              <a
                key={r.url}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="person-news-item"
              >
                <span className="person-news-source">{r.source}</span>
                <span className="person-news-date">{r.date ?? ''}</span>
                <span className="person-news-headline">{r.headline}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/** Az ügy-ajánló keretes doboza. Külön komponens, mert két helyen jelenhet
 *  meg: alapból az ügy végén, `promoPlacement: 'top'` esetén az első
 *  bekezdés után (l. FeltaroCase.promoPlacement). */
function CasePromo({ promo }: { promo: NonNullable<FeltaroCaseType['promo']> }) {
  return (
    <Link href={promo.href} className="ugy-subpage-promo">
      <span className="ugy-subpage-promo-eyebrow">{promo.eyebrow}</span>
      <span className="ugy-subpage-promo-title">{promo.title}</span>
      <span className="ugy-subpage-promo-lead">{promo.lead}</span>
      <span className="ugy-subpage-promo-cta">{promo.cta} →</span>
    </Link>
  );
}

export default async function FeltaroPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const f: Feltaro | undefined = getFeltaro(slug);
  if (!f || !f.live) notFound();

  const d = f.detail;
  const group = GROUP_META[f.group];
  const url = urlFor(f.id);

  // Egy Set az EGÉSZ oldalra: minden személynév csak az első előfordulásánál
  // lesz link, hogy tíz Mészáros-link helyett egy legyen — l. person-links.ts.
  const linkedPersons = new Set<string>();

  // Önmagára egyetlen profil sem linkel: a Hadházy-oldalon a „Hadházy Ákos”
  // név nem lehet link erre az oldalra.
  const selfHref = `/rendszervaltas/${f.id}`;

  // Testvérek ugyanabból a blokkból — a hub & spoke másik iránya: az
  // aloldalak ne csak a hubra mutassanak vissza, hanem egymásra is.
  const siblings = FELTAROK.filter((x) => x.group === f.group && x.id !== f.id && x.live).slice(0, 6);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': f.kind === 'person' ? 'Person' : 'Organization',
        '@id': `${url}#subject`,
        name: f.name,
        description: f.tagline,
        jobTitle: f.kind === 'person' ? f.role : undefined,
        url,
      },
      {
        '@type': 'Article',
        '@id': `${url}#article`,
        headline: d?.seoTitle ?? `${f.name} — mit tárt fel?`,
        description: d?.seoDescription ?? f.tagline,
        inLanguage: 'hu-HU',
        datePublished: RENDSZERVALTAS_HUB.publishedAt,
        dateModified: RENDSZERVALTAS_HUB.updatedAt,
        mainEntityOfPage: url,
        about: { '@id': `${url}#subject` },
        author: { '@type': 'Organization', name: 'Kegyencjárat', url: SITE },
        publisher: { '@type': 'Organization', name: 'Kegyencjárat', url: SITE },
        isPartOf: { '@type': 'WebPage', '@id': `${SITE}/rendszervaltas` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Kezdőlap', item: SITE },
          { '@type': 'ListItem', position: 2, name: RENDSZERVALTAS_HUB.h1, item: `${SITE}/rendszervaltas` },
          { '@type': 'ListItem', position: 3, name: f.name, item: url },
        ],
      },
      ...(d?.faq && d.faq.length > 0
        ? [{
            '@type': 'FAQPage',
            mainEntity: d.faq.map((q) => ({
              '@type': 'Question',
              name: q.q,
              acceptedAnswer: { '@type': 'Answer', text: q.a },
            })),
          }]
        : []),
    ],
  };

  return (
    <div className="person-page ugy-page seo-subpage dicsosegfal-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="person-hero">
        <div className="person-hero-inner">
          <div className="person-hero-photo">
            {f.photo ? (
              <img
                src={f.photo}
                alt={`${f.name} — ${f.role}`}
                className={
                  f.photoFit === 'contain' ? 'person-photo-img person-photo-img--contain' : 'person-photo-img'
                }
              />
            ) : (
              <div className={styles.heroPlaceholder} aria-hidden="true">{initials(f.name)}</div>
            )}
            {f.photoCredit && <div className="photo-credit">{f.photoCredit}</div>}
          </div>
          <div className="person-hero-text">
            <nav className="seo-breadcrumb" aria-label="Morzsamenü">
              <Link href="/">Kezdőlap</Link>
              <span aria-hidden="true">/</span>
              <Link href="/rendszervaltas">Rendszerváltás barátai</Link>
              <span aria-hidden="true">/</span>
              <span>{f.name}</span>
            </nav>
            <div className="person-hero-eyebrow">{group.title} · {f.badge}</div>
            <h1 className="person-hero-name">{f.name}</h1>
            <p className="person-hero-desc">{d?.lead ?? f.tagline}</p>
            <div className="seo-updated">Frissítve: {huDate(contentUpdatedAt(f))}</div>
          </div>
        </div>
      </div>

      <div className="person-body">
        <div className="ugy-description">
          <div className="ugy-description-body">
            <div className="ugy-block-text" id="ki-o">
              <h2 className="ugy-block-heading">
                {f.kind === 'person' ? `Ki ${f.name}?` : `Mi az a ${f.name}?`}
              </h2>
              {f.section.paragraphs
                .flatMap((para) => splitParas(para))
                .map((para, i) => (
                  <p key={i}>{withAutoLinks(para, f.section.links, linkedPersons, selfHref)}</p>
                ))}
            </div>

            {f.section.video && (
              <FeltaroVideo
                videoId={f.section.video.id}
                title={f.section.video.title}
                label={f.section.video.label}
                summary={f.section.video.summary}
                views={f.section.video.views}
                playlistId={f.section.video.list}
                note={f.section.video.note}
                vimeoId={f.section.video.vimeoId}
                poster={f.section.video.poster}
                variant="wide"
              />
            )}

            {d?.cases && d.cases.items.length > 0 && (
              <div className="ugy-block-text" id="ugyek">
                <h2 className="ugy-block-heading">{d.cases.heading}</h2>
                {d.cases.intro && <p>{withAutoLinks(d.cases.intro, undefined, linkedPersons, selfHref)}</p>}
                <ol className={styles.caseList}>
                  {d.cases.items.map((c, ci) => {
                    const [short, rest] = splitTitle(c.title);
                    return (
                    <li className={styles.caseItem} key={c.title}>
                      <h3 className={styles.caseTitle}>
                        <span className={styles.caseNum} aria-hidden="true">{ci + 1}</span>
                        <span className={styles.caseShort}>{short}</span>
                        {rest && <span className={styles.caseRest}>{rest}</span>}
                      </h3>
                      {c.when && <div className={styles.caseWhen}>{c.when}</div>}
                      {splitParas(c.body).map((para, i) => (
                        <Fragment key={`b${i}`}>
                          <p className={styles.caseBody}>{withAutoLinks(para, c.links, linkedPersons, selfHref)}</p>
                          {/* user, 2026-09-24: hosszú szakasznál az ügy-ajánló az ELSŐ
                              bekezdés után áll, ne a lap alján, ahova kevesen jutnak el. */}
                          {i === 0 && c.promoPlacement === 'top' && c.promo && <CasePromo promo={c.promo} />}
                        </Fragment>
                      ))}
                      {c.more?.flatMap((para) => splitParas(para)).map((para, i) => (
                        <p className={styles.caseBody} key={`m${i}`}>{withAutoLinks(para, c.links, linkedPersons, selfHref)}</p>
                      ))}
                      {c.sections?.map((sec) => (
                        <div className={styles.caseSection} key={sec.heading}>
                          <h4 className={styles.caseSectionHeading}>{sec.heading}</h4>
                          {sec.paragraphs
                            .flatMap((para) => splitParas(para))
                            .map((para, i) => (
                              <p className={styles.caseBody} key={i}>{withAutoLinks(para, sec.links, linkedPersons, selfHref)}</p>
                            ))}
                          {sec.videos?.map((v) => (
                            <FeltaroVideo
                              key={v.id}
                              videoId={v.id}
                              title={v.title}
                              label={v.label}
                              summary={v.summary}
                              views={v.views}
                              playlistId={v.list}
                              note={v.note}
                              vimeoId={v.vimeoId}
                              poster={v.poster}
                              variant="wide"
                            />
                          ))}
                          {sec.image && (
                            <figure className={styles.caseFigure}>
                              {/* eslint-disable-next-line @next/next/no-img-element -- saját, /public alól szolgált fotó, nem kell Next Image-optimalizálás */}
                              <img
                                src={sec.image.src}
                                alt={sec.image.alt}
                                className={styles.caseFigureImg}
                                loading="lazy"
                                decoding="async"
                              />
                              <figcaption className={styles.caseFigureCaption}>
                                {sec.image.caption ? `${sec.image.caption} ` : ''}
                                <span className={styles.caseFigureCredit}>Fotó: {sec.image.credit}</span>
                              </figcaption>
                            </figure>
                          )}
                          {sec.sources && sec.sources.length > 0 && <Sources sources={sec.sources} />}
                        </div>
                      ))}
                      {c.videos?.map((v) => (
                        <FeltaroVideo
                          key={v.id}
                          videoId={v.id}
                          title={v.title}
                          label={v.label}
                          summary={v.summary}
                          views={v.views}
                          playlistId={v.list}
                          note={v.note}
                          vimeoId={v.vimeoId}
                          poster={v.poster}
                          variant="wide"
                        />
                      ))}
                      {c.highlight && (
                        <>
                          <aside className={styles.caseHighlight}>
                            <h4 className={styles.caseHighlightHeading}>{c.highlight.heading}</h4>
                            {splitParas(c.highlight.body).map((para, i) => (
                              <p key={i}>{withAutoLinks(para, undefined, linkedPersons, selfHref)}</p>
                            ))}
                          </aside>
                          {/* A felvétel a kiemelt doboz UTÁN áll, nem benne
                              (user, 2026-09-16): a piros doboz a tényállásé,
                              a videó önálló bizonyíték. */}
                          {c.highlight.video && (
                            <FeltaroVideo
                              videoId={c.highlight.video.id}
                              title={c.highlight.video.title}
                              label={c.highlight.video.label}
                              summary={c.highlight.video.summary}
                              views={c.highlight.video.views}
                              playlistId={c.highlight.video.list}
                              note={c.highlight.video.note}
                              vimeoId={c.highlight.video.vimeoId}
                              poster={c.highlight.video.poster}
                              variant="wide"
                            />
                          )}
                          {c.highlight.sources && c.highlight.sources.length > 0 && (
                            <Sources sources={c.highlight.sources} label="Az esetről" />
                          )}
                        </>
                      )}
                      {c.sources && c.sources.length > 0 && <Sources sources={c.sources} />}
                      {c.promo && c.promoPlacement !== 'top' && <CasePromo promo={c.promo} />}
                    </li>
                    );
                  })}
                </ol>
              </div>
            )}

            {d?.extra?.map((x) => (
              <div className="ugy-block-text" key={x.heading}>
                <h2 className="ugy-block-heading">{x.heading}</h2>
                {x.paragraphs.map((para, pi) => (
                  <Fragment key={pi}>
                    {splitParas(para).map((sub, i) => (
                      <p key={i}>{withAutoLinks(sub, x.links, linkedPersons, selfHref)}</p>
                    ))}
                    {x.cardsAfterParagraph === pi && (
                      <Sources sources={(x.sources ?? []).filter((src) => src.lead)} />
                    )}
                  </Fragment>
                ))}
                {x.videos && x.videos.length > 0 && (
                  <div className={x.videos.length > 1 ? 'feltaro-video-pair' : undefined}>
                    {x.videos.map((v) => (
                      <FeltaroVideo
                        key={v.id}
                        videoId={v.id}
                        title={v.title}
                        label={v.label}
                        summary={v.summary}
                        views={v.views}
                        playlistId={v.list}
                        note={v.note}
                        vimeoId={v.vimeoId}
                        poster={v.poster}
                        variant={x.videos!.length > 1 ? undefined : 'wide'}
                      />
                    ))}
                  </div>
                )}
                {x.sources && x.sources.length > 0 && (
                  <Sources
                    sources={
                      x.cardsAfterParagraph === undefined ? x.sources : x.sources.filter((src) => !src.lead)
                    }
                  />
                )}
              </div>
            ))}

            {d?.videoBlock && d.videoBlock.items.length > 0 && (
              <div className="ugy-block-text" id="felvetelek">
                <h2 className="ugy-block-heading">{d.videoBlock.heading}</h2>
                {d.videoBlock.intro && <p>{withAutoLinks(d.videoBlock.intro, undefined, linkedPersons, selfHref)}</p>}
                <div className={d.videoBlock.items.length > 1 ? 'feltaro-video-pair' : undefined}>
                  {d.videoBlock.items.map((v) => (
                    <FeltaroVideo
                      key={v.id}
                      videoId={v.id}
                      title={v.title}
                      label={v.label}
                      summary={v.summary}
                      views={v.views}
                      playlistId={v.list}
                      note={v.note}
                      vimeoId={v.vimeoId}
                      poster={v.poster}
                      variant={d.videoBlock!.items.length > 1 ? undefined : 'wide'}
                    />
                  ))}
                </div>
              </div>
            )}

            {d?.table && d.table.rows.length > 0 && (
              <div className="ugy-block-text" id="osszehasonlitas">
                <h2 className="ugy-block-heading">{d.table.heading}</h2>
                {d.table.intro && <p>{withAutoLinks(d.table.intro, undefined, linkedPersons, selfHref)}</p>}
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        {d.table.columns.map((c) => <th key={c}>{c}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {d.table.rows.map((row) => (
                        <tr key={row[0]}>
                          {row.map((cell, ci) => (
                            <td key={ci}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {d.table.note && <p className={styles.tableNote}>{d.table.note}</p>}
              </div>
            )}

            {d?.socialHighlights && d.socialHighlights.items.length > 0 && (
              <div className="ugy-block-text" id="posztok">
                <h2 className="ugy-block-heading">{d.socialHighlights.heading}</h2>
                {d.socialHighlights.intro && <p>{withAutoLinks(d.socialHighlights.intro, undefined, linkedPersons, selfHref)}</p>}
                {d.socialHighlights.items.map((post) => (
                  <React.Fragment key={post.title}>
                    {/* A TELJES poszt-blokk kattintható (user, 2026-09-16), nem
                        csak a CTA. A mi kommentárunk és a források a kártyán
                        KÍVÜL maradnak: egymásba ágyazott <a> érvénytelen HTML,
                        és a forráslinkeknek külön kell működniük. */}
                    <a
                      className={styles.post}
                      href={post.href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className={styles.postHead}>
                        <span className={styles.postAvatar} aria-hidden="true">
                          {initials(d.socialHighlights!.pageName)}
                        </span>
                        <span className={styles.postWho}>
                          <span className={styles.postPage}>{d.socialHighlights!.pageName}</span>
                          <span className={styles.postSub}>
                            {post.when} · {d.socialHighlights!.platformLabel}
                          </span>
                        </span>
                      </span>
                      {post.quote && <span className={styles.postText}>{post.quote}</span>}
                      {post.image && (
                        <span className={styles.postImage}>
                          {/* eslint-disable-next-line @next/next/no-img-element -- letöltött, fix méretű poszt-kép */}
                          <img src={post.image} alt={post.imageAlt ?? post.title} loading="lazy" />
                        </span>
                      )}
                      <span className={styles.postCta}>{post.ctaLabel ?? 'Elolvasom a posztot'} →</span>
                    </a>
                    <div className={styles.postNote}>
                      <h3 className={styles.postNoteTitle}>{post.title}</h3>
                      {splitParas(post.body).map((para, i) => (
                        <p key={i}>{withAutoLinks(para, undefined, linkedPersons, selfHref)}</p>
                      ))}
                      {post.sources && post.sources.length > 0 && (
                        <Sources sources={post.sources} label="A posztról" />
                      )}
                    </div>
                    {post.promo && (
                      <Link href={post.promo.href} className="ugy-subpage-promo">
                        <span className="ugy-subpage-promo-eyebrow">{post.promo.eyebrow}</span>
                        <span className="ugy-subpage-promo-title">{post.promo.title}</span>
                        <span className="ugy-subpage-promo-lead">{post.promo.lead}</span>
                        <span className="ugy-subpage-promo-cta">{post.promo.cta} →</span>
                      </Link>
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}

            {d?.socialFeed && d.socialFeed.items.length > 0 && (
              <div className="ugy-block-text" id="feed">
                <h2 className="ugy-block-heading">{d.socialFeed.heading}</h2>
                {d.socialFeed.intro && <p>{withAutoLinks(d.socialFeed.intro, undefined, linkedPersons, selfHref)}</p>}
                <div className={styles.feed}>
                  {d.socialFeed.items.map((item) => (
                    <a
                      key={item.url}
                      className={styles.feedItem}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {item.image && (
                        <span className={styles.feedThumb}>
                          {/* eslint-disable-next-line @next/next/no-img-element -- letöltött poszt-kép */}
                          <img src={item.image} alt="" loading="lazy" />
                        </span>
                      )}
                      <span className={styles.feedBody}>
                        <span className={styles.feedText}>{item.text}</span>
                        <span className={styles.feedCta}>Teljes poszt →</span>
                      </span>
                    </a>
                  ))}
                </div>
                {d.socialFeed.profileUrl && (
                  <div className={styles.videoGridMore}>
                    <a
                      className={styles.videoGridBtn}
                      href={d.socialFeed.profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {d.socialFeed.pageName} a {d.socialFeed.platformLabel}on →
                    </a>
                  </div>
                )}
              </div>
            )}

            {d?.videoGrid && d.videoGrid.items.length > 0 && (
              <div className="ugy-block-text" id="adasok">
                <h2 className="ugy-block-heading">{d.videoGrid.heading}</h2>
                {d.videoGrid.intro && <p>{withAutoLinks(d.videoGrid.intro, undefined, linkedPersons, selfHref)}</p>}
                <div className={styles.videoGrid}>
                  {d.videoGrid.items.map((v) => (
                    <div className={styles.videoCard} key={v.id}>
                      {/* Helyben játszódik le, nem a YouTube-on nyílik meg
                          (user, 2026-09-16): a borítóra kattintva itt töltődik
                          be a lejátszó, így az olvasó az oldalon marad. */}
                      <PodcastVideoBox
                        videoId={v.id}
                        title={v.title}
                        wrapClassName={styles.videoThumb ?? ''}
                      />
                      {v.note && <span className={styles.videoNote}>{v.note}</span>}
                      <span className={styles.videoTitle}>{v.title}</span>
                    </div>
                  ))}
                </div>
                {d.videoGrid.channelUrl && (
                  <div className={styles.videoGridMore}>
                    <a
                      className={styles.videoGridBtn}
                      href={d.videoGrid.channelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {d.videoGrid.channelLabel ?? 'A csatorna'} →
                    </a>
                  </div>
                )}
              </div>
            )}

            {d?.video && (
              <FeltaroVideo
                videoId={d.video.id}
                title={d.video.title}
                label={d.video.label}
                summary={d.video.summary}
                views={d.video.views}
                playlistId={d.video.list}
                note={d.video.note}
                vimeoId={d.video.vimeoId}
                poster={d.video.poster}
                variant="wide"
              />
            )}

            {!d && (
              <aside className="seo-callout">
                <h3 className="seo-callout-heading">Ez az oldal még épül</h3>
                <p>
                  A részletes ügylista és a forrásjegyzék még készül. Ha tudsz olyan konkrét
                  ügyről vagy anyagról, aminek itt lenne a helye, a{' '}
                  <Link href="/bejelentes">bejelentő űrlapon</Link> tudsz szólni.
                </p>
              </aside>
            )}
          </div>

          {d?.faq && d.faq.length > 0 && (
            <div className="seo-faq" id="gyik">
              <h2 className="person-section-title">Gyakran ismételt kérdések</h2>
              {d.faq.map((q, i) => (
                <details key={i} className="seo-faq-item" open={i === 0}>
                  <summary className="seo-faq-q"><h3>{q.q}</h3></summary>
                  <p className="seo-faq-a">{withAutoLinks(q.a, undefined, linkedPersons, selfHref)}</p>
                </details>
              ))}
            </div>
          )}

          {d?.sources && d.sources.length > 0 && (
            <div className="feltaro-news-block">
              <h2 className="person-section-title">További források</h2>
              <Sources sources={d.sources} />
            </div>
          )}
        </div>

        <div className="seo-internal-links">
          <h2 className="person-section-title">Hogyan tovább az oldalon</h2>
          <div className="seo-internal-grid">
            <Link href="/rendszervaltas" className="seo-internal-card">
              <span className="seo-internal-title">Rendszerváltás barátai</span>
              <span className="seo-internal-note">
                A teljes Dicsőségfal — mind a {FELTAROK.length} név, három blokkban.
              </span>
              <span className="seo-internal-cta">Megnézem →</span>
            </Link>
            {(f.related ?? []).map((r) => (
              <Link key={r.href} href={r.href} className="seo-internal-card">
                <span className="seo-internal-title">{r.label}</span>
                <span className="seo-internal-note">Kapcsolódó tartalom az oldalon.</span>
                <span className="seo-internal-cta">Megnézem →</span>
              </Link>
            ))}
            <Link href="/adatbazis" className="seo-internal-card">
              <span className="seo-internal-title">Adatbázis</span>
              <span className="seo-internal-note">
                Az összes rögzített ügy kereshető nyilvántartása, forrásokkal.
              </span>
              <span className="seo-internal-cta">Megnézem →</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="person-more-section">
        <div className="person-more-inner">
          <div className="person-more-label">
            További {group.title.toLowerCase()} a Dicsőségfalon
          </div>
          <div className="ugyek-more-grid">
            {siblings.map((sb) => (
              <Link key={sb.id} href={`/rendszervaltas/${sb.id}`} className="ugyek-more-card">
                <div className="ugyek-more-eyebrow">{sb.badge}</div>
                <div className="ugyek-more-title">{sb.name}</div>
                <div className="ugyek-more-sub">{sb.role}</div>
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
