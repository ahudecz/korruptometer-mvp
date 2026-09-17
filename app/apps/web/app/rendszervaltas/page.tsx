import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

import {
  FELTAROK,
  GROUP_META,
  RENDSZERVALTAS_FAQ,
  RENDSZERVALTAS_HUB,
  type Feltaro,
  type FeltaroGroup,
  type InlineLink,
} from '../_home/rendszervaltas-config';
import { CrossLemondosok, CrossMegszunt, CrossGaleria, CrossFelszolitottak } from '../_home/cross-promo';
import { FeltaroVideo } from '../_home/feltaro-video';
import { findPersonLink } from '../_home/person-links';
import styles from './dicsosegfal.module.css';

// Statikus tartalom, DB-hívás nélkül — nincs mit revalidálni óránként.
// A napi újragenerálás bőven elég ahhoz, hogy egy config-módosítás
// (új név a Dicsőségfalon) kimenjen, és a Googlebot mindig kész HTML-t kapjon.
export const revalidate = 86400;

const SITE = 'https://www.kegyencjarat.hu';
const URL = `${SITE}/rendszervaltas`;

const HU_MONTHS_LONG = [
  'január', 'február', 'március', 'április', 'május', 'június',
  'július', 'augusztus', 'szeptember', 'október', 'november', 'december',
];

function huDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${y}. ${HU_MONTHS_LONG[m - 1]} ${d}.`;
}

function initials(name: string): string {
  return name
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((w) => w[0]!)
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/** Ugyanaz a szó szerinti, regex nélküli linkelő, mint az ügy-aloldalaknál:
 *  ha a `links[].text` nem szerepel a bekezdésben, csak link nem lesz belőle,
 *  a szöveg attól még hibátlanul megjelenik. */
function withLinks(
  content: string,
  links?: InlineLink[],
  linkedPersons?: Set<string>,
): React.ReactNode {
  let parts: React.ReactNode[] = [content];
  (links ?? []).forEach((link, li) => {
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

  // Automatikus névlinkelés a MARADÉK szövegdarabokon — l. person-links.ts.
  // A kézi `links` így sosem sérül, és linkbe ágyazott link sem keletkezik.
  if (linkedPersons) {
    const next: React.ReactNode[] = [];
    for (const part of parts) {
      if (typeof part !== 'string') {
        next.push(part);
        continue;
      }
      let rest = part;
      let guard = 0;
      // A `guard` nem esztétika: ha egy minta valaha üres stringre
      // illeszkedne, ez a ciklus végtelen lenne, és egy statikus oldal
      // renderelése fagyna meg.
      while (guard < 12) {
        const hit = findPersonLink(rest, linkedPersons);
        if (!hit) break;
        linkedPersons.add(hit.name);
        next.push(hit.before);
        next.push(
          <Link key={`p-${hit.href}-${guard}`} href={hit.href}>
            {hit.matched}
          </Link>,
        );
        rest = hit.after;
        guard += 1;
      }
      next.push(rest);
    }
    parts = next;
  }

  return parts.map((p, i) => <React.Fragment key={i}>{p}</React.Fragment>);
}

/** A gridIntro bekezdéseiben a `**...**` félkövér lesz. Szándékosan ennyi:
 *  nem markdown-motor, csak ez az egy jelölés — a három blokk nevét kell
 *  kiemelni a bevezetőben. */
function withBold(text: string): React.ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((chunk, i) =>
    chunk.startsWith('**') && chunk.endsWith('**') ? (
      <strong key={i}>{chunk.slice(2, -2)}</strong>
    ) : (
      <React.Fragment key={i}>{chunk}</React.Fragment>
    ),
  );
}

export const metadata: Metadata = {
  title: { absolute: `${RENDSZERVALTAS_HUB.seoTitle} — Kegyencjárat` },
  description: RENDSZERVALTAS_HUB.seoDescription,
  alternates: { canonical: URL },
  openGraph: {
    type: 'article',
    url: URL,
    title: RENDSZERVALTAS_HUB.seoTitle,
    description: RENDSZERVALTAS_HUB.seoDescription,
  },
};

/** A három blokk megjelenési sorrendje (user kérés, 2026-09-16). */
const GROUP_ORDER: FeltaroGroup[] = ['person', 'media', 'channel'];

function inGroup(g: FeltaroGroup): Feltaro[] {
  return FELTAROK.filter((f) => f.group === g);
}

/** Egy profildoboz. Élő aloldal nélkül szándékosan NEM link: 15 db 404-re
 *  mutató kártya rosszabb, mint 15 db türelmes kártya — és a Google is
 *  bünteti a tömeges belső törött linket. */
function FeltaroCard({ f }: { f: Feltaro }) {
  const inner = (
    <>
      <div className={styles.photo}>
        {f.photo ? (
          <img
            src={f.photo}
            alt={`${f.name} — ${f.role}`}
            className={f.photoFit === 'contain' ? `${styles.photoImg} ${styles.photoImgContain}` : styles.photoImg}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className={styles.placeholder} aria-hidden="true">
            {initials(f.name)}
          </div>
        )}
        <div className={styles.badge}>{f.badge}</div>
        {f.photoCredit && <div className={styles.credit}>{f.photoCredit}</div>}
      </div>
      <div className={styles.info}>
        <div className={styles.name}>{f.name}</div>
        <div className={styles.role}>{f.role}</div>
        <div className={styles.tagline}>{f.tagline}</div>
        {f.live ? (
          <div className={styles.cta}>Mit tárt fel? →</div>
        ) : (
          <div className={styles.ctaSoon}>Részletes profil hamarosan</div>
        )}
      </div>
    </>
  );

  if (!f.live) {
    return <div className={styles.card}>{inner}</div>;
  }
  return (
    <Link href={`/rendszervaltas/${f.id}`} className={styles.card}>
      {inner}
    </Link>
  );
}

export default function RendszervaltasPage() {
  const hub = RENDSZERVALTAS_HUB;

  // Egy Set az EGÉSZ oldalra: minden személynév csak az első előfordulásánál
  // lesz link, hogy tíz Mészáros-link helyett egy legyen — l. person-links.ts.
  const linkedPersons = new Set<string>();

  // A tartalomjegyzék a HÁROM BLOKKRA mutat, nem mind a harminc-egynéhány
  // névre — egy ekkora lista már nem navigáció, hanem fal. A neveken belül a
  // blokk-fejlécekből lehet tovább görgetni.
  const toc = [
    { id: 'dicsosegfal', label: 'A Dicsőségfal' },
    ...GROUP_ORDER.map((g) => ({
      id: GROUP_META[g].anchor,
      label: `${GROUP_META[g].title} (${inGroup(g).length})`,
    })),
    { id: 'gyik', label: 'Gyakran ismételt kérdések' },
  ];

  // Strukturált adat. A DR-0 domainnek ez az egyik kevés eszköze, amivel a
  // találati listán a puszta rangsoron felül is helyet foglalhat — az
  // ItemList ráadásul pont a „ki tárta fel" típusú kérdésekre illeszkedik.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${URL}#article`,
        headline: hub.seoTitle,
        description: hub.seoDescription,
        inLanguage: 'hu-HU',
        datePublished: hub.publishedAt,
        dateModified: hub.updatedAt,
        mainEntityOfPage: URL,
        author: { '@type': 'Organization', name: 'Kegyencjárat', url: SITE },
        publisher: { '@type': 'Organization', name: 'Kegyencjárat', url: SITE },
      },
      {
        '@type': 'ItemList',
        name: hub.h1,
        numberOfItems: FELTAROK.length,
        itemListElement: FELTAROK.map((f, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': f.kind === 'person' ? 'Person' : 'Organization',
            name: f.name,
            description: f.tagline,
            ...(f.live ? { url: `${URL}/${f.id}` } : {}),
          },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Kezdőlap', item: SITE },
          { '@type': 'ListItem', position: 2, name: hub.h1, item: URL },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: RENDSZERVALTAS_FAQ.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  };

  return (
    <div className="person-page ugy-page seo-subpage dicsosegfal-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="person-hero">
        <div className={`person-hero-inner ${styles.heroNoPhoto}`}>
          <div className="person-hero-text">
            <nav className="seo-breadcrumb" aria-label="Morzsamenü">
              <Link href="/">Kezdőlap</Link>
              <span aria-hidden="true">/</span>
              <span>{hub.h1}</span>
            </nav>
            <div className="person-hero-eyebrow">{hub.eyebrow}</div>
            <h1 className="person-hero-name">{hub.h1}</h1>
            <p className="person-hero-desc">{hub.lead}</p>
            <div className="seo-updated">Frissítve: {huDate(hub.updatedAt)}</div>
          </div>
        </div>
      </div>

      <div className="person-body">
        <nav className="seo-toc" aria-label="Tartalomjegyzék">
          <div className="seo-toc-label">Ezen az oldalon</div>
          <ol>
            {toc.map((t) => (
              <li key={t.id}><a href={`#${t.id}`}>{t.label}</a></li>
            ))}
          </ol>
        </nav>

        <div className="ugy-description">
          <div className="ugy-description-body">
            <div className="ugy-block-text" id="dicsosegfal">
              <h2 className="ugy-block-heading">A Dicsőségfal</h2>
              {hub.gridIntro.map((para, i) => (
                <p key={i}>{withBold(para)}</p>
              ))}
              <p>
                {hub.mainstreamNote.before}
                {hub.mainstreamNote.outlets.map((o, i, arr) => (
                  <React.Fragment key={o.url}>
                    {i > 0 && (i === arr.length - 1 ? ' és a ' : ', a ')}
                    <a href={o.url} target="_blank" rel="noopener noreferrer">
                      {o.name}
                    </a>
                  </React.Fragment>
                ))}
                {hub.mainstreamNote.after}
              </p>
              <p>{hub.mainstreamNote.tail}</p>
            </div>

            <FeltaroVideo
              videoId={hub.heroVideo.id}
              title={hub.heroVideo.title}
              label={hub.heroVideo.label}
              summary={hub.heroVideo.summary}
              variant="wide"
            />

            {GROUP_ORDER.map((g) => {
              const meta = GROUP_META[g];
              const members = inGroup(g);
              if (members.length === 0) return null;
              return (
                <div className={styles.groupBlock} id={meta.anchor} key={g}>
                  <div className={styles.groupHead}>
                    <h3 className={styles.groupTitle}>{meta.title}</h3>
                    <span className={styles.groupCount}>{members.length} név</span>
                  </div>
                  <p className={styles.groupIntro}>{meta.intro}</p>
                  <div className={styles.grid}>
                    {members.map((f) => (
                      <FeltaroCard key={f.id} f={f} />
                    ))}
                  </div>
                </div>
              );
            })}

            <div className={styles.gridNoteWrap}>
              <p className={styles.gridNote}>
                A lista nyitott, és bővül. Ha szerinted valaki hiányzik róla, a{' '}
                <Link href="/bejelentes">bejelentő űrlapon</Link> lehet javaslatot küldeni.
              </p>
            </div>

            <aside className="seo-callout">
              <h3 className="seo-callout-heading">Miért nem egyetlen név szerepel itt?</h3>
              <p>
                Mert a feltárás láncmunka volt. Egy tipikus ügy útja: valaki benyújtott egy
                közérdekűadat-igénylést, azt elutasították, ezért perelt; az így kiadott
                iratból egy oknyomozó szerkesztőség riportot írt; egy videós műhely
                érthetővé tette; egy képviselő feljelentést tett belőle; egy civil
                adatbázis pedig megőrizte, hogy évekkel később is elő lehessen venni.
                A láncból bármelyik szem hiányzott volna, az ügy megállt volna.
              </p>
            </aside>

            {GROUP_ORDER.map((g) => (
              <React.Fragment key={`sec-${g}`}>
                <h2 className={styles.sectionGroupHeading}>{GROUP_META[g].title}</h2>
                {inGroup(g).map((f) => (
                  <div className="ugy-block-text" id={f.id} key={f.id}>
                    <div className={styles.sectionKicker}>{f.badge}</div>
                    <h3 className="ugy-block-heading">{f.section.heading}</h3>
                    {f.section.paragraphs.map((para, i) => (
                      <p key={i}>{withLinks(para, f.section.links, linkedPersons)}</p>
                    ))}
                    {f.section.video && (
                      <FeltaroVideo
                        videoId={f.section.video.id}
                        title={f.section.video.title}
                        label={f.section.video.label}
                        summary={f.section.video.summary}
                        playlistId={f.section.video.list}
                        note={f.section.video.note}
                        variant="wide"
                      />
                    )}
                    {f.related && f.related.length > 0 && (
                      <p>
                        <strong>Kapcsolódó az oldalon: </strong>
                        {f.related.map((r, i) => (
                          <React.Fragment key={r.href}>
                            {i > 0 && ' · '}
                            <Link href={r.href}>{r.label}</Link>
                          </React.Fragment>
                        ))}
                      </p>
                    )}
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>

          <div className="seo-faq" id="gyik">
            <h2 className="person-section-title">Gyakran ismételt kérdések</h2>
            {RENDSZERVALTAS_FAQ.map((f, i) => (
              <details key={i} className="seo-faq-item" open={i === 0}>
                <summary className="seo-faq-q"><h3>{f.q}</h3></summary>
                <p className="seo-faq-a">{f.a}</p>
              </details>
            ))}
          </div>
        </div>

        <div className="seo-internal-links">
          <h2 className="person-section-title">Hogyan tovább az oldalon</h2>
          <div className="seo-internal-grid">
            <Link href="/galeria" className="seo-internal-card">
              <span className="seo-internal-title">Galéria</span>
              <span className="seo-internal-note">
                Ennek az oldalnak a tükörképe: a NER tíz kiemelt kegyencének arcképcsarnoka.
              </span>
              <span className="seo-internal-cta">Megnézem →</span>
            </Link>
            <Link href="/ugyek" className="seo-internal-card">
              <span className="seo-internal-title">Kiemelt ügyek</span>
              <span className="seo-internal-note">
                A legnagyobb ügyek részletes feldolgozása, szereplőkkel és összegekkel.
              </span>
              <span className="seo-internal-cta">Megnézem →</span>
            </Link>
            <Link href="/adatbazis" className="seo-internal-card">
              <span className="seo-internal-title">Adatbázis</span>
              <span className="seo-internal-note">
                Az összes rögzített ügy kereshető nyilvántartása, forrásokkal.
              </span>
              <span className="seo-internal-cta">Megnézem →</span>
            </Link>
            <Link href="/podcastok" className="seo-internal-card">
              <span className="seo-internal-title">Videóriportok és podcastok</span>
              <span className="seo-internal-note">
                A Dicsőségfalon szereplő műhelyek friss anyagai egy helyen.
              </span>
              <span className="seo-internal-cta">Megnézem →</span>
            </Link>
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
