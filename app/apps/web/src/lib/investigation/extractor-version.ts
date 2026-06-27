import 'server-only';
import { createHash } from 'node:crypto';

import { EXTRACT_PROMPT_TEMPLATE, EXTRACT_JSON_SCHEMA } from './extract-prompt-spec';

/**
 * Build-time extractor version: `{model}@{promptHash8}`.
 *
 * The hash is a stable sha256 over the prompt template + the JSON schema
 * (and the prompt-version env var). Bumping any of these produces a fresh
 * version, which (a) becomes part of the `(articleSource, articleId,
 * extractorVersion)` idempotency key (FR-002 / research.md §1), and (b)
 * lets the article admin viewer render a side-by-side diff when an
 * editor bumps `INVESTIGATION_EXTRACTOR_PROMPT_VERSION` (FR-003).
 */
export function computeExtractorVersion(): string {
  const model = process.env.INVESTIGATION_EXTRACTOR_MODEL ?? 'claude-haiku-4-5';
  const promptVersion = process.env.INVESTIGATION_EXTRACTOR_PROMPT_VERSION ?? 'v1';
  const payload = JSON.stringify({
    model,
    promptVersion,
    template: EXTRACT_PROMPT_TEMPLATE,
    schema: EXTRACT_JSON_SCHEMA,
  });
  const hash8 = createHash('sha256').update(payload).digest('hex').slice(0, 8);
  return `${model}@${hash8}`;
}

let cached: string | null = null;
export function getExtractorVersion(): string {
  if (cached) return cached;
  cached = computeExtractorVersion();
  return cached;
}
