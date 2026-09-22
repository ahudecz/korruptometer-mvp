import React from 'react';
import Link from 'next/link';

import { findPersonLink } from './person-links';

/**
 * KÖZÖS SZÖVEG-LINKELŐ.
 *
 * Eddig ez a függvény két példányban élt (a Dicsőségfal hubján és a
 * profiloldalakon), szóról szóra ugyanúgy. Amikor 2026-09-22-én az ügyoldalak
 * is megkapták az automatikus névlinkelést, a harmadik másolat helyett ide
 * került — egy helyen javítható, és minden lap ugyanazt a viselkedést kapja.
 *
 * Két rétegben dolgozik, ebben a sorrendben:
 *
 *  1. KÉZI linkek (`links`): szó szerinti egyezés a bekezdésben. Ezek előbbre
 *     valók, mert egy configban kézzel megadott hivatkozás mindig pontosabb,
 *     mint a névlista.
 *  2. AUTOMATIKUS névlinkelés a maradék szövegdarabokon — l. person-links.ts.
 *     Így kézi linken belül sosem keletkezik újabb link (egymásba ágyazott
 *     <a> érvénytelen HTML).
 *
 * A `linkedPersons` Set az EGÉSZ oldalt végigkíséri: egy név csak az első
 * előfordulásánál lesz link. Tíz Mészáros-link egy oldalon nem SEO, hanem spam.
 */
export type InlineLinkSpec = { text: string; href: string; external?: boolean };

export function withAutoLinks(
  content: string,
  links?: InlineLinkSpec[],
  linkedPersons?: Set<string>,
  /** A renderelt oldal saját útvonala — önmagára egyetlen lap sem linkel. */
  skipHref?: string,
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
        const hit = findPersonLink(rest, linkedPersons, skipHref);
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
