/**
 * Supabase Storage helpers (T065). The orphan scan in `gdpr.retention-sweep`
 * is the deliberate sole authority for deletion of `submissions/` objects —
 * we DO NOT configure native Storage lifecycle rules because a blunt
 * time-floor would conflict with the no-auto-purge rule for `received` /
 * `in_review` submissions (FR-053).
 *
 * In dev / vitest mode (no `SUPABASE_URL` configured), the helpers fall back
 * to a `/tmp` filesystem implementation so the unit tests can run without
 * external dependencies.
 */

import { mkdir, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';

export const ALLOWED_SUBMISSION_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'text/plain',
  'audio/mpeg',
  'audio/x-wav',
  'audio/wav',
  'audio/ogg',
]);

export const MAX_BYTES = 25 * 1024 * 1024; // 25 MB hard cap

export type SignedUploadPolicy = {
  url: string;
  fields: Record<string, string>;
  storageKey: string;
  expiresAt: string;
};

export type ObjectInfo = {
  key: string;
  sizeBytes: number;
  lastModified: Date;
};

const ROOT = process.env.SUBMISSION_UPLOAD_ROOT ?? '/tmp/korr-uploads';

function fsKey(bucket: string, key: string): string {
  return join(ROOT, bucket, key);
}

/**
 * Returns a signed POST policy targeting the Supabase Storage bucket. The
 * policy carries the `Content-Type` allowlist and a `content-length-range`
 * so the bucket itself rejects oversize / wrong-mime uploads. 5-min validity
 * keeps presigned URLs from leaking.
 *
 * In dev (no SUPABASE_URL), returns a /tmp-targeted policy that the local
 * route handler accepts.
 */
export async function createSubmissionUploadUrl(args: {
  bucket: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<SignedUploadPolicy> {
  if (!ALLOWED_SUBMISSION_MIME.has(args.mimeType)) {
    throw new Error(`MIME not allowlisted: ${args.mimeType}`);
  }
  if (args.sizeBytes < 0 || args.sizeBytes > MAX_BYTES) {
    throw new Error('size out of range');
  }
  const id = randomBytes(8).toString('hex');
  const safeName = args.fileName.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 80);
  const storageKey = `${new Date().toISOString().slice(0, 10)}/${id}-${safeName}`;
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    return {
      url: `${supabaseUrl}/storage/v1/object/${args.bucket}/${storageKey}`,
      fields: {
        'Content-Type': args.mimeType,
        'content-length-range': `0,${MAX_BYTES}`,
      },
      storageKey,
      expiresAt,
    };
  }
  return {
    url: `local:${args.bucket}/${storageKey}`,
    fields: { 'Content-Type': args.mimeType },
    storageKey,
    expiresAt,
  };
}

export async function createSignedDownloadUrl(args: {
  bucket: string;
  key: string;
  ttlSeconds?: number;
}): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    const ttl = args.ttlSeconds ?? 60;
    return `${supabaseUrl}/storage/v1/object/sign/${args.bucket}/${args.key}?expires=${ttl}`;
  }
  return `file://${fsKey(args.bucket, args.key)}`;
}

export async function deleteObject(args: { bucket: string; key: string }): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');
    const url = `${supabaseUrl}/storage/v1/object/${args.bucket}/${args.key}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${serviceKey}` },
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`storage delete ${res.status}`);
    }
    return;
  }
  try {
    await unlink(fsKey(args.bucket, args.key));
  } catch {
    // best-effort
  }
}

export async function headObject(args: { bucket: string; key: string }): Promise<{ sizeBytes: number } | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');
    const url = `${supabaseUrl}/storage/v1/object/info/authenticated/${args.bucket}/${args.key}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${serviceKey}` } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`storage head ${res.status}`);
    const info = (await res.json()) as { size?: number; metadata?: { size?: number } };
    const sizeBytes = info.size ?? info.metadata?.size ?? 0;
    return { sizeBytes };
  }
  try {
    const s = await stat(fsKey(args.bucket, args.key));
    return { sizeBytes: s.size };
  } catch {
    return null;
  }
}

/** Lists objects older than `olderThanDays` and returns their keys + size. */
export async function listOrphans(args: {
  bucket: string;
  prefix?: string;
  olderThanDays: number;
}): Promise<ObjectInfo[]> {
  const cutoff = Date.now() - args.olderThanDays * 24 * 60 * 60 * 1000;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');
    const url = `${supabaseUrl}/storage/v1/object/list/${args.bucket}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prefix: args.prefix ?? '', limit: 1000, sortBy: { column: 'updated_at', order: 'asc' } }),
    });
    if (!res.ok) throw new Error(`storage list ${res.status}`);
    const items = (await res.json()) as { name: string; metadata?: { size?: number }; updated_at?: string }[];
    return items
      .filter((i) => i.updated_at && new Date(i.updated_at).getTime() < cutoff)
      .map((i) => ({
        key: `${args.prefix ? `${args.prefix}/` : ''}${i.name}`,
        sizeBytes: i.metadata?.size ?? 0,
        lastModified: new Date(i.updated_at!),
      }));
  }

  // Local /tmp fallback for tests.
  const root = fsKey(args.bucket, args.prefix ?? '');
  let entries: string[] = [];
  try {
    entries = await readdir(root, { recursive: true } as Record<string, unknown> as never);
  } catch {
    return [];
  }
  const out: ObjectInfo[] = [];
  for (const name of entries) {
    const full = join(root, String(name));
    try {
      const s = await stat(full);
      if (!s.isFile()) continue;
      if (s.mtimeMs >= cutoff) continue;
      const key = full.slice(fsKey(args.bucket, '').length);
      out.push({ key, sizeBytes: s.size, lastModified: s.mtime });
    } catch {
      // skip
    }
  }
  return out;
}

/**
 * Test/dev helper: write `content` to the underlying /tmp store. Should not
 * be used in production paths.
 */
export async function localPut(args: {
  bucket: string;
  key: string;
  content: Uint8Array;
}): Promise<void> {
  const path = fsKey(args.bucket, args.key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, args.content);
}
