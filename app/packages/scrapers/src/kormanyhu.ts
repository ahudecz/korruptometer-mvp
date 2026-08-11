import { httpGet } from './http';
import type { OutletAdapter, ScrapedArticle } from './types';

/**
 * kormany.hu — a Kormányzat hivatalos hírportálja. Nincs RSS/sitemap
 * (2026-08-11-én ellenőrizve: /rss, /feed, /sitemap.xml mind 404), és a
 * /hirek listaoldal statikus HTML-je NEM tartalmaz cikk-linkeket — az
 * Angular-app kliensoldalon hidratálja a tartalmat egy `/publicapi`
 * végpontból, amit a robots.txt kifejezetten tilt (`Disallow: /publicapi`,
 * ellenőrizve 2026-08-11-én) — ugyanaz az elv, mint a YouTube-nál
 * (l. youtube-podcast-sync.ts fejléce): a robots.txt tiltását nem kerüljük
 * meg egy alternatív úttal.
 *
 * A megoldás: a /hirek oldal (ami maga NINCS tiltva) szerveroldalon
 * renderelt HTML-je egy Angular Universal state-transfer JSON blob-ot
 * tartalmaz (`<script id="ng-state" type="application/json">`) — pontosan
 * ugyanaz az adat, amit az app a hidratáláshoz használna, csak simán a
 * kiszolgált oldalba ágyazva, NEM a tiltott API-n keresztül lekérve. Ez a
 * blob egyedileg azonosítható a benne lévő tömb elem-alakja alapján
 * (slug+name+date+ministry+seoMeta kulcsok együtt — 2026-08-11-én
 * ellenőrizve, pontosan 1 ilyen tömb van a state-ben, "type":"article",
 * "orderBy":{"publicationDate":"desc"} szűrővel, 12 elem/oldal).
 */
export const kormanyhu: OutletAdapter = {
  slug: 'kormanyhu',
  homepage: 'https://kormany.hu',
  queryAllowlist: [],
  async crawl(_limit?: number): Promise<ScrapedArticle[]> {
    const html = await httpGet('https://kormany.hu/hirek');
    return parseKormanyHirek(html);
  },
};

export default kormanyhu;

type KormanyHirItem = {
  name: string;
  slug: string;
  date: string; // 'YYYY-MM-DD'
  description: string | null;
  ministry: unknown;
  seoMeta?: { imageUrl?: string | null } | null;
  images?: { dskImage?: { path?: string | null } | null } | null;
};

/**
 * Kicsomagolja az `<script id="ng-state" type="application/json">` blobot,
 * és megkeresi benne a hír-tömböt egy strukturális ujjlenyomat alapján
 * (nem egy konkrét, build-enként változó kulcsnév alapján — az Angular
 * TransferState opak hash-kulcsokat generál, amik minden deploy-nál
 * mások lehetnek).
 */
export function parseKormanyHirek(html: string): ScrapedArticle[] {
  const marker = '<script id="ng-state" type="application/json">';
  const start = html.indexOf(marker);
  if (start === -1) return [];
  const jsonStart = start + marker.length;
  const end = html.indexOf('</script>', jsonStart);
  if (end === -1) return [];

  let state: unknown;
  try {
    state = JSON.parse(html.slice(jsonStart, end));
  } catch {
    return [];
  }

  const items = findNewsArray(state);
  if (!items) return [];

  return items
    .map((item): ScrapedArticle | null => {
      if (!item.name || !item.slug || !item.date) return null;
      const publishedAt = new Date(`${item.date}T00:00:00Z`);
      if (Number.isNaN(publishedAt.getTime())) return null;
      return {
        headline: item.name.trim(),
        excerpt: (item.description ?? '').trim(),
        sourceUrl: `https://kormany.hu/hirek/${item.slug}`,
        publishedAt,
        imageUrl: item.images?.dskImage?.path ?? item.seoMeta?.imageUrl ?? null,
      };
    })
    .filter((a): a is ScrapedArticle => a !== null);
}

function findNewsArray(node: unknown): KormanyHirItem[] | null {
  if (Array.isArray(node)) {
    const first = node[0];
    if (
      first && typeof first === 'object' &&
      'slug' in first && 'name' in first && 'date' in first &&
      'ministry' in first && 'seoMeta' in first
    ) {
      return node as KormanyHirItem[];
    }
    for (const child of node) {
      const found = findNewsArray(child);
      if (found) return found;
    }
    return null;
  }
  if (node && typeof node === 'object') {
    for (const value of Object.values(node)) {
      const found = findNewsArray(value);
      if (found) return found;
    }
  }
  return null;
}
