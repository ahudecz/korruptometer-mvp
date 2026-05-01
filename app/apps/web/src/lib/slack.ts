import 'server-only';

export type SlackBlock = { type: string; text?: { type: string; text: string } };

/**
 * Posts a message to the editor channel via SLACK_EDITOR_WEBHOOK. No-op if
 * the webhook is unset (local dev). Surface failures to the caller so the
 * Inngest step can be retried.
 */
export async function postEditorAlert(message: string): Promise<void> {
  const url = process.env.SLACK_EDITOR_WEBHOOK;
  if (!url) return;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: message }),
  });
  if (!res.ok) {
    throw new Error(`slack webhook ${res.status}`);
  }
}
