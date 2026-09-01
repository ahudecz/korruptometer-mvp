/**
 * 012-reader-subscriptions — a Resend küldő-burkoló (FR-042, FR-047, FR-051…FR-053).
 *
 * A `slack.ts` mintájára: natív `fetch`, nincs SDK, nincs új függőség.
 * Környezeti változóra kapuzva, SOHA nem dob, eredményobjektumot ad vissza.
 *
 * Alkotmány v2.0.0, III. alapelv — kötelező megkötések, nem preferenciák:
 * kizárólag küldési útvonal (soha nem sor, ütemező vagy adattár; a
 * feliratkozók nyilvántartása Postgresben van), a küldő domain a
 * `mail.kegyencjarat.hu` ALDOMAIN, soha nem az apex, és minden tömeges küldés
 * viszi az RFC 8058 fejléceket.
 */

export type SendResult = { sent: number; failed: number; error?: string };

export type OutgoingMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
  headers?: Record<string, string>;
};

/** A szolgáltatói ingyenes csomag napi kerete. Az alkalmazás tartatja be, nem a szolgáltató. */
export const RESEND_DAILY_LIMIT = 100;
/** Ugyanaz havi szinten. 90 × 31 = 2790, tehát a NAPI korlát a kötő. */
export const RESEND_MONTHLY_LIMIT = 3000;
/** Egy `/emails/batch` hívás legfeljebb ennyi üzenetet visz. A hívó darabol. */
export const RESEND_BATCH_MAX = 100;

const RESEND_BATCH_URL = 'https://api.resend.com/emails/batch';

/**
 * Egy köteg elküldése.
 *
 * `RESEND_API_KEY` nélkül `{ sent: 0, failed: 0 }`, HÁLÓZATI HÍVÁS NÉLKÜL
 * (FR-047). SOHA nem dob: egy hálózati hiba, egy nem-2xx válasz és egy hibás
 * törzs is `{ sent: 0, failed: messages.length, error }` alakban tér vissza,
 * hogy a hívó vissza tudja adni a lefoglalt keretét.
 */
export async function sendBatch(messages: OutgoingMessage[]): Promise<SendResult> {
  if (messages.length === 0) return { sent: 0, failed: 0 };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: 0, failed: 0 };

  const from = process.env.RESEND_FROM;
  if (!from) return { sent: 0, failed: messages.length, error: 'RESEND_FROM not configured' };

  if (messages.length > RESEND_BATCH_MAX) {
    return {
      sent: 0,
      failed: messages.length,
      error: `batch of ${messages.length} exceeds the ${RESEND_BATCH_MAX} per-call maximum`,
    };
  }

  try {
    const res = await fetch(RESEND_BATCH_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(
        messages.map((m) => ({
          from,
          to: [m.to],
          subject: m.subject,
          text: m.text,
          html: m.html,
          headers: m.headers ?? {},
        })),
      ),
    });

    if (!res.ok) {
      return { sent: 0, failed: messages.length, error: `resend ${res.status}` };
    }
    const data = (await res.json().catch(() => null)) as { data?: unknown[] } | null;
    if (!data || !Array.isArray(data.data)) {
      return { sent: 0, failed: messages.length, error: 'malformed resend response' };
    }
    const sent = data.data.length;
    return { sent, failed: Math.max(0, messages.length - sent) };
  } catch (err) {
    return {
      sent: 0,
      failed: messages.length,
      error: err instanceof Error ? err.message : 'unknown',
    };
  }
}

/**
 * Az RFC 8058 egy-kattintásos leiratkozó fejlécek (FR-042).
 *
 * KÜLÖN, tiszta függvény, mert a `List-Unsubscribe-Post` pontos betűzése a
 * Gmail számára teherviselő, és saját tesztet érdemel.
 *
 * A `mailto:` érték KÖTELEZŐ, nem opcionális: egy vállalati levélszűrő nem tud
 * mailto-t elsütni, a nagy szolgáltatók viszont várják a webcím mellé.
 */
export function unsubscribeHeaders(unsubscribeUrl: string): Record<string, string> {
  const mailbox = process.env.RESEND_UNSUBSCRIBE_MAILBOX ?? 'leiratkozas@kegyencjarat.hu';
  return {
    'List-Unsubscribe': `<${unsubscribeUrl}>, <mailto:${mailbox}?subject=unsubscribe>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}
