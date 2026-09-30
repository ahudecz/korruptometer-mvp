import { describe, expect, it } from 'vitest';

import { facebookEmbedUrl, facebookPostEmbedUrl, isFacebookPostUrl, isFacebookVideoUrl } from './facebook-reel';

// A 2026-09-15-i kézi teszt alanya (Molnár Áron reelje) — ezen mértük, hogy
// a plugin-lejátszó bejelentkezés nélkül betöltődik és játszik.
const REEL = 'https://www.facebook.com/reel/1636605694843824';

describe('isFacebookVideoUrl', () => {
  it('elfogadja a reel-permalinket záró perjellel és anélkül', () => {
    expect(isFacebookVideoUrl(REEL)).toBe(true);
    expect(isFacebookVideoUrl(`${REEL}/`)).toBe(true);
  });

  it('elfogadja a /watch és a /videos/ alakot is', () => {
    expect(isFacebookVideoUrl('https://www.facebook.com/watch/?v=1636605694843824')).toBe(true);
    expect(isFacebookVideoUrl('https://www.facebook.com/watch?v=1636605694843824')).toBe(true);
    expect(isFacebookVideoUrl('https://www.facebook.com/atlatszo/videos/123456789')).toBe(true);
  });

  it('elutasítja a szöveges posztot — arra nincs lejátszó, üres iframe lenne', () => {
    expect(isFacebookVideoUrl('https://www.facebook.com/atlatszo/posts/123456789')).toBe(false);
    expect(isFacebookVideoUrl('https://www.facebook.com/permalink.php?story_fbid=1&id=2')).toBe(false);
    expect(isFacebookVideoUrl('https://www.facebook.com/watch/')).toBe(false);
  });

  it('elutasítja az idegen hostot és a nem http(s) sémát', () => {
    expect(isFacebookVideoUrl('https://facebook.com.evil.example/reel/1')).toBe(false);
    expect(isFacebookVideoUrl('https://www.youtube.com/watch?v=abc')).toBe(false);
    expect(isFacebookVideoUrl('javascript:alert(1)')).toBe(false);
    expect(isFacebookVideoUrl('')).toBe(false);
    // @ts-expect-error — futásidőben is jöhet nem-string a DB-ből
    expect(isFacebookVideoUrl(null)).toBe(false);
  });
});

describe('facebookEmbedUrl', () => {
  it('a plugin-URL-t adja, URL-kódolt href-fel', () => {
    const embed = facebookEmbedUrl(REEL)!;
    expect(embed.startsWith('https://www.facebook.com/plugins/video.php?')).toBe(true);
    const href = new URL(embed).searchParams.get('href');
    expect(href).toBe(REEL);
    expect(new URL(embed).searchParams.get('show_text')).toBe('false');
  });

  it('a mobil/web aldomaint a kanonikus www-re húzza (CSP-engedélyezett origin)', () => {
    const href = new URL(facebookEmbedUrl('https://m.facebook.com/reel/1636605694843824')!)
      .searchParams.get('href')!;
    expect(new URL(href).hostname).toBe('www.facebook.com');
  });

  it('nem videós URL-re null', () => {
    expect(facebookEmbedUrl('https://www.facebook.com/atlatszo/posts/1')).toBeNull();
    expect(facebookEmbedUrl('nem-url')).toBeNull();
  });
});

describe('facebook post embed', () => {
  const POST = 'https://www.facebook.com/majkahivatalos/posts/pfbid02zXyJaPQWamjLnGaPSWXkixxT4YzqYfjaXs52DCj8UWznAJnHoKhregUX3L8fkEEdl';

  it('recognises a /<page>/posts/<id> permalink', () => {
    expect(isFacebookPostUrl(POST)).toBe(true);
    expect(isFacebookPostUrl('https://m.facebook.com/majkahivatalos/posts/123/')).toBe(true);
  });

  it('recognises permalink.php with story_fbid and id', () => {
    expect(isFacebookPostUrl('https://www.facebook.com/permalink.php?story_fbid=1&id=2')).toBe(true);
    expect(isFacebookPostUrl('https://www.facebook.com/permalink.php?story_fbid=1')).toBe(false);
  });

  it('rejects videos, reels and foreign hosts', () => {
    expect(isFacebookPostUrl('https://www.facebook.com/reel/123')).toBe(false);
    expect(isFacebookPostUrl('https://www.facebook.com/page/videos/123')).toBe(false);
    expect(isFacebookPostUrl('https://evil.example/majkahivatalos/posts/1')).toBe(false);
    expect(isFacebookPostUrl('not a url')).toBe(false);
  });

  it('builds a www post.php URL with the post as encoded href', () => {
    const embed = facebookPostEmbedUrl(POST.replace('www.', 'm.'))!;
    const u = new URL(embed);
    expect(u.origin + u.pathname).toBe('https://www.facebook.com/plugins/post.php');
    expect(u.searchParams.get('href')).toBe(POST);
    expect(u.searchParams.get('show_text')).toBe('true');
    expect(facebookPostEmbedUrl('https://www.facebook.com/reel/1')).toBeNull();
  });
});
