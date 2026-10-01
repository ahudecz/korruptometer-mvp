import { describe, expect, it } from 'vitest';
import * as React from 'react';
import { createElement } from 'react';

// A vitest a komponensek JSX-ét klasszikus runtime-mal fordítja, ami a
// globális React-et keresi (a Next a saját fordításában automatikus runtime-ot használ).
(globalThis as { React?: typeof React }).React = React;
import { renderToStaticMarkup } from 'react-dom/server';

import { BreakingUpdateBox } from './breaking-update-box';
import { UGYEK } from './ugyek-config';
import { getSubpage } from './ugyek-subpages';

const ugy = (id: string) => UGYEK.find((u) => u.id === id)!;

describe('BreakingUpdateBox (2026-10-01: Hankó és Seszták letartóztatása)', () => {
  it('az NKA-ügyoldal breaking dobozában ott a cím, mindkét keretes hír és a videó (facade)', () => {
    const html = renderToStaticMarkup(createElement(BreakingUpdateBox, { update: ugy('nka-botrany').breakingUpdate! }));
    expect(html).toContain('BREAKING · 2026. október 1.');
    expect(html).toContain('Letartóztatták Hankó Balázst és volt államtitkárát, Varga-Bajusz Veronikát');
    expect(html.match(/ugy-block-article-card/g)).toHaveLength(2);
    expect(html).toContain('Kecskeméti Televízió · 2026. szept. 29.');
    // facade: borítókép + lejátszógomb, NEM azonnali iframe
    expect(html).toContain('i.ytimg.com/vi/IlOcx7LPvHQ/hqdefault.jpg');
    expect(html).not.toContain('<iframe');
  });

  it('a Volánbusz-ügyoldal breaking doboza Seszták letartóztatása, a régi 09-15-i hír lejjebb került', () => {
    const v = ugy('volanbusz-ugy');
    const html = renderToStaticMarkup(createElement(BreakingUpdateBox, { update: v.breakingUpdate! }));
    expect(html).toContain('Letartóztatták Seszták Miklós volt minisztert');
    expect(html).toContain('i.ytimg.com/vi/eyW5JiEtSVM/hqdefault.jpg');
    const first = v.descriptionBlocks?.[0];
    expect(first?.type === 'text' && first.heading).toBe('2026. szeptember 15. — Három embert őrizetbe vett az ügyészség');
    expect(v.descriptionBlocks?.filter((b) => b.type === 'article-card').length).toBeGreaterThanOrEqual(4);
  });

  it('az nka-letartoztatas aloldal első blokka ugyanez a breaking, a fejképe Hankóé', () => {
    const sub = getSubpage('nka-botrany', 'nka-letartoztatas')!;
    expect(sub.blocks[0]).toEqual({ type: 'breaking', update: ugy('nka-botrany').breakingUpdate });
    expect(sub.heroImage?.src).toBe('/images/persons/hanko-balazs.webp');
  });
});
