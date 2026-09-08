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
 *
 * MOBIL LINK-BUG, user report 2026-08-31: a `permalink_url` Graph API mező
 * egy olyan profil-ID-t ad vissza (a poszt "story"-jának egy belső azonosítóját),
 * ami sem mobilon, sem asztali gépen nem nyílt meg senkinek (a userön kívül
 * 3 barátja is "This isn't available"-t / üres nyitóoldalt kapott). Kiderült:
 * a Facebook Graph API Page-ID-nk (FACEBOOK_PAGE_ID) egy VALÓDI böngészőben
 * automatikusan átirányít egy MÁSIK, publikus numerikus azonosítóra
 * (`facebook.com/{page_id}` → `facebook.com/profile.php?id={public_id}`) —
 * ez a `FACEBOOK_PAGE_PUBLIC_ID` a ténylegesen működő cím mindenkinek.
 * Ezért a permalinket MOST MÁR MAGUNK építjük fel ("story.php?story_fbid=
 * {post-lokális-rész}&id={FACEBOOK_PAGE_PUBLIC_ID}" formában), nem a Graph
 * API `permalink_url` mezőjére támaszkodva — az korábban egy nem-működő
 * ID-t adott vissza. Ha FACEBOOK_PAGE_PUBLIC_ID nincs beállítva, visszaesünk
 * a régi permalink_url-lekérdezésre (jobb egy talán-nem-működő link, mint
 * a végképp naiv `facebook.com/{post_id}` forma).
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
  const postUrl = await buildWorkingPermalink(postId, token, pageId);
  return { ok: true, postId, postUrl };
}

/**
 * A ténylegesen mindenkinek megnyíló link felépítése — l. a fájl tetején
 * lévő MOBIL LINK-BUG megjegyzést. postId formátuma "{page_id}_{story_id}".
 */
async function buildWorkingPermalink(postId: string, token: string, pageId: string): Promise<string> {
  const publicPageId = process.env.FACEBOOK_PAGE_PUBLIC_ID;
  const storyId = postId.includes('_') ? postId.split('_')[1] : postId;
  if (publicPageId && storyId) {
    return `https://www.facebook.com/story.php?story_fbid=${storyId}&id=${publicPageId}`;
  }
  // Fallback: a régi (nem mindig megbízható) permalink_url-lekérdezés.
  const permalink = await fetchPermalink(postId, token);
  return permalink ?? `https://www.facebook.com/${pageId}/posts/${storyId}`;
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
