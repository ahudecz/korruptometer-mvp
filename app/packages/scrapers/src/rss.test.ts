import { describe, expect, it } from 'vitest';

import { decodeEntities, parseRss } from './rss';

describe('decodeEntities', () => {
  it('decodes zero-padded numeric entities like &#039;', () => {
    expect(decodeEntities('A &#039;70-es évek')).toBe("A '70-es évek");
  });

  it('decodes unpadded numeric entities like &#39;', () => {
    expect(decodeEntities('A &#39;70-es évek')).toBe("A '70-es évek");
  });

  it('decodes hex entities', () => {
    expect(decodeEntities('A &#x27;70-es évek')).toBe("A '70-es évek");
  });

  it('decodes named entities', () => {
    expect(decodeEntities('Ez &amp; az &nbsp;is &quot;idézet&quot;')).toBe('Ez & az  is "idézet"');
  });

  it('leaves plain text untouched', () => {
    expect(decodeEntities('Semmi különös itt.')).toBe('Semmi különös itt.');
  });
});

describe('parseRss', () => {
  it('decodes entities in the title, not just the description', () => {
    const xml = `<?xml version="1.0"?>
      <rss><channel><item>
        <title>A &#039;70-es évek undergroundjába repített vissza</title>
        <link>https://example.com/article</link>
        <description>Egy leírás &amp; egy másik rész.</description>
        <pubDate>Mon, 07 Jul 2026 12:00:00 GMT</pubDate>
      </item></channel></rss>`;
    const [article] = parseRss(xml);
    expect(article?.headline).toBe("A '70-es évek undergroundjába repített vissza");
    expect(article?.excerpt).toBe('Egy leírás & egy másik rész.');
  });
});
