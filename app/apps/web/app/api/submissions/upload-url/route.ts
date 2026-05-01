import { NextResponse } from 'next/server';
import { z } from 'zod';

import { presignLimiter } from '@korr/shared/ratelimit';
import {
  ALLOWED_SUBMISSION_MIME,
  MAX_BYTES,
  createSubmissionUploadUrl,
} from '@korr/shared/storage';
import { verifyTurnstile } from '@korr/shared/turnstile';

/**
 * T089 — POST /api/submissions/upload-url
 *
 * Turnstile-gate via verifyTurnstile, apply presignLimiter, return one signed
 * POST policy per file with strict Content-Type allowlist + content-length-range
 * (FR-028, FR-029, FR-032).
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const reqSchema = z.object({
  turnstileToken: z.string().min(1),
  files: z
    .array(
      z.object({
        fileName: z.string().min(1).max(200),
        mimeType: z.string().min(1).max(120),
        sizeBytes: z.number().int().min(0).max(MAX_BYTES),
      }),
    )
    .min(1)
    .max(10),
});

function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? '127.0.0.1';
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const limiterRes = await presignLimiter.limit(`presign:${ip}`);
  if (!limiterRes.success) {
    return NextResponse.json(
      { error: 'Túl sok presign-kérés egy órán belül.' },
      { status: 429 },
    );
  }

  const json = await req.json().catch(() => ({}));
  const parsed = reqSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'érvénytelen presign kérelem' }, { status: 400 });
  }

  const verify = await verifyTurnstile(parsed.data.turnstileToken, ip);
  if (!verify.success) {
    return NextResponse.json(
      { error: `Turnstile elutasítva: ${verify.reason}` },
      { status: 403 },
    );
  }

  const policies = [];
  for (const f of parsed.data.files) {
    if (!ALLOWED_SUBMISSION_MIME.has(f.mimeType)) {
      return NextResponse.json(
        { error: `nem támogatott fájltípus: ${f.mimeType}` },
        { status: 400 },
      );
    }
    const policy = await createSubmissionUploadUrl({
      bucket: process.env.SUPABASE_STORAGE_BUCKET_SUBMISSIONS ?? 'submissions',
      fileName: f.fileName,
      mimeType: f.mimeType,
      sizeBytes: f.sizeBytes,
    });
    policies.push({ ...policy, fileName: f.fileName, mimeType: f.mimeType });
  }

  return NextResponse.json({ policies }, { headers: { 'Cache-Control': 'no-store' } });
}
