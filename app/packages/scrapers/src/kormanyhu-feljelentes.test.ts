import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseKormanyHuFeljelentesPage } from './kormanyhu-feljelentes';

const FIXTURE = readFileSync(join(__dirname, '..', '__fixtures__', 'kormanyhu-feljelentes.html'), 'utf8');

describe('parseKormanyHuFeljelentesPage', () => {
  it('parses all rows in the fixture', () => {
    const rows = parseKormanyHuFeljelentesPage(FIXTURE);
    expect(rows).toHaveLength(4);
  });

  it('parses a normal Mrd row with a real case-link', () => {
    const rows = parseKormanyHuFeljelentesPage(FIXTURE);
    const row = rows.find((r) => r.name.startsWith('Egyiptomi'));
    expect(row).toBeDefined();
    expect(row!.ministry).toBe('Gazdasági és Energetikai Minisztérium');
    expect(row!.amountFt).toBe(640_000_000_000n);
    expect(row!.amountLabel).toBe('640 milliárd Ft');
    expect(row!.filedDateIso).toBe('2026-07-23');
    expect(row!.sourceUrl).toContain('kormany.hu/hirek/');
  });

  it('parses a comma-decimal Mrd amount correctly', () => {
    const rows = parseKormanyHuFeljelentesPage(FIXTURE);
    const row = rows.find((r) => r.name.startsWith('Ortodox'));
    expect(row!.amountFt).toBe(38_229_000_000n);
    expect(row!.amountLabel).toBe('38,229 milliárd Ft');
  });

  it('parses a millió-unit amount correctly (not treated as Mrd)', () => {
    const rows = parseKormanyHuFeljelentesPage(FIXTURE);
    const row = rows.find((r) => r.name.startsWith('Kárpát'));
    expect(row!.amountFt).toBe(825_000_000n);
    expect(row!.amountLabel).toBe('825 millió Ft');
  });

  it('falls back to the átláthatósági oldal URL when there is no case-link href', () => {
    const rows = parseKormanyHuFeljelentesPage(FIXTURE);
    const row = rows.find((r) => r.name === 'M6 koncesszió');
    expect(row!.sourceUrl).toBe('https://kormany.hu/atlathato/feljelentes');
  });

  it('returns null filedDateIso for "nincs adat" style date text', () => {
    const rows = parseKormanyHuFeljelentesPage(FIXTURE);
    const row = rows.find((r) => r.name === 'M6 koncesszió');
    expect(row!.filedDateIso).toBeNull();
  });

  it('falls back to sourceUrl when a row has no <a> case-link element at all', () => {
    const rows = parseKormanyHuFeljelentesPage(FIXTURE);
    const row = rows.find((r) => r.name.startsWith('Kárpát'));
    expect(row!.sourceUrl).toBe('https://kormany.hu/atlathato/feljelentes');
  });
});
