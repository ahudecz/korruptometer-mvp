import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseKormanyHuFeljelentesPage, parseKormanyHuFeljelentesPageWithMeta } from './kormanyhu-feljelentes';

const FIXTURE = readFileSync(join(__dirname, '..', '__fixtures__', 'kormanyhu-feljelentes.html'), 'utf8');

describe('parseKormanyHuFeljelentesPage', () => {
  it('parses all rows in the fixture', () => {
    const rows = parseKormanyHuFeljelentesPage(FIXTURE);
    expect(rows).toHaveLength(5);
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

  // 2026-09-30: az összeg nélküli sort (Kajak-Kenu Akadémia) eddig csendben eldobtuk.
  it('keeps a row without an amount, with null amount fields', () => {
    const rows = parseKormanyHuFeljelentesPage(FIXTURE);
    const row = rows.find((r) => r.name.startsWith('Kovács Katalin'));
    expect(row).toBeDefined();
    expect(row!.amountFt).toBeNull();
    expect(row!.amountLabel).toBeNull();
    expect(row!.ministry).toBe('Belügyminisztérium');
    expect(row!.filedDateIso).toBe('2026-09-18');
  });

  it('reports unparseable rows in skipped instead of dropping them silently', () => {
    const page = parseKormanyHuFeljelentesPageWithMeta(FIXTURE);
    expect(page.skipped).toEqual([{ name: 'Név nélküli minisztérium', reason: 'hiányzik a minisztérium' }]);
  });

  it('reads the declared total from the page header', () => {
    expect(parseKormanyHuFeljelentesPageWithMeta(FIXTURE).declaredTotal).toBe(37);
  });

  it('returns null declaredTotal when the header sentence is missing', () => {
    expect(parseKormanyHuFeljelentesPageWithMeta('<html><body></body></html>').declaredTotal).toBeNull();
  });
});
