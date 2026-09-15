/**
 * Kurált Facebook-reel szekció — KIK kerülhetnek ki.
 *
 * user kérés, 2026-09-15. A hírfolyam (SocialPost) automatikusan hozza az
 * összes szinkronizált oldal posztját; ez a lista dönti el, kinek a reeljei
 * kapnak külön, kiemelt szekciót a /podcastok oldalon.
 *
 * A név PONTOSAN a `SocialPost.authorName` értéke legyen (az a
 * `FacebookPage.pageName`-ből jön) — elgépelés esetén a szerző csendben
 * kimarad, nem hibázik semmi. Ezért van mindegyik mellett a Facebook-oldal
 * azonosítója is kommentben, amiről a név jön.
 *
 * Bővítés: ebbe a tömbbe kell új nevet írni — DE csak olyan oldal kerülhet
 * ide, ami a `FacebookPage` táblában is szerepel és `enabled`, különben
 * sosem lesz posztja a SocialPost táblában.
 */
export const REEL_AUTHORS: string[] = [
  'Molnár Áron', // molnararonofficial
  'Juhász Péter', // Juhi.JuhaszPeter
  'Átlátszó', // atlatszo.hu
  'Jámbor András', // jamborandrasoldala
  'Maydayhungary', // 61575111935495
  'Magyar Péter', // peter.magyar.102
  'Kontrollpont', // kontrollponthu
  'Vastagbőr', // vastagbor
  'aHang', // szabadahang
  'Pottyondy Edina', // pottyondyedina
  // Kimaradt, mert az oldal MÉG NINCS a Facebook-szinkronban (2026-09-15):
  //   Fekete-Győr András — feketegyorandras.momentum
  //   F Csoport          — fcsoport
  // Ezek felvétele a `FacebookPage` táblába Apify-költséggel jár minden
  // szinkron-futásnál, ezért user-döntésre vár.
];

/**
 * Szerzőnként legfeljebb ennyi reel látszik a szekcióban — ugyanaz a
 * "ne nyomja el egy csatorna a többit" szabály, mint a podcast-rácsnál.
 * 1-en áll, mert a lista bőven több szerzőt tartalmaz, mint ahány reel
 * kifér: így minden csatorna szóhoz jut, a legfrissebb videójával.
 */
export const MAX_REELS_PER_AUTHOR = 1;

/** Hány reel látszik összesen. */
export const REEL_SECTION_LIMIT = 12;
