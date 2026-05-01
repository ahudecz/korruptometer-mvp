import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseRss } from './rss';
import { EXCERPT_MAX } from './parse';
import { atlatszo } from './atlatszo';
import { hvg } from './hvg';
import { magyarHang } from './magyar-hang';
import { negyNegyNegy } from './444';
import { telex } from './telex';

const FIXTURES = join(__dirname, '..', '__fixtures__');

const cases = [
  { adapter: telex, fixture: 'telex.xml' },
  { adapter: negyNegyNegy, fixture: '444.xml' },
  { adapter: hvg, fixture: 'hvg.xml' },
  { adapter: magyarHang, fixture: 'magyar-hang.xml' },
  { adapter: atlatszo, fixture: 'atlatszo.xml' },
];

describe('outlet adapters fixture extraction', () => {
  for (const c of cases) {
    it(`${c.adapter.slug}: parses RSS items into ScrapedArticle[]`, async () => {
      const xml = await readFile(join(FIXTURES, c.fixture), 'utf-8');
      const articles = parseRss(xml);
      expect(articles.length).toBeGreaterThan(5);
      for (const a of articles) {
        expect(a.headline.length).toBeGreaterThan(0);
        expect(a.headline).not.toMatch(/<\w/);
        expect(a.excerpt.length).toBeLessThanOrEqual(EXCERPT_MAX);
        expect(a.excerpt).not.toMatch(/<\w/);
        expect(a.sourceUrl).toMatch(/^https?:\/\/[^ ]+/);
        expect(a.publishedAt).toBeInstanceOf(Date);
        expect(Number.isFinite(a.publishedAt.getTime())).toBe(true);
      }
    });
  }
});
