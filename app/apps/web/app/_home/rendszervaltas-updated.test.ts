import { describe, expect, it } from 'vitest';

import { FELTAROK, RENDSZERVALTAS_HUB, contentUpdatedAt, getFeltaro } from './rendszervaltas-config';

/**
 * A „Frissítve" dátum SZERZŐDÉSE.
 *
 * 2026-09-24, user: a Dicsőségfalon és minden profiloldalon hónapokig a hub
 * egyetlen, kézzel írt dátuma állt (2026. szeptember 16.), miközben a tartalom
 * közben többször változott. A dátum azóta abból jön, hogy mikor frissült
 * ténylegesen a tartalom — a hubon a legfrissebb aloldal dátuma is beleszámít.
 *
 * Ez a teszt azért van, hogy ez a viselkedés ne csússzon vissza egy kézzel
 * írt konstansra, és hogy a fallback-ág is dokumentálva legyen.
 */
describe('contentUpdatedAt', () => {
  it('a hubon a legfrissebb dátumot adja a hub és az összes profil közül', () => {
    const latestProfile = FELTAROK.map((f) => f.updatedAt).filter(Boolean).sort().at(-1);
    const expected = [RENDSZERVALTAS_HUB.updatedAt, latestProfile].filter(Boolean).sort().at(-1);
    expect(contentUpdatedAt()).toBe(expected);
  });

  it('a hub dátuma sosem régebbi, mint a legfrissebb profilé', () => {
    for (const f of FELTAROK) {
      if (f.updatedAt) expect(contentUpdatedAt() >= f.updatedAt).toBe(true);
    }
  });

  it('egy profil a SAJÁT dátumát adja, ha van neki', () => {
    const pottyondy = getFeltaro('pottyondy-edina');
    expect(pottyondy?.updatedAt).toBeTruthy();
    expect(contentUpdatedAt(pottyondy)).toBe(pottyondy!.updatedAt);
  });

  it('dátum nélküli profil a hub dátumára esik vissza', () => {
    const without = FELTAROK.find((f) => !f.updatedAt);
    // Ha egyszer MINDEN profil kap saját dátumot, ez az ág kiürül — akkor sem
    // hibázhat a teszt, csak nincs mit ellenőrizni.
    if (!without) return;
    expect(contentUpdatedAt(without)).toBe(RENDSZERVALTAS_HUB.updatedAt);
  });
});
