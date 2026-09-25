import { describe, it, expect } from 'vitest';
import { liveFeltarok } from '@app/_home/rendszervaltas-config';
import {
  DICSOSEGFAL_GRAMMAR,
  DICSOSEGFAL_KICKER,
  DICSOSEGFAL_TEMPLATE_COUNT,
  buildDicsosegfalCopy,
  nextDicsosegfalProfile,
} from './social-dicsosegfal';
import { breakingCaption } from './social-caption';
import { checkPostGate } from './social-post-policy';

const live = liveFeltarok();

function captionFor(profileIdx: number, postIndex: number) {
  const copy = buildDicsosegfalCopy(live[profileIdx]!, postIndex)!;
  return {
    copy,
    caption: breakingCaption(DICSOSEGFAL_KICKER, copy.headline, copy.whatHappened, copy.linkPath, copy.cta, copy.whyItMatters, copy.bullets),
  };
}

describe('Dicsőségfal-poszt (2026-09-25)', () => {
  it('minden élő profilnak van kézzel megadott ragozása — új profilnál ide kell sor', () => {
    expect(live.length).toBeGreaterThan(0);
    for (const f of live) expect(DICSOSEGFAL_GRAMMAR[f.id], f.id).toBeDefined();
  });

  it('SORBAN megy végig, a végén elölről kezdi', () => {
    expect(nextDicsosegfalProfile(live, null)?.id).toBe(live[0]!.id);
    expect(nextDicsosegfalProfile(live, live[0]!.id)?.id).toBe(live[1]!.id);
    expect(nextDicsosegfalProfile(live, live[live.length - 1]!.id)?.id).toBe(live[0]!.id);
    expect(nextDicsosegfalProfile(live, 'mar-nem-elo')?.id).toBe(live[0]!.id);
  });

  it('minden profil × minden sablon átmegy a kapun, és felszólító CTA-val zárul', () => {
    for (let p = 0; p < live.length; p++) {
      for (let t = 0; t < DICSOSEGFAL_TEMPLATE_COUNT; t++) {
        const { copy, caption } = captionFor(p, t);
        const gate = checkPostGate({ triggerType: 'dicsosegfal_highlight', headline: copy.headline, caption, imageText: copy.imageText });
        expect(gate, `${live[p]!.id} / ${t}: ${caption}`).toEqual({ ok: true });
        expect(copy.cta).toMatch(/^👉 .+!$/);
        // a CTA az utolsó szöveges sor a link és a hashtagek előtt
        const lines = caption.split('\n');
        expect(lines[lines.length - 3]).toBe(copy.cta);
      }
    }
  });

  it('két egymást követő poszt sose ugyanazzal a megfogalmazással megy ki', () => {
    const hooks = Array.from({ length: live.length * 3 }, (_, i) =>
      buildDicsosegfalCopy(live[i % live.length]!, i)!.headline.replace(live[i % live.length]!.name, 'X'),
    );
    for (let i = 1; i < hooks.length; i++) expect(hooks[i]).not.toBe(hooks[i - 1]);
  });

  it('a user két példája pontosan így jön ki', () => {
    const had = live.find((f) => f.id === 'hadhazy-akos')!;
    const mol = live.find((f) => f.id === 'molnar-aron')!;
    expect(buildDicsosegfalCopy(had, 0)!.headline).toBe('Mit köszönhetünk Hadházy Ákosnak?');
    expect(buildDicsosegfalCopy(mol, 1)!.headline).toBe('Molnár Áron szerepe a rendszerváltásban — nézd meg, mit tett hozzá!');
    expect(buildDicsosegfalCopy(live.find((f) => f.id === 'atlatszo')!, 2)!.headline).toBe('Miért került fel az Átlátszó a Dicsőségfalra?');
  });
});
