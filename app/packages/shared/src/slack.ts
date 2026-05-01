/**
 * Slack-webhook helper (T066). Posts a digest message to
 * `SLACK_EDITOR_WEBHOOK`. Failures are surfaced to Sentry but never thrown
 * on the request path (US 2.4 / US 2.5 acceptance).
 */

export async function postSlackDigest(args: {
  webhook?: string;
  message: string;
  blocks?: unknown[];
}): Promise<{ posted: boolean; error?: string }> {
  const url = args.webhook ?? process.env.SLACK_EDITOR_WEBHOOK;
  if (!url) return { posted: false, error: 'SLACK_EDITOR_WEBHOOK not configured' };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: args.message, blocks: args.blocks }),
    });
    if (!res.ok) return { posted: false, error: `slack ${res.status}` };
    return { posted: true };
  } catch (err) {
    return { posted: false, error: err instanceof Error ? err.message : 'unknown' };
  }
}
