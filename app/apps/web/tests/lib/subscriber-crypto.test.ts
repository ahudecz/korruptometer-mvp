import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const {
  hashSubscriberEmail,
  refuseAddress,
  signUnsubToken,
  unsubUrl,
  verifyUnsubToken,
  CONFIRM_EXPIRY_HOURS,
  CONFIRM_COOLDOWN_MINUTES,
  CONFIRM_MAX_SENDS,
  PURGE_DAYS,
} = await import('@/lib/subscriber-crypto');

beforeEach(() => {
  process.env.SUBSCRIBER_LINK_SECRET = 'k2:egy-eleg-hosszu-titok-2026';
  delete process.env.SUBSCRIBER_LINK_SECRET_PREVIOUS;
  process.env.NEXT_PUBLIC_SITE_URL = 'https://www.kegyencjarat.hu';
});

afterEach(() => {
  delete process.env.SUBSCRIBER_LINK_SECRET;
  delete process.env.SUBSCRIBER_LINK_SECRET_PREVIOUS;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.PII_ENC_KEY;
});

describe('hashSubscriberEmail — one canonicalisation (FR-082)', () => {
  it('trims and lowercases, so the three callers cannot drift apart', () => {
    const canonical = hashSubscriberEmail('olvaso@example.hu');
    expect(hashSubscriberEmail('  OLVASO@Example.HU  ')).toBe(canonical);
    expect(hashSubscriberEmail('\tolvaso@EXAMPLE.hu\n')).toBe(canonical);
  });

  it('distinguishes different addresses', () => {
    expect(hashSubscriberEmail('a@b.hu')).not.toBe(hashSubscriberEmail('c@b.hu'));
  });
});

describe('the signed unsubscribe token (FR-039, FR-040, FR-041)', () => {
  it('round-trips: a token signed now verifies back to the subscriber id', () => {
    const token = signUnsubToken('sub-1234')!;
    expect(token).toContain('.');
    expect(verifyUnsubToken(token)).toBe('sub-1234');
  });

  it('rejects a tampered payload', () => {
    const token = signUnsubToken('sub-1234')!;
    const [payload, mac] = token.split('.');
    const forged = Buffer.from('unsub:v1:k2:sub-9999', 'utf8').toString('base64url');
    expect(payload).not.toBe(forged);
    expect(verifyUnsubToken(`${forged}.${mac}`)).toBeNull();
  });

  it('rejects a tampered MAC', () => {
    const token = signUnsubToken('sub-1234')!;
    const [payload] = token.split('.');
    const badMac = Buffer.alloc(32, 7).toString('base64url');
    expect(verifyUnsubToken(`${payload}.${badMac}`)).toBeNull();
  });

  it('guards unequal MAC lengths instead of throwing (timingSafeEqual throws on a length mismatch)', () => {
    const token = signUnsubToken('sub-1234')!;
    const [payload] = token.split('.');
    expect(() => verifyUnsubToken(`${payload}.${Buffer.alloc(8, 1).toString('base64url')}`)).not.toThrow();
    expect(verifyUnsubToken(`${payload}.${Buffer.alloc(8, 1).toString('base64url')}`)).toBeNull();
  });

  it('REJECTS an unknown kid — it never falls through to trying every key (FR-039)', () => {
    const token = signUnsubToken('sub-1234')!;
    // Ugyanaz a titok, más kid alatt: ha a kód sorra próbálná a kulcsokat,
    // ez átmenne. Elutasítania KELL.
    process.env.SUBSCRIBER_LINK_SECRET = 'k9:egy-eleg-hosszu-titok-2026';
    expect(verifyUnsubToken(token)).toBeNull();
  });

  it('a previous key VERIFIES but never SIGNS (FR-040)', () => {
    const oldToken = signUnsubToken('sub-1234')!;
    process.env.SUBSCRIBER_LINK_SECRET_PREVIOUS = 'k2:egy-eleg-hosszu-titok-2026';
    process.env.SUBSCRIBER_LINK_SECRET = 'k3:egy-masik-hosszu-titok-2027';

    // A postaládában ülő régi link tovább él…
    expect(verifyUnsubToken(oldToken)).toBe('sub-1234');
    // …de az új aláírás már az új kulcs kid-jét viseli.
    const newToken = signUnsubToken('sub-1234')!;
    expect(Buffer.from(newToken.split('.')[0]!, 'base64url').toString('utf8')).toContain(':k3:');
    expect(newToken).not.toBe(oldToken);
  });

  it('carries NO time expiry — a delivered message stays usable', () => {
    const token = signUnsubToken('sub-1234')!;
    const payload = Buffer.from(token.split('.')[0]!, 'base64url').toString('utf8');
    expect(payload).toBe('unsub:v1:k2:sub-1234');
    expect(payload).not.toMatch(/\d{10,}/); // nincs beleégetett időbélyeg
  });

  it('signs exactly `unsub:v1:{kid}:{id}` — no URL, no query string, no trailing newline', () => {
    const token = signUnsubToken('sub-1234')!;
    const payload = Buffer.from(token.split('.')[0]!, 'base64url').toString('utf8');
    expect(payload).toBe('unsub:v1:k2:sub-1234');
    expect(payload.endsWith('\n')).toBe(false);
  });

  it('returns null when no signing key is configured, instead of signing with something else', () => {
    delete process.env.SUBSCRIBER_LINK_SECRET;
    expect(signUnsubToken('sub-1')).toBeNull();
    expect(unsubUrl('sub-1')).toBeNull();
  });

  it('never falls back to PII_ENC_KEY as a signing key (FR-041)', () => {
    delete process.env.SUBSCRIBER_LINK_SECRET;
    process.env.PII_ENC_KEY = 'kulcs:titkositasi-kulcs';
    expect(signUnsubToken('sub-1')).toBeNull();
  });

  it('rejects rubbish input without throwing', () => {
    for (const bad of [null, undefined, '', 'nincs-pont', '.', 'a.', '.b', '💥.💥']) {
      expect(() => verifyUnsubToken(bad as string)).not.toThrow();
      expect(verifyUnsubToken(bad as string)).toBeNull();
    }
  });

  it('builds an absolute unsubscribe URL from NEXT_PUBLIC_SITE_URL', () => {
    expect(unsubUrl('sub-1')).toMatch(/^https:\/\/www\.kegyencjarat\.hu\/hirlevel\/leiratkozas\?t=/);
  });
});

describe('refuseAddress (FR-045)', () => {
  it('refuses role addresses', () => {
    for (const addr of ['info@ceg.hu', 'admin@ceg.hu', 'postmaster@ceg.hu', 'noreply@ceg.hu']) {
      expect(refuseAddress(addr)).toBe('role');
    }
  });

  it('refuses disposable domains', () => {
    expect(refuseAddress('valaki@mailinator.com')).toBe('disposable');
    expect(refuseAddress('valaki@yopmail.com')).toBe('disposable');
  });

  it('refuses a malformed address', () => {
    for (const addr of ['nincs-kukac', '@ceg.hu', 'a@', 'a@nincspont']) {
      expect(refuseAddress(addr)).toBe('malformed');
    }
  });

  it('accepts an ordinary reader address', () => {
    expect(refuseAddress('kovacs.bela@gmail.com')).toBeNull();
    expect(refuseAddress('  Kovacs.Bela@Freemail.HU ')).toBeNull();
  });
});

describe('the confirmation constants live here, not in the routes', () => {
  it('matches the settled values', () => {
    expect(CONFIRM_EXPIRY_HOURS).toBe(24);
    expect(CONFIRM_COOLDOWN_MINUTES).toBe(15);
    expect(CONFIRM_MAX_SENDS).toBe(3);
    expect(PURGE_DAYS).toBe(30);
  });
});
