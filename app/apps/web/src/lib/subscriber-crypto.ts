import 'server-only';

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * 012-reader-subscriptions — a feliratkozók címkezelése és a linkek aláírása.
 *
 * A megerősítési állandók AZÉRT vannak itt, és nem a route-ban: a
 * `feliratkozas/route.ts` a türelmi időt olvassa, a
 * `subscriber-confirm-send.ts` pedig a darabszám-korlátot érvényesíti, és a
 * kettő nem importálhatja egymást.
 */

/** A megerősítő link élettartama (FR-036). */
export const CONFIRM_EXPIRY_HOURS = 24;
/** Két megerősítő üzenet közti minimális szünet egy címre (FR-037). */
export const CONFIRM_COOLDOWN_MINUTES = 15;
/** Egy címre legfeljebb ennyi megerősítő üzenet mehet ki (FR-037). */
export const CONFIRM_MAX_SENDS = 3;
/** A leiratkozás után ennyi nappal törlődik a személyes adat (FR-085). */
export const PURGE_DAYS = 30;

/**
 * EGYETLEN kanonizálás (FR-082): a feliratkozó route, a törlési route ÉS a
 * szolgáltatói webhook mind ezt hívja. Ha bármelyik másképp normalizálna, a
 * hash-terük szétválna, és egy letiltott cím újra feliratkozhatna.
 */
export function hashSubscriberEmail(raw: string): string {
  return createHash('sha256').update(raw.trim().toLowerCase()).digest('hex');
}

/** A megerősítő token tárolt alakja. A nyers token csak a levélben létezik. */
export function hashConfirmToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Új, egyszer használatos megerősítő token. */
export function newConfirmToken(): string {
  return randomBytes(32).toString('base64url');
}

/** A hálózati cím álnevesített alakja. Ez is SZEMÉLYES ADAT (FR-084). */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash('sha256').update(ip.trim()).digest('hex');
}

// ── A leiratkozó link aláírása (FR-039…FR-041) ──────────────────────────────
//
// Aláírt bájtok: az `unsub:v1:{kid}:{subscriberId}` UTF-8 alakja, és SEMMI MÁS.
// Nincs benne URL, nincs benne lekérdezési sztring, nincs záró sorvég.
//
// Token: base64url(payload) + "." + base64url(hmacSha256(secret, payload)).
//
// A `SUBSCRIBER_LINK_SECRET` ALÁÍR és ellenőriz; a `SUBSCRIBER_LINK_SECRET_PREVIOUS`
// CSAK ellenőriz. Mindkettő "kid:secret" alakú.
//
// KÜLÖN titok a `PII_ENC_KEY`-től, külön forgatási ütemtervvel (FR-041).
// SZÁNDÉKOSAN nem az `INTERNAL_REVALIDATE_SECRET ?? PII_ENC_KEY` visszaesési
// minta: egy visszaesés, ami csendben a titkosító kulcsot használja aláírásra,
// pontosan az FR-041-et üti ki.

const UNSUB_PREFIX = 'unsub';
const UNSUB_VERSION = 'v1';

type KeyEntry = { kid: string; secret: string };

function parseKeyEnv(value: string | undefined): KeyEntry | null {
  if (!value) return null;
  const sep = value.indexOf(':');
  if (sep <= 0 || sep === value.length - 1) return null;
  return { kid: value.slice(0, sep), secret: value.slice(sep + 1) };
}

/** Az ALÁÍRÓ kulcs. Csak ez ír alá, soha a korábbi. */
export function signingKey(): KeyEntry | null {
  return parseKeyEnv(process.env.SUBSCRIBER_LINK_SECRET);
}

/**
 * A kid-hez tartozó kulcs, vagy `null`.
 *
 * Ismeretlen kid ELUTASÍT. Soha nem esünk vissza arra, hogy sorra próbáljuk
 * az összes kulcsot (FR-039) — az pont azt a különbséget mosná el, amiért a
 * kid egyáltalán a hasznos adatban van.
 */
function keyForKid(kid: string): KeyEntry | null {
  const current = parseKeyEnv(process.env.SUBSCRIBER_LINK_SECRET);
  if (current && current.kid === kid) return current;
  const previous = parseKeyEnv(process.env.SUBSCRIBER_LINK_SECRET_PREVIOUS);
  if (previous && previous.kid === kid) return previous;
  return null;
}

function macOf(secret: string, payload: string): Buffer {
  return createHmac('sha256', secret).update(payload, 'utf8').digest();
}

/** Egy leiratkozó token. `null`, ha nincs beállítva aláíró kulcs. */
export function signUnsubToken(subscriberId: string): string | null {
  const key = signingKey();
  if (!key) return null;
  const payload = `${UNSUB_PREFIX}:${UNSUB_VERSION}:${key.kid}:${subscriberId}`;
  const mac = macOf(key.secret, payload);
  return `${Buffer.from(payload, 'utf8').toString('base64url')}.${mac.toString('base64url')}`;
}

/** A token teljes leiratkozó URL-je, vagy `null`. */
export function unsubUrl(subscriberId: string): string | null {
  const token = signUnsubToken(subscriberId);
  if (!token) return null;
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.kegyencjarat.hu').replace(/\/+$/, '');
  return `${base}/hirlevel/leiratkozas?t=${encodeURIComponent(token)}`;
}

/**
 * Ellenőrzés. A feliratkozó azonosítóját adja vissza, vagy `null`-t.
 *
 * NINCS időbeli lejárat az aláírásban (FR-040): egy kézbesített levélnek
 * addig kell használhatónak maradnia, amíg a postaládában ül.
 */
export function verifyUnsubToken(token: string | null | undefined): string | null {
  if (!token || typeof token !== 'string') return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0 || dot === token.length - 1) return null;

  let payload: string;
  let mac: Buffer;
  try {
    payload = Buffer.from(token.slice(0, dot), 'base64url').toString('utf8');
    mac = Buffer.from(token.slice(dot + 1), 'base64url');
  } catch {
    return null;
  }

  const parts = payload.split(':');
  if (parts.length !== 4) return null;
  const [prefix, version, kid, subscriberId] = parts as [string, string, string, string];
  if (prefix !== UNSUB_PREFIX || version !== UNSUB_VERSION) return null;
  if (!kid || !subscriberId) return null;

  const key = keyForKid(kid);
  if (!key) return null; // ismeretlen kid — elutasít, nem próbálkozik tovább

  const expected = macOf(key.secret, payload);
  // A hosszellenőrzés kötelező: a timingSafeEqual DOB, ha a két puffer
  // hossza eltér, és az a dobás 500-assá változtatna egy sima elutasítást.
  if (expected.length !== mac.length) return null;
  if (!timingSafeEqual(expected, mac)) return null;
  return subscriberId;
}

// ── Címek visszautasítása (FR-045) ──────────────────────────────────────────
//
// A bemeneten dolgozik, soha nem egy tárolt oszlopon: az `emailDomain` oszlop
// azért esett ki a tervből, mert semmi nem olvasta volna.

const ROLE_LOCAL_PARTS = new Set([
  'abuse',
  'admin',
  'administrator',
  'billing',
  'contact',
  'hello',
  'help',
  'hostmaster',
  'info',
  'kapcsolat',
  'mail',
  'marketing',
  'noreply',
  'no-reply',
  'office',
  'postmaster',
  'root',
  'sales',
  'security',
  'support',
  'sysadmin',
  'titkarsag',
  'ugyfelszolgalat',
  'webmaster',
]);

const DISPOSABLE_DOMAINS = new Set([
  '10minutemail.com',
  'dispostable.com',
  'fakeinbox.com',
  'getairmail.com',
  'guerrillamail.com',
  'inboxbear.com',
  'mailinator.com',
  'maildrop.cc',
  'mailnesia.com',
  'mintemail.com',
  'mohmal.com',
  'sharklasers.com',
  'temp-mail.org',
  'tempmail.com',
  'throwawaymail.com',
  'trashmail.com',
  'yopmail.com',
]);

export type AddressRefusal = 'role' | 'disposable' | 'malformed' | null;

/**
 * Visszautasítandó-e a cím, és miért.
 *
 * A HÍVÓ soha nem adja tovább az okot az olvasónak: minden elutasítás ugyanazt
 * az általános magyar szöveget kapja, hogy egy bot ne tanuljon belőle.
 */
export function refuseAddress(rawEmail: string): AddressRefusal {
  const email = rawEmail.trim().toLowerCase();
  const at = email.lastIndexOf('@');
  if (at <= 0 || at === email.length - 1) return 'malformed';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!domain.includes('.')) return 'malformed';
  if (ROLE_LOCAL_PARTS.has(local)) return 'role';
  if (DISPOSABLE_DOMAINS.has(domain)) return 'disposable';
  return null;
}
