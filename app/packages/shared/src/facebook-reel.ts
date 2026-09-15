/**
 * Facebook reel/videó permalinkek felismerése és beágyazható lejátszó-URL
 * képzése.
 *
 * user kérés, 2026-09-15: Molnár Áron, Juhász Péter (Juhi) és Átlátszó
 * reeljei jelenjenek meg az oldalon, ne csak kifelé mutató linkként.
 *
 * Miért lehet ez most, ha a `social-media.ts` teteje azt írja, hogy nem:
 * a korlát SOSEM a Facebook oldaláról jött, hanem a SAJÁT CSP-nkből — a
 * `frame-src` addig csak a Turnstile-t és a YouTube-ot engedte, így egy
 * facebook.com iframe-et a böngésző csendben eldobott. 2026-09-15-én
 * mérve (beágyazott teszt-oldal + tényleges lejátszás): a
 * `plugins/video.php` lejátszó publikus reelre bejelentkezés, App ID és
 * oEmbed-token NÉLKÜL betöltődik és játszik. A `frame-src` ezért kapta meg
 * a `https://www.facebook.com` origint a `next.config.js`-ben.
 *
 * A direkt mp4 (fbcdn) továbbra sem játék: rövid életű, aláírt URL, és
 * újratárolni se technikailag, se jogilag nem helyes. A plugin-iframe
 * viszont a Facebook saját, dokumentált beágyazási útja, a megjelenítés
 * végig az ő playerükben marad.
 *
 * Tisztán függvény, hálózat nélkül — ezért tesztelhető és ezért él itt.
 */

/** Csak ezekről a hostokról fogadunk el permalinket. */
const FB_HOSTS = new Set([
  'facebook.com',
  'www.facebook.com',
  'web.facebook.com',
  'm.facebook.com',
  'fb.watch',
]);

/**
 * Igaz, ha az URL egy Facebook videó/reel permalink, amit a
 * `plugins/video.php` le tud játszani.
 *
 * Elfogadott alakok:
 *   facebook.com/reel/<id>
 *   facebook.com/watch/?v=<id>  |  facebook.com/watch?v=<id>
 *   facebook.com/<oldal>/videos/<id>  (a /videos/ szegmens a jel)
 *
 * NEM fogad el sima szöveges posztot (`/posts/…`, `/permalink.php`) — arra
 * nincs videó-lejátszó, az iframe üres dobozt adna.
 */
export function isFacebookVideoUrl(url: string): boolean {
  const u = parseFbUrl(url);
  if (!u) return false;
  const path = u.pathname.replace(/\/+$/, '');
  if (/^\/reel\/[^/]+$/.test(path)) return true;
  if (path === '/watch' && u.searchParams.get('v')) return true;
  if (/\/videos\/[^/]+$/.test(path)) return true;
  if (u.hostname === 'fb.watch' && path.length > 1) return true;
  return false;
}

/**
 * A beágyazható lejátszó URL-je, vagy null, ha a bemenet nem Facebook
 * videó-permalink.
 *
 * A `href` paramétert a Facebook maga URL-kódolva várja; a `show_text=false`
 * a poszt szövegét hagyja el a playerből (a mi kártyánk úgyis kiírja).
 */
export function facebookEmbedUrl(url: string): string | null {
  if (!isFacebookVideoUrl(url)) return null;
  const u = parseFbUrl(url)!;
  // Mindig a kanonikus www-s alakot adjuk tovább: a plugin az m./web.
  // aldomainre néha átirányít, ami egy CSP-engedélyezett origin helyett
  // egy nem engedélyezettre vinne.
  u.hostname = 'www.facebook.com';
  u.protocol = 'https:';
  const params = new URLSearchParams({ href: u.toString(), show_text: 'false' });
  return `https://www.facebook.com/plugins/video.php?${params.toString()}`;
}

function parseFbUrl(url: string): URL | null {
  if (typeof url !== 'string' || url.length === 0) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (!FB_HOSTS.has(u.hostname.toLowerCase())) return null;
  return u;
}
