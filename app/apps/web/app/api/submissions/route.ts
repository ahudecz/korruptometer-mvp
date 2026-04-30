import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';

import { encryptPii } from '@korr/shared/encryption';
import { submissionMinuteLimiter, submissionDayLimiter } from '@korr/shared/ratelimit';
import { submissionInputSchema } from '@korr/shared/schemas/submission';
import { verifyTurnstile } from '@korr/shared/turnstile';

import { getDb, schema } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_MIME = new Set([
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
const MAX_BYTES = 25 * 1024 * 1024;
const MAX_ATTACHMENTS = 10;

const UPLOAD_ROOT = process.env.SUBMISSION_UPLOAD_ROOT ?? '/tmp/korr-uploads';

function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? '127.0.0.1';
}

function makeRef(): string {
  const random = randomBytes(3).toString('hex').toUpperCase();
  return `KM-NEW-${random}`;
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const minLimiter = submissionMinuteLimiter();
  const dayLimiter = submissionDayLimiter();
  const minRes = await minLimiter.limit(`subm-min:${ip}`);
  if (!minRes.success) {
    return NextResponse.json(
      { error: 'Túl sok bejelentés ugyanarról az IP-ről egy percen belül.' },
      { status: 429 },
    );
  }
  const dayRes = await dayLimiter.limit(`subm-day:${ip}`);
  if (!dayRes.success) {
    return NextResponse.json(
      { error: 'Napi bejelentés-limit elérve. Próbáld újra holnap.' },
      { status: 429 },
    );
  }

  const contentType = req.headers.get('content-type') ?? '';
  let parsedFields: Record<string, unknown> = {};
  let attachments: { storageKey: string; fileName: string; mimeType: string; sizeBytes: number; data: ArrayBuffer }[] = [];

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    parsedFields = Object.fromEntries(
      [...form.entries()].filter(([k]) => k !== 'files'),
    );
    if (typeof parsedFields.crimes === 'string') {
      parsedFields.crimes = (parsedFields.crimes as string)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (typeof parsedFields.sourceUrls === 'string') {
      parsedFields.sourceUrls = (parsedFields.sourceUrls as string)
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    parsedFields.attachments = [];
    const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length > MAX_ATTACHMENTS) {
      return NextResponse.json(
        { error: `Legfeljebb ${MAX_ATTACHMENTS} csatolmány engedélyezett.` },
        { status: 400 },
      );
    }
    for (const file of files) {
      if (!ALLOWED_MIME.has(file.type)) {
        return NextResponse.json(
          { error: `Nem támogatott fájltípus: ${file.type}` },
          { status: 400 },
        );
      }
      if (file.size > MAX_BYTES) {
        return NextResponse.json(
          { error: `Túl nagy fájl (max 25 MB): ${file.name}` },
          { status: 400 },
        );
      }
      attachments.push({
        storageKey: `submissions/${randomUUID()}/${file.name}`,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        data: await file.arrayBuffer(),
      });
    }
    parsedFields.attachments = attachments.map((a) => ({
      storageKey: a.storageKey,
      fileName: a.fileName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
    }));
  } else {
    parsedFields = await req.json().catch(() => ({}));
  }

  const parsed = submissionInputSchema.safeParse(parsedFields);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'érvénytelen adatok', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;

  // Cloudflare Turnstile (FR-028). Dev secret 1x… short-circuits.
  const turnstile = await verifyTurnstile(data.turnstileToken, ip);
  if (!turnstile.success) {
    return NextResponse.json(
      { error: 'Bot-ellenőrzés sikertelen. Frissítsd az oldalt és próbáld újra.' },
      { status: 400 },
    );
  }

  const db = getDb();
  const { submissions, submissionAttachments, auditLogs } = schema;

  const ref = makeRef();
  const sealedBoxOn = process.env.SUBMISSIONS_SEALED_BOX_ENABLED === 'true';

  // Mixed-format guard (FR-076 edge case "Reporter submits while flag flips").
  const sealedBoxFields = [
    data.bodyCipher,
    data.reporterEmailCipher,
    data.reporterNameCipher,
  ];
  const anySealed = sealedBoxFields.some((v) => v && v.length > 0);
  if (anySealed && !sealedBoxOn) {
    return NextResponse.json(
      { error: 'A sealed-box mód jelenleg ki van kapcsolva. Töltsd újra az oldalt.' },
      { status: 400 },
    );
  }

  const reporterEmail = (data.reporterEmail ?? '').trim();
  const reporterName = (data.reporterName ?? '').trim();

  const [insertedSubmission] = await db
    .insert(submissions)
    .values({
      ref,
      suspectName: data.suspectName,
      suspectPosition: data.suspectPosition || null,
      suspectRegion: data.suspectRegion || null,
      period: data.period || null,
      crimes: data.crimes,
      estimatedAmount:
        data.estimatedAmount !== null && data.estimatedAmount !== undefined
          ? BigInt(data.estimatedAmount)
          : null,
      summary: anySealed ? null : data.summary,
      sourceUrls: data.sourceUrls,
      anonymous: data.anonymous,
      allowContact: data.allowContact,
      reporterEmailEnc:
        data.allowContact && reporterEmail && !anySealed
          ? encryptPii(reporterEmail)
          : null,
      reporterNameEnc:
        data.allowContact && reporterName && !anySealed
          ? encryptPii(reporterName)
          : null,
      bodyCipher: data.bodyCipher ?? null,
      reporterEmailCipher: data.reporterEmailCipher ?? null,
      reporterNameCipher: data.reporterNameCipher ?? null,
      recipientFingerprints: data.recipientFingerprints ?? null,
    })
    .returning({ id: submissions.id });
  const submissionId = insertedSubmission!.id;

  if (attachments.length > 0) {
    await mkdir(join(UPLOAD_ROOT, submissionId), { recursive: true });
    for (const a of attachments) {
      const target = join(UPLOAD_ROOT, submissionId, a.fileName);
      await writeFile(target, Buffer.from(a.data));
      await db.insert(submissionAttachments).values({
        submissionId,
        storageKey: target,
        fileName: a.fileName,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        // Phase 2 stub: virus scan stays "pending" until an admin approves it.
        // Real Cloudmersive integration lands in T067 + T091; without an API key,
        // pending is an honest state per the spec's failure-mode contract.
        virusScanStatus: 'pending',
      });
    }
  }

  // Submission intake event log (T090). The same row pattern will become the
  // "submission.intake" Inngest event in T091; for now we just record it.
  await db.insert(auditLogs).values({
    actorEditorId: null,
    action: 'submission.received',
    entityType: 'Submission',
    entityId: submissionId,
    detail: { ref, attachmentCount: attachments.length, ip: 'redacted' },
  });

  return NextResponse.json({ ref, id: submissionId }, { status: 201 });
}
