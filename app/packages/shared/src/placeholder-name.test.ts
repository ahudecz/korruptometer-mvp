import { describe, it, expect } from 'vitest';
import { isPlaceholderName } from './placeholder-name';

describe('isPlaceholderName', () => {
  it('felismeri az LLM helykitöltőit', () => {
    for (const v of ['<UNKNOWN>', 'UNKNOWN', 'unknown', 'Ismeretlen', ' n/a ', 'null', 'undefined', '']) {
      expect(isPlaceholderName(v), v).toBe(true);
    }
  });

  it('a hiányzó értéket is helykitöltőnek veszi', () => {
    // A megjelenítés-oldali védőháló (ComplaintList.tsx) nullable mezőre is
    // ráfut, ezért nem dobhat, hanem true-t kell adnia.
    expect(isPlaceholderName(null)).toBe(true);
    expect(isPlaceholderName(undefined)).toBe(true);
  });

  it('a valódi neveket békén hagyja', () => {
    for (const v of [
      'Volánbusz, Volán Buszpark, Kormányzati Ellenőrzési Hivatal',
      'Hadházy Ákos',
      'Transparency International',
    ]) {
      expect(isPlaceholderName(v), v).toBe(false);
    }
  });
});
