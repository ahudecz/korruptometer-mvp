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

  // 2026-10-13: a „Visszafizetések" / „Megtakarítás" grafikon sorai nem feljelentések.
  it('ignores refund and saving rows (data-vlabel) below the complaint table', () => {
    const html = `${FIXTURE}
      <h3 class="r-h">Visszafizetések</h3>
      <div class="row" data-vlabel="visszafizetve: " data-n="Duna Aszfalt: Zambia–Kongó közötti útépítés (EXIM Bank)" data-m="Gazdasági és Energetikai Minisztérium" data-v="211" data-unit="millió" data-d="" data-s="211 M Ft visszafizetve" data-x=""></div>
      <h3 class="r-h">Megtakarítás, meg nem valósult kiadás</h3>
      <div class="row" data-vlabel="meg nem valósult kiadás: " data-n="Rothschild tanácsadói szerződés" data-m="Pénzügyminisztérium" data-v="220" data-unit="millió" data-d="" data-s="kb. 220 M Ft elengedett fizetési igény" data-x=""></div>`;
    const page = parseKormanyHuFeljelentesPageWithMeta(html);
    expect(page.items).toHaveLength(5);
    expect(page.items.some((r) => r.name.startsWith('Rothschild') || r.amountLabel === '211 millió Ft')).toBe(false);
    expect(page.skipped).toHaveLength(1);
  });

  it('reads the declared total from the page header', () => {
    expect(parseKormanyHuFeljelentesPageWithMeta(FIXTURE).declaredTotal).toBe(37);
  });

  it('returns null declaredTotal when the header sentence is missing', () => {
    expect(parseKormanyHuFeljelentesPageWithMeta('<html><body></body></html>').declaredTotal).toBeNull();
  });
});
