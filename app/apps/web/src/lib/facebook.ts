import 'server-only';

/**
 * Vékony wrapper a Facebook Graph API Page-fotó-posztoló végpontja felett.
 * user kérés, 2026-08-30 — automatikus FB-posztok mérföldkövekhez/breaking
 * eseményekhez, Telegram-jóváhagyás után (l. check-social-triggers.ts,
 * telegram/webhook route.ts 's' ág).
 *
 * FACEBOOK_PAGE_ID + FACEBOOK_PAGE_ACCESS_TOKEN env var kell hozzá — amíg
 * ezek nincsenek beállítva (az Oldal még nem létezik), postPhotoToPage()
 * hibát ad vissza, NEM dob kivételt — a hívó (webhook route) ezt egyszerű
 * "nincs beállítva" Telegram-válaszként jeleníti meg, a SocialPostOutbox
 * sor 'approved' marad (nem 'failed'), hogy a token pótlása után egy
 * későbbi manuális retry ki tudja küldeni ugyanazt a jóváhagyott posztot.
 */

const GRAPH_API_VERSION = 'v21.0';

export type FacebookPostResult =
  | { ok: true; postId: string; postUrl: string }
  | { ok: false; error: string; notConfigured?: boolean };

export async function postPhotoToPage(imagePng: Buffer, caption: string): Promise<FacebookPostResult> {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!pageId || !token) {
    return { ok: false, error: 'FACEBOOK_PAGE_ID / FACEBOOK_PAGE_ACCESS_TOKEN nincs beállítva.', notConfigured: true };
  }

  const form = new FormData();
  form.append('caption', caption);
  form.append('access_token', token);
  form.append('source', new Blob([new Uint8Array(imagePng)], { type: 'image/png' }), 'post.png');

  const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/photos`, {
    method: 'POST',
    body: form,
  });
  const data = (await res.json().catch(() => null)) as { id?: string; post_id?: string; error?: { message?: string } } | null;

  if (!res.ok || !data || data.error) {
    return { ok: false, error: data?.error?.message ?? `HTTP ${res.status}` };
  }
  const postId = data.post_id ?? data.id ?? 'unknown';

  // user report, 2026-08-31: a "https://www.facebook.com/{post_id}" naiv
  // URL (page_id_postid formátum) NEM egy valós, böngészhető link — a
  // Facebook "This isn't available"-t dob rá. A tényleges, működő
  // permalinket ("facebook.com/{story_id}/posts/{post_id}") csak egy
  // KÜLÖN GET-lekérdezéssel lehet megkapni a `permalink_url` mezőn
  // keresztül — a /photos POST válasza sose adja vissza automatikusan.
  const permalink = await fetchPermalink(postId, token);
  return { ok: true, postId, postUrl: permalink ?? `https://www.facebook.com/${postId}` };
}

async function fetchPermalink(postId: string, token: string): Promise<string | null> {
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${postId}?fields=permalink_url&access_token=${token}`);
    const data = (await res.json().catch(() => null)) as { permalink_url?: string } | null;
    return data?.permalink_url ?? null;
  } catch {
    return null; // sose dobjon hibát emiatt — a fallback URL akkor is jobb, mint a teljes sikertelenség
  }
}
