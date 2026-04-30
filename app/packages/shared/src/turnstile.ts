/**
 * Cloudflare Turnstile server verifier (FR-028). In dev we accept the
 * Cloudflare test secret `1x0000…AA` which always returns success — same
 * pattern documented in Cloudflare's developer guide.
 */

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export type TurnstileResult =
  | { success: true }
  | { success: false; reason: string };

export async function verifyTurnstile(
  token: string | undefined,
  remoteIp?: string,
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) {
    return { success: false, reason: 'TURNSTILE_SECRET missing' };
  }
  // Cloudflare's "always passes" dev secret short-circuits the network call.
  if (secret.startsWith('1x') && (token === '1x' || !token || token.startsWith('1x'))) {
    return { success: true };
  }
  if (!token) {
    return { success: false, reason: 'missing token' };
  }
  const params = new URLSearchParams({ secret, response: token });
  if (remoteIp) params.set('remoteip', remoteIp);
  try {
    const r = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      body: params,
    });
    const body = (await r.json()) as { success: boolean; 'error-codes'?: string[] };
    if (body.success) return { success: true };
    return { success: false, reason: (body['error-codes'] ?? []).join(',') || 'verify failed' };
  } catch (err) {
    return {
      success: false,
      reason: err instanceof Error ? err.message : 'network error',
    };
  }
}
