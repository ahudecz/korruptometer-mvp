import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { extractPersonnelDecisions, parseKozlonyFeed } from './magyar-kozlony';

const fixture = fs.readFileSync(path.join(__dirname, '__fixtures__', 'magyar-kozlony-2026-148.txt'), 'utf8');

describe('extractPersonnelDecisions — Magyar Közlöny 2026/148 (GVH, Bak László)', () => {
  const decisions = extractPersonnelDecisions(fixture);

  it('kiveszi a GVH-elnökhelyettes megbízatásának megszűnését, a teljes határozatszöveggel', () => {
    expect(decisions).toHaveLength(1);
    expect(decisions[0]!.ref).toBe('253/2026. (X. 8.) KE');
    expect(decisions[0]!.title).toContain('Gazdasági Versenyhivatal elnökhelyettese');
    expect(decisions[0]!.body).toContain('dr. Bak László');
    expect(decisions[0]!.body).toContain('lemondására való tekintettel');
  });

  it('a rutin bírói felmentést, a kinevezést és a rendfokozatot kihagyja', () => {
    const titles = decisions.map((d) => d.title).join(' | ');
    expect(titles).not.toMatch(/Bírák felmentéséről/);
    expect(titles).not.toMatch(/kinevezéséről|rendfokozat/);
  });
});

describe('parseKozlonyFeed', () => {
  const xml = `<rss><channel>
    <item><title><![CDATA[Magyar Közlöny 2026. évi 151. szám]]></title>
      <link>https://magyarkozlony.hu/dokumentumok/abc/megtekintes</link>
      <pubDate>Fri, 09 Oct 2026 18:30:13 +0200</pubDate>
      <enclosure url="https://magyarkozlony.hu/hivatalos-lapok/x/dokumentumok/abc/letoltes" length="1" type="application/pdf"></enclosure>
      <mag:year>2026</mag:year><mag:serial>151</mag:serial><mag:type>Magyar Közlöny</mag:type></item>
    <item><title><![CDATA[Hivatalos Értesítő 2026. évi 50. szám]]></title>
      <link>https://magyarkozlony.hu/dokumentumok/def/megtekintes</link>
      <pubDate>Fri, 09 Oct 2026 16:17:24 +0200</pubDate>
      <enclosure url="https://magyarkozlony.hu/hivatalos-lapok/y/dokumentumok/def/letoltes" length="1" type="application/pdf"></enclosure>
      <mag:year>2026</mag:year><mag:serial>50</mag:serial><mag:type>Hivatalos Értesítő</mag:type></item>
  </channel></rss>`;

  it('csak a Magyar Közlöny számait adja vissza, PDF- és nézet-URL-lel', () => {
    const issues = parseKozlonyFeed(xml);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ year: 2026, serial: 151, viewUrl: 'https://magyarkozlony.hu/dokumentumok/abc/megtekintes' });
    expect(issues[0]!.pdfUrl).toMatch(/letoltes$/);
    expect(issues[0]!.publishedAt.toISOString()).toBe('2026-10-09T16:30:13.000Z');
  });
});
