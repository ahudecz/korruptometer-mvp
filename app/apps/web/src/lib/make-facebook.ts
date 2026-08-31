import 'server-only';

/**
 * Facebook-posztolás Make.com köztes szolgáltatáson keresztül.
 * user kérés, 2026-08-31 — a saját Facebook Developer App-unkon (Graph API,
 * Standard Access) keresztüli posztolás bizonyítottan CSAK azoknak látszik,
 * akiknek van szerepük az App-on (l. facebook.ts megjegyzése) — a nyilvános
 * láthatósághoz Advanced Access kellene, ami Business Verificationt igényel,
 * amihez viszont valódi (be nem jegyzett civil projektnél nem létező) jogi
 * dokumentum kell. A Make.com saját, már Advanced Access-es Facebook Pages
 * appja mögött posztolva (a user saját OAuth-jóváhagyásával, papír nélkül)
 * a poszt AZONNAL mindenkinek látszik — ez a Meta hivatalos, engedélyezett
 * útja erre az esetre.
 *
 * A Make.com scenario (Custom Webhook → Facebook Pages "Create a Post with
 * Photos") aszinkron dolgozik — a webhook egy azonnali "Accepted" választ ad,
 * a tényleges Facebook-posztolás a háttérben történik pár másodperc alatt.
 * Emiatt ITT NEM kapunk vissza postId/postUrl-t szinkron módon (ellentétben
 * a facebook.ts közvetlen Graph API hívásával) — a Telegram-visszaigazolás
 * ezért csak annyit tud mondani, hogy elindult a posztolás, nem hogy kész.
 */

export type MakeFacebookPostResult =
  | { ok: true }
  | { ok: false; error: string; notConfigured?: boolean };

export async function postPhotoViaMake(imagePng: Buffer, caption: string): Promise<MakeFacebookPostResult> {
  const webhookUrl = process.env.MAKE_FACEBOOK_WEBHOOK_URL;
  const apiKey = process.env.MAKE_FACEBOOK_WEBHOOK_APIKEY;
  if (!webhookUrl || !apiKey) {
    return { ok: false, error: 'MAKE_FACEBOOK_WEBHOOK_URL / MAKE_FACEBOOK_WEBHOOK_APIKEY nincs beállítva.', notConfigured: true };
  }

  const form = new FormData();
  form.append('caption', caption);
  form.append('photo', new Blob([new Uint8Array(imagePng)], { type: 'image/png' }), 'post.png');

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'x-make-apikey': apiKey },
      body: form,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `Make webhook HTTP ${res.status}: ${text}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
