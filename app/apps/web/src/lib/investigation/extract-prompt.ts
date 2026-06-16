import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

import {
  EXTRACT_PROMPT_TEMPLATE,
  EXTRACT_JSON_SCHEMA,
} from './extract-prompt-spec';
import type { CorruptionMechanism, AmountBasis, Party } from '@korr/shared';

export type ExtractedClaim = {
  mechanism: CorruptionMechanism;
  allegedAmountHuf: number | null;
  amountBasis: AmountBasis | null;
  parties: Party[];
  evidenceQuote: string;
  sourceUrl: string;
  paragraphLocator: string;
  confidence: number;
};

export type ExtractResult = {
  claims: ExtractedClaim[];
  inputTokens: number;
  outputTokens: number;
  model: string;
};

export type ExtractArticleInput = {
  headline: string;
  body: string;
  sourceUrl: string;
};

const FENCES = /^```(?:json)?\s*|\s*```$/g;

function parseJsonResponse(text: string): { claims: ExtractedClaim[] } {
  const cleaned = text.trim().replace(FENCES, '');
  return JSON.parse(cleaned) as { claims: ExtractedClaim[] };
}

/**
 * Call Anthropic with structured output to extract atomic corruption
 * claims from a single article (research.md §1). Returns the parsed
 * claims and the token counts so the caller can persist
 * `ArticleExtractionRun` + `DailyLlmUsage` in the same transaction
 * (FR-005, FR-007).
 *
 * The function does NOT enforce the daily-ceiling kill switch; that is
 * the caller's responsibility before invoking this. The function also
 * does NOT write to the database — the Inngest function in
 * `inngest/functions/investigation-extract-claims.ts` owns the
 * persistence step so it can wrap the writes in a single Postgres txn.
 */
export async function extractClaimsFromArticle(
  client: Anthropic,
  article: ExtractArticleInput,
): Promise<ExtractResult> {
  const model =
    process.env.INVESTIGATION_EXTRACTOR_MODEL ?? 'claude-haiku-4-5';
  const trimmedBody = article.body.slice(0, 12_000);

  const userPrompt = `${EXTRACT_PROMPT_TEMPLATE}

Cikk forrásURL: ${article.sourceUrl}
Cikk címe: ${article.headline}

CIKK SZÖVEG:
${trimmedBody}

KIMENET (csak JSON, semmi más):
JSON séma:
${JSON.stringify(EXTRACT_JSON_SCHEMA)}`;

  const res = await client.messages.create({
    model,
    max_tokens: 4096,
    system:
      'Te a Korruptométer kinyerő motorja vagy. Strict JSON-t adsz vissza, '
      + 'pontosan a megadott séma szerint, semmi mást. Soha ne találd ki a tényeket.',
    messages: [{ role: 'user', content: userPrompt }],
  });

  const block = res.content[0];
  if (!block || block.type !== 'text') {
    return {
      claims: [],
      inputTokens: res.usage?.input_tokens ?? 0,
      outputTokens: res.usage?.output_tokens ?? 0,
      model,
    };
  }

  let parsed: { claims: ExtractedClaim[] };
  try {
    parsed = parseJsonResponse(block.text);
  } catch {
    return {
      claims: [],
      inputTokens: res.usage?.input_tokens ?? 0,
      outputTokens: res.usage?.output_tokens ?? 0,
      model,
    };
  }

  // FR-036 server-side validator: reject any claim missing the three
  // re-verifiability fields. The schema CHECK enforces this at write
  // time too, but rejecting here keeps the audit trail clean.
  const valid = (parsed.claims ?? []).filter(
    (c) =>
      c
      && typeof c.evidenceQuote === 'string'
      && c.evidenceQuote.length > 0
      && typeof c.sourceUrl === 'string'
      && c.sourceUrl.length > 0
      && typeof c.paragraphLocator === 'string'
      && c.paragraphLocator.length > 0
      && Array.isArray(c.parties)
      && c.parties.length > 0,
  );

  // Paired-nullability normalization: if the model returned an amount
  // without a basis, drop the amount; if it returned a basis without an
  // amount, null the basis.
  const normalized = valid.map((c) => {
    const amount = c.allegedAmountHuf;
    const basis = c.amountBasis;
    if (amount == null || basis == null) {
      return { ...c, allegedAmountHuf: null, amountBasis: null };
    }
    return c;
  });

  return {
    claims: normalized,
    inputTokens: res.usage?.input_tokens ?? 0,
    outputTokens: res.usage?.output_tokens ?? 0,
    model,
  };
}
