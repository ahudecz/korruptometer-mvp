import { z } from 'zod';

const optionalNonEmpty = z.string().trim().min(1).max(200).optional().or(z.literal(''));

export const submissionInputSchema = z.object({
  suspectName: z.string().trim().min(2).max(200),
  suspectPosition: optionalNonEmpty,
  suspectRegion: optionalNonEmpty,
  period: optionalNonEmpty,
  crimes: z.array(z.string().trim().min(2).max(80)).min(1).max(10),
  estimatedAmount: z
    .union([z.coerce.number().int().min(0), z.literal('')])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : Number(v))),
  summary: z.string().trim().min(20).max(8000),
  sourceUrls: z.array(z.string().url()).max(10).default([]),
  anonymous: z.coerce.boolean().default(true),
  allowContact: z.coerce.boolean().default(false),
  reporterEmail: z.string().email().optional().or(z.literal('')),
  reporterName: z.string().trim().max(200).optional().or(z.literal('')),
  attachments: z
    .array(
      z.object({
        storageKey: z.string().min(3),
        fileName: z.string().min(1).max(255),
        mimeType: z.string().min(3).max(150),
        sizeBytes: z.coerce.number().int().min(1).max(25 * 1024 * 1024),
      }),
    )
    .max(10)
    .default([]),
  // Phase 4 (sealed-box) opaque blobs — populated only when flag is on.
  bodyCipher: z.string().min(1).optional(),
  reporterEmailCipher: z.string().min(1).optional(),
  reporterNameCipher: z.string().min(1).optional(),
  recipientFingerprints: z.array(z.string()).optional(),
  // Cloudflare Turnstile token (verified server-side).
  turnstileToken: z.string().min(1).optional(),
});

export type SubmissionInput = z.infer<typeof submissionInputSchema>;
