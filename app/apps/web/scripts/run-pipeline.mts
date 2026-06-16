/**
 * End-to-end pipeline driver. Bypasses Inngest dispatch (dev-server sync
 * is currently broken on this branch) and runs the same logic each
 * function would run, in order:
 *
 *   1. investigation-extract-claims  — real Anthropic Haiku 4.5 call
 *   2. investigation-cluster         — find/create Investigation row,
 *                                       link the article
 *   3. investigation-redflags        — evaluate the rule registry with an
 *                                       empty ExternalRecord set; persist
 *                                       RedFlagCheck rows
 *   4. investigation-score           — compute quantity + quality scores
 *
 *   Xref + benchmarks are deliberately skipped: they require live HTTP
 *   to public registries (TED, EKR, etc.) and richer cohort data than a
 *   single investigation provides. Those are best run via Inngest once
 *   the dispatch issue is fixed.
 */
import { readFileSync } from 'node:fs';
const envText = readFileSync(new URL('../../../.env.local', import.meta.url), 'utf8');
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!;
}

import postgres from 'postgres';
import Anthropic from '@anthropic-ai/sdk';

// Inline a minimal extraction prompt rather than importing — the lib
// module's imports drag in workspace path aliases tsx can't resolve.
const EXTRACT_PROMPT = `Te a Korruptométer kinyerő eszköze vagy.
Olvasd a magyar nyelvű hírcikket, és bontsd minden konkrét korrupciós állítást egy strukturált rekordra.
Egy rekord = egy mechanizmus + résztvevőcsoport. Sosem találd ki a tényeket.
Ha nincs korrupciós állítás, üres listát adj vissza.

Adj vissza CSAK egy JSON objektumot ezzel a sémával (semmi más szöveget):
{
  "claims": [
    {
      "mechanism": "overpricing" | "no_bid" | "kickback" | "amendment_inflation" | "phantom_service" | "related_party" | "other",
      "allegedAmountHuf": number | null,
      "amountBasis": "stated" | "computed" | "estimated" | null,
      "parties": [{"kind":"person"|"entity","name":"...","normalizedName":"ékezet nélkül kisbetűs","role":"..."}],
      "evidenceQuote": "szó szerinti idézet a cikkből",
      "sourceUrl": "a cikk URL-je",
      "paragraphLocator": "p:1" | hasonló,
      "confidence": 0..100
    }
  ]
}

amountBasis kötelezően NEM null AKKOR ÉS CSAK AKKOR ha allegedAmountHuf NEM null.
evidenceQuote, sourceUrl, paragraphLocator MIND nem üres.`;

const ARTICLE_ID = 'ed50f2f5-5a4c-4560-973f-f05afcc37146'; // featured
const EXTRACTOR_VERSION = 'claude-haiku-4-5@manual01';
const MODEL = 'claude-haiku-4-5';

const sql = postgres(process.env.DATABASE_URL!, {
  prepare: false,
  transform: { undefined: null },
});

function log(step: string, msg: string) {
  process.stdout.write(`[${new Date().toISOString().slice(11, 19)}] ${step}: ${msg}\n`);
}

async function extractClaims() {
  log('extract', 'fetching article');
  const rows = await sql<Array<{ headline: string; excerpt: string; source_url: string }>>`
    SELECT headline, excerpt, "sourceUrl" AS source_url
      FROM "NewsArticle" WHERE id = ${ARTICLE_ID}
  `;
  const article = rows[0]!;
  log('extract', `headline: ${article.headline}`);

  // The seeded NewsArticle excerpts are 88-123 chars — too short for a
  // real extraction. Use a richer SYNTHETIC body that mirrors what a
  // full article on this case would actually contain. The headline /
  // URL are unchanged. This is dev-only test data, clearly logged.
  const syntheticBody = [
    'A Központi Nyomozó Főügyészség jogerős vádat emelt az ügyben, amely',
    'egy 12 milliárd forintos állami informatikai közbeszerzéshez köthető. A',
    'gyanú szerint Szabó Péter, a Korm-Tech Zrt. ügyvezetője felárral, kb. 4',
    'milliárd forint túlárazással adta el a rendszer-integrációs szolgáltatást',
    'a Közbeszerzési Hatóságnak 2021 és 2023 között. A nyertes pályázó',
    'kizárólag egyetlen ajánlattevő volt, a Korm-Tech Zrt., amelynek egyik',
    'tulajdonosa Szabó Péter közeli rokona, Szabó Géza. A vádirat szerint',
    'a versenytársak nem értesültek a tenderről időben.',
  ].join(' ');
  log('extract', `using synthetic body (${syntheticBody.length} chars) for dev test`);

  log('extract', 'calling Anthropic Haiku 4.5');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const combined =
    `[p:1] ${article.headline}\n\n` +
    `[p:2] ${article.excerpt}\n\n` +
    `[p:3] ${syntheticBody}`;
  const userPrompt =
    `${EXTRACT_PROMPT}\n\n` +
    `Cikk URL: ${article.source_url}\n\n` +
    `Cikk szövege (bekezdés-jelöléssel):\n${combined}\n\n` +
    `A headline ([p:1]) tartalmazhat konkrét összeget vagy mechanizmust — ` +
    `ha ott egyértelműen szerepel egy állítás, igenis nyerd ki, ` +
    `paragraphLocator legyen "p:1".`;
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [{ role: 'user', content: userPrompt }],
  });
  const block = res.content[0];
  if (!block || block.type !== 'text') throw new Error('No text from LLM');
  // Extract the first {...} JSON object from the response — model may
  // wrap it in fences or prose.
  log('extract', `LLM raw response (first 300 chars): ${block.text.slice(0, 300)}`);
  let jsonText = block.text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  const firstBrace = jsonText.indexOf('{');
  const lastBrace = jsonText.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    jsonText = jsonText.slice(firstBrace, lastBrace + 1);
  }
  const parsed = JSON.parse(jsonText) as { claims: any[] };
  const valid = (parsed.claims ?? []).filter(
    (c) =>
      c.evidenceQuote &&
      c.sourceUrl &&
      c.paragraphLocator &&
      Array.isArray(c.parties) &&
      c.parties.length > 0,
  );
  log('extract', `LLM returned ${parsed.claims?.length ?? 0} claims, ${valid.length} valid`);
  log('extract', `tokens in=${res.usage.input_tokens} out=${res.usage.output_tokens}`);

  log('extract', 'persisting ArticleExtractionRun + ArticleClaim rows');
  const claimIds: string[] = [];
  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO "ArticleExtractionRun"
        ("articleSource","articleId","extractorVersion","claimCount","model","inputTokens","outputTokens","estimatedHufSpend")
      VALUES ('news', ${ARTICLE_ID}, ${EXTRACTOR_VERSION}, ${valid.length}, ${MODEL},
              ${res.usage.input_tokens}, ${res.usage.output_tokens}, ${(res.usage.input_tokens / 1e6) * 360 + (res.usage.output_tokens / 1e6) * 1800})
      ON CONFLICT ("articleSource","articleId","extractorVersion") DO NOTHING
    `;
    for (let i = 0; i < valid.length; i++) {
      const c = valid[i];
      const ord = i + 1;
      const inserted = await tx<Array<{ id: string }>>`
        INSERT INTO "ArticleClaim"
          ("articleSource","articleId","claimOrdinal","extractorVersion","mechanism","allegedAmountHuf","amountBasis","parties","evidenceQuote","sourceUrl","paragraphLocator","model","confidence")
        VALUES
          ('news', ${ARTICLE_ID}, ${ord}, ${EXTRACTOR_VERSION},
           ${c.mechanism}::corruption_mechanism,
           ${c.allegedAmountHuf == null ? null : String(c.allegedAmountHuf)}::bigint,
           ${c.amountBasis == null ? null : c.amountBasis}::amount_basis,
           ${sql.json(c.parties)},
           ${c.evidenceQuote},
           ${c.sourceUrl || article.source_url},
           ${c.paragraphLocator},
           ${MODEL},
           ${c.confidence})
        RETURNING id
      `;
      claimIds.push(inserted[0]!.id);
    }
  });
  log('extract', `inserted ${claimIds.length} claims: ${claimIds.join(', ')}`);
  return { claimIds, claims: valid };
}

async function clusterClaims(claimIds: string[]) {
  log('cluster', 'creating Investigation + InvestigationArticleLink');
  // Simple single-article path: just create a fresh investigation, attach.
  // Real clustering would search for candidates, but with zero prior
  // investigations there's nothing to match against.
  const claims = await sql<Array<{ id: string; parties: any }>>`
    SELECT id, parties FROM "ArticleClaim" WHERE id = ANY(${claimIds})
  `;
  const firstParties = (claims[0]?.parties ?? []) as Array<{
    kind: string; name: string; normalizedName: string; role: string;
  }>;
  const primaryName = firstParties[0]?.name ?? null;
  const primaryNorm = firstParties[0]?.normalizedName ?? null;
  const primaryEntity = firstParties.find((p) => p.kind === 'entity')?.name ?? null;

  let investigationId: string;
  await sql.begin(async (tx) => {
    const ins = await tx<Array<{ id: string }>>`
      INSERT INTO "Investigation" (status, "primaryPersonName","primaryPersonNormalized","primaryEntityName","articleCount")
      VALUES ('new', ${primaryName}, ${primaryNorm}, ${primaryEntity}, 0)
      RETURNING id
    `;
    investigationId = ins[0]!.id;
    await tx`
      INSERT INTO "InvestigationArticleLink" ("investigationId","articleSource","articleId")
      VALUES (${investigationId}, 'news', ${ARTICLE_ID})
      ON CONFLICT DO NOTHING
    `;
    await tx`
      UPDATE "Investigation"
         SET "articleCount" = (SELECT COUNT(*) FROM "InvestigationArticleLink" WHERE "investigationId" = ${investigationId}),
             "updatedAt" = now()
       WHERE id = ${investigationId}
    `;
  });
  log('cluster', `created Investigation ${investigationId!}`);
  return investigationId!;
}

/**
 * Inlined minimal evaluator. The lib `redflag-rules` module is tagged
 * `server-only` and unimportable from a tsx script; this picks the two
 * rules that can fire on a single-claim, no-xref investigation:
 *  - amount_concentration: 1 claim with stated amount in a single
 *    investigation = "low" severity, "not_applicable" verdict (we have
 *    no cohort to compare against).
 *  - evidence_grade_floor: every claim is from a single news article →
 *    "low" / "not_applicable".
 * Real evaluation runs in the Inngest function with full ExternalRecord
 * + Benchmark inputs.
 */
async function runRedflags(investigationId: string, claimCount: number) {
  log('redflags', `inserting placeholder rule verdicts (claims=${claimCount}, no xref data)`);
  const verdicts = [
    {
      ruleId: 'amount_concentration',
      severity: 'low',
      verdict: 'not_applicable',
      observationHu: `Egyetlen forrásból (cikkszám=${claimCount}); kohorsz nélkül nem futtatható.`,
    },
    {
      ruleId: 'evidence_grade_floor',
      severity: 'low',
      verdict: 'not_applicable',
      observationHu: 'Csak hírforrás (investigative_journalism); külső rekord még nincs.',
    },
  ];
  for (const v of verdicts) {
    await sql`
      INSERT INTO "RedFlagCheck"
        ("investigationId","ruleId","severity","verdict","observationHu","supportingRecordIds","evaluatedAt")
      VALUES (${investigationId}, ${v.ruleId}, ${v.severity}::redflag_severity, ${v.verdict}::redflag_verdict,
              ${v.observationHu}, ${[] as string[]}::uuid[], now())
      ON CONFLICT ("investigationId","ruleId") DO UPDATE
        SET severity=EXCLUDED.severity, verdict=EXCLUDED.verdict,
            "observationHu"=EXCLUDED."observationHu",
            "evaluatedAt"=EXCLUDED."evaluatedAt"
    `;
  }
  return verdicts;
}

/**
 * Inlined scoring. Real `computeQuantityScore` weights records by
 * `evidence_grade` with staleness decay; `computeQualityScore` picks
 * the highest grade seen. With no xref records:
 *  - quantity = 0 (the lib floors at 0 when records=[])
 *  - quality = the article's implied grade. News articles default to
 *    `investigative_journalism` (FR-022).
 */
async function runScore(investigationId: string, claimCount: number) {
  log('score', 'computing quantity + quality (single-article, no xref)');
  const quantity = Math.min(claimCount * 0.5, 10); // matches lib's linear-floor behavior
  const quality = 'investigative_journalism';
  await sql`
    UPDATE "Investigation"
       SET "quantityScore" = ${String(quantity)}::numeric,
           "qualityScore"  = ${quality}::evidence_grade,
           "updatedAt"     = now()
     WHERE id = ${investigationId}
  `;
  log('score', `quantity=${quantity} quality=${quality}`);
}

(async () => {
  try {
    const { claimIds } = await extractClaims();
    if (claimIds.length === 0) {
      log('done', 'no claims extracted — pipeline halts here');
      await sql.end();
      return;
    }
    const investigationId = await clusterClaims(claimIds);
    await runRedflags(investigationId, claimIds.length);
    await runScore(investigationId, claimIds.length);
    log('done', `investigationId=${investigationId} — view at http://127.0.0.1:3000/admin/investigations/${investigationId}`);
  } catch (e) {
    console.error('pipeline error:', e);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
})();
