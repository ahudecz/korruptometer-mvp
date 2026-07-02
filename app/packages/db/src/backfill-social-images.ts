/**
 * Backfill: meglévő SocialPost sorokból letölti a fbcdn.net képeket
 * és Supabase Storage-ba tölti fel, majd frissíti az imageUrl-t.
 *
 * Használat: pnpm --filter @korr/db backfill-social-images
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const STORAGE_BUCKET = 'social-images';

if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase env vars missing');

const AUTH = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` };

interface Post { id: string; imageUrl: string | null; postUrl: string }

async function resolveAndStoreImage(rawUrl: string, storageKey: string): Promise<string | null> {
  try {
    const u = new URL(rawUrl);

    if (u.hostname.startsWith('external-') && u.hostname.includes('fbcdn.net')) {
      const originalUrl = u.searchParams.get('url');
      return originalUrl ? decodeURIComponent(originalUrl) : null;
    }

    if (u.hostname.includes('fbcdn.net')) {
      const imgRes = await fetch(rawUrl, {
        headers: { 'Referer': 'https://www.facebook.com/', 'User-Agent': 'Mozilla/5.0' },
      });
      if (!imgRes.ok) return null;

      const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg';
      const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
      const filename = `${storageKey}.${ext}`;
      const buffer = await imgRes.arrayBuffer();

      const uploadRes = await fetch(
        `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${filename}`,
        {
          method: 'POST',
          headers: { ...AUTH, 'Content-Type': contentType, 'x-upsert': 'true' },
          body: buffer,
        },
      );

      if (!uploadRes.ok) return null;
      return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${filename}`;
    }

    // Már nem fbcdn — jó ahogy van
    return rawUrl;
  } catch {
    return null;
  }
}

function storageKeyFromPostUrl(postUrl: string): string {
  const m = postUrl.match(/\/(\d+)\/?$/);
  return m ? `fb-${m[1]}` : `fb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function main() {
  // Minden facebook poszt ahol van imageUrl és fbcdn URL
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/SocialPost?platform=eq.facebook&imageUrl=not.is.null&select=id,imageUrl,postUrl&limit=200`,
    { headers: AUTH },
  );
  const posts = (await res.json()) as Post[];

  const fbcdnPosts = posts.filter(p => p.imageUrl?.includes('fbcdn.net'));
  console.log(`\n${fbcdnPosts.length} poszt fbcdn.net képpel (${posts.length} facebook posztból)\n`);

  let updated = 0;
  for (const post of fbcdnPosts) {
    const storageKey = storageKeyFromPostUrl(post.postUrl);
    const newUrl = await resolveAndStoreImage(post.imageUrl!, storageKey);

    if (!newUrl || newUrl === post.imageUrl) {
      console.log(`  ✗ ${post.id.slice(0, 8)}: letöltés/feldolgozás sikertelen`);
      continue;
    }

    const patchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/SocialPost?id=eq.${post.id}`,
      {
        method: 'PATCH',
        headers: { ...AUTH, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ imageUrl: newUrl }),
      },
    );

    if (patchRes.ok) {
      const display = newUrl.includes('supabase.co') ? 'storage ✓' : newUrl.slice(0, 60);
      console.log(`  ✓ ${post.id.slice(0, 8)}: ${display}`);
      updated++;
    } else {
      console.log(`  ✗ ${post.id.slice(0, 8)}: DB update hiba`);
    }
  }

  console.log(`\nKész: ${fbcdnPosts.length} fbcdn poszt, ${updated} frissítve\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
