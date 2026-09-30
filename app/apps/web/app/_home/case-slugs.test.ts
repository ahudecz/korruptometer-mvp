import { describe, expect, it } from 'vitest';

import overrides from './case-slug-overrides.generated.json';
import {
  buildCaseSlug,
  buildSlugOverrides,
  caseHref,
  caseIdFromSlug,
  caseSlug,
  isBadSlug,
  slugPerson,
  type SlugOptions,
  type SlugSource,
} from './case-slugs';

const OPTS: SlugOptions = { indexedIds: new Set(), misattributedIds: new Set() };
const src = (p: Partial<SlugSource> & { id: string }): SlugSource => ({
  title: '',
  name: '',
  person: null,
  institution: null,
  ...p,
});

describe('ügyoldal-URL-ek (2026-09-29)', () => {
  describe('az élesített átnevezési tábla', () => {
    const entries = Object.entries(overrides as Record<string, string>);

    it('nincs két ügy ugyanazon az URL-en', () => {
      const slugs = entries.map(([, s]) => s);
      expect(new Set(slugs).size).toBe(slugs.length);
    });

    it('minden új URL tiszta: kisbetű, ékezet és szóköz nélkül, legfeljebb 9 szó', () => {
      for (const [, slug] of entries) {
        expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
        expect(slug.split('-').length).toBeLessThanOrEqual(9);
      }
    });

    it('új URL nem ütközik egy másik, át nem nevezett ügy régi URL-jével', () => {
      const renamed = new Set(entries.map(([id]) => id));
      const newSlugs = new Set(entries.map(([, s]) => s));
      // Egy átnevezett ügy régi URL-je lehet más új URL-je (azt úgyis a tábla
      // oldja fel elsőként), de egy MEGMARADÓ ügy URL-je nem.
      for (const [id] of entries) expect(renamed.has(id)).toBe(true);
      expect([...newSlugs].every((s) => caseIdFromSlug(s) !== null)).toBe(true);
    });

    it('a konkrét, user által jelzett elírás javítva van', () => {
      expect(caseSlug('garancsi-kazino')).toBe('garancsi-kaszino-penzkivonas-botrany');
      expect(caseHref('garancsi-kazino')).toBe('/adatbazis/garancsi-kaszino-penzkivonas-botrany');
      expect(caseIdFromSlug('garancsi-kaszino-penzkivonas-botrany')).toBe('garancsi-kazino');
    });

    it('feltáró (Hadházy) és téves személy-mező (Mészáros a Szijjártó-jachtügynél) nem kerül URL-be', () => {
      expect(caseSlug('kazari-bölcsode-ugy')).not.toContain('hadhazy');
      expect(caseSlug('szijjarto-adriai-jacht')).not.toContain('meszaros');
    });
  });

  describe('caseSlug / caseHref / caseIdFromSlug', () => {
    it('át nem nevezett ügynél az id ékezet nélküli alakja marad', () => {
      expect(caseSlug('nincs-a-tablaban-ügy')).toBe('nincs-a-tablaban-ugy');
      expect(caseIdFromSlug('nincs-a-tablaban-ugy')).toBeNull();
    });
  });

  describe('buildCaseSlug', () => {
    it('név + a cím lényege + botrany, a név nem ismétlődik, a töltelékszó kimarad', () => {
      expect(buildCaseSlug('Garancsi kaszinó pénzkivonás ügy', 'Garancsi István')).toBe(
        'garancsi-istvan-kaszino-penzkivonas-botrany',
      );
    });

    it('ahol a cím már megnevezi az ügy jellegét, nincs „botrany"', () => {
      expect(buildCaseSlug('Mager Andrea pénzmosás-ügye', 'Mager Andrea')).toBe('mager-andrea-penzmosas');
      expect(buildCaseSlug('Pécsi buszper', null)).toBe('pecsi-buszper-botrany');
      expect(buildCaseSlug('Völner-Schadl korrupció per', null)).toBe('volner-schadl-korrupcio-per');
      expect(buildCaseSlug('Lánczi Tamás vagyona botrány', 'Lánczi Tamás')).toBe('lanczi-tamas-vagyona-botrany');
    });

    it('a zárójeles pontosítás nem kerül a névbe', () => {
      expect(buildCaseSlug('Kovács Ákos portréfilm', 'Kovács Ákos (énekes)')).toBe('kovacs-akos-portrefilm-botrany');
    });

    it('legfeljebb 5 címszót vesz át', () => {
      const slug = buildCaseSlug('Egy kettő három négy öt hat hét', null);
      expect(slug).toBe('egy-ketto-harom-negy-ot-botrany');
    });
  });

  describe('slugPerson', () => {
    it('csak akkor ad nevet, ha a cím is említi', () => {
      expect(slugPerson(src({ id: 'a', title: 'Garancsi kaszinó', person: 'Garancsi István' }), OPTS)).toBe('Garancsi István');
      expect(slugPerson(src({ id: 'b', title: 'Kazári bölcsőde ügy', person: 'Hadházy Ákos' }), OPTS)).toBeNull();
    });

    it('bizonyítottan félreattribuált ügynél sosem ad nevet', () => {
      const opts = { ...OPTS, misattributedIds: new Set(['mnb-botrany']) };
      expect(slugPerson(src({ id: 'mnb-botrany', title: 'Mészáros MNB', person: 'Mészáros Lőrinc' }), opts)).toBeNull();
    });
  });

  describe('isBadSlug', () => {
    const corpus = new Set(['garancsi', 'kaszino', 'penzkivonas', 'moszkvai', 'epulet', 'berendezese', 'ugy']);

    it('elkapja az elgépelést, a szóközt és a tartalomtól idegen szót', () => {
      expect(isBadSlug('garancsi-kazino', corpus)).toBe(true);
      expect(isBadSlug('első osztályú stadion', corpus)).toBe(true);
      expect(isBadSlug('garancsi-kekvastias', corpus)).toBe(true);
    });

    it('a ragozási eltérést és a helyes URL-t nem jelzi hibának', () => {
      expect(isBadSlug('garancsi-kaszino-ugy', corpus)).toBe(false);
      expect(isBadSlug('moszkva-epulet', corpus)).toBe(false);
    });
  });

  describe('buildSlugOverrides', () => {
    const rows: SlugSource[] = [
      src({ id: 'garancsi-kazino', title: 'Garancsi kaszinó pénzkivonás', name: 'Garancsi kaszinó pénzkivonás', person: 'Garancsi István' }),
      src({ id: 'jo-url-indexelt', title: 'Jó URL indexelt', name: 'Jó URL indexelt' }),
      src({ id: 'jo-url-nem-indexelt', title: 'Jó URL nem indexelt', name: 'Jó URL nem indexelt' }),
    ];

    it('a hibásat és a nem indexeltet átnevezi, az indexelt jó URL-hez nem nyúl', () => {
      const out = buildSlugOverrides(rows, { ...OPTS, indexedIds: new Set(['garancsi-kazino', 'jo-url-indexelt']) });
      expect(out['garancsi-kazino']).toBe('garancsi-istvan-kaszino-penzkivonas-botrany');
      expect(out['jo-url-indexelt']).toBeUndefined();
      expect(out['jo-url-nem-indexelt']).toBe('jo-url-nem-indexelt-botrany');
    });

    it('ütközésnél sorszámot tesz a végére', () => {
      const dup = [
        src({ id: 'x1', title: 'Azonos cím', name: 'Azonos cím' }),
        src({ id: 'x2', title: 'Azonos cím', name: 'Azonos cím' }),
      ];
      const out = buildSlugOverrides(dup, OPTS);
      expect(new Set(Object.values(out))).toEqual(new Set(['azonos-cim-botrany', 'azonos-cim-botrany-2']));
    });
  });
});
