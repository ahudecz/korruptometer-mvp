/**
 * Case Catalog — deterministic bootstrap (Phase 3/4).
 *
 * Turns a pilot slice of the K-Monitor corpus into classified, de-duplicated
 * cases (Investigation rows) WITHOUT any LLM call, using the metadata K-Monitor
 * already carries (topics, institutions, persons, amount, pubTime).
 *
 * Pipeline:
 *   1. Offence type (Axis 1)   — article.topics ∩ OffenceTypeRef.kmonitorTopics.
 *   2. Procedural stage (5)    — title/topic phrase heuristics, most-advanced wins.
 *   3. Authority + tier (4)    — deterministic rules (EU-fund→OLAF, közbeszerzés
 *                                →Integrity Authority, verdict→court, else prosecution).
 *   4. Entity resolution       — primary person (highest mentionCount on the
 *                                article) + primary institution, normalized.
 *   5. canonicalCaseKey        — sha256(person|institution|primaryOffence|amountMag).
 *                                Same key ⇒ same case (idempotent, no duplicates);
 *                                key composition biases toward UNDER-merging.
 *
 * Re-runnable: drops its own prior output (caseKeySource LIKE 'kmonitor_%')
 * inside one transaction, then rebuilds. Never touches investigations created by
 * the LLM clustering engine (those have a null caseKeySource).
 *
 * Usage: pnpm --filter @korr/db tsx src/catalog-bootstrap.ts
 */
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

import postgres from 'postgres';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL not set');

const sql = postgres(DB_URL, { prepare: false, max: 1 });

const PILOT_FROM = '2024-01-01';
const MIN_AMOUNT_HUF = 100_000_000; // material threshold — drop extremely small amounts

// ── helpers ──────────────────────────────────────────────────────────────────
function norm(s: string | null | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .replace(/\s+/g, ' ')
    .trim();
}

const STAGE_RANK = [
  'reported',
  'investigating',
  'suspect_charged',
  'indicted',
  'on_trial',
  'verdict_first_instance',
  'final_verdict',
] as const;
type Stage = (typeof STAGE_RANK)[number];

function stageFromText(title: string, topics: string[]): Stage {
  const t = norm(title);
  const hasTopic = (x: string) => topics.some((tp) => norm(tp).includes(norm(x)));
  if (/jogeros|jogerosen/.test(t)) return 'final_verdict';
  if (/itelet|elitel|felment|birosag dontott/.test(t) || hasTopic('ítélet/döntés'))
    return 'verdict_first_instance';
  if (/vadat emel|vademel|vad ala/.test(t)) return 'indicted';
  if (/gyanusit|orizetbe|elfogt/.test(t)) return 'suspect_charged';
  if (/nyomoz|vizsgal|feljelent/.test(t)) return 'investigating';
  return 'reported';
}

function mostAdvanced(a: Stage, b: Stage): Stage {
  return STAGE_RANK.indexOf(a) >= STAGE_RANK.indexOf(b) ? a : b;
}

function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const m = Math.floor(n / 2);
  return n % 2 ? sorted[m]! : Math.round((sorted[m - 1]! + sorted[m]!) / 2);
}

function authorityFor(topics: string[], stage: Stage): string {
  const has = (x: string) => topics.some((tp) => norm(tp).includes(norm(x)));
  if (has('eu') || has('támogatás') || has('pályázat')) return 'olaf';
  if (stage === 'verdict_first_instance' || stage === 'final_verdict') return 'court';
  if (has('közbeszerzés')) return 'integrity_authority';
  return 'prosecution';
}

// ── main ───────────────────────────────────────────────────────────────────
async function main() {
  // 1. controlled vocabulary: topic → offence code, + per-code metadata
  const offenceRows = await sql<
    {
      code: string;
      labelHu: string;
      matterTierDefault: string;
      kmonitorTopics: string[];
      sortOrder: number;
    }[]
  >`SELECT code, "labelHu", "matterTierDefault", "kmonitorTopics", "sortOrder" FROM "OffenceTypeRef" ORDER BY "sortOrder"`;

  const topicToCode = new Map<string, string>();
  const codeMeta = new Map<string, { tier: string; sort: number; label: string }>();
  for (const r of offenceRows) {
    codeMeta.set(r.code, { tier: r.matterTierDefault, sort: r.sortOrder, label: r.labelHu });
    for (const tp of r.kmonitorTopics) topicToCode.set(norm(tp), r.code);
  }

  // 2. pilot articles
  const articles = await sql<
    {
      newsId: number;
      title: string;
      topics: string[] | null;
      institutions: string[] | null;
      amountHuf: string | null;
      pubTime: Date;
      sourceUrl: string;
    }[]
  >`
    SELECT "newsId", title, topics, institutions, "amountHuf", "pubTime", "sourceUrl"
    FROM "KMonitorArticle"
    WHERE "pubTime" >= ${PILOT_FROM} AND "amountHuf" >= ${MIN_AMOUNT_HUF}
  `;
  console.log(`pilot articles: ${articles.length}`);

  const ids = articles.map((a) => a.newsId);

  // 3. persons per article (primary = highest mentionCount)
  const personRows = await sql<
    { newsId: number; displayName: string; normalizedName: string; mentionCount: number }[]
  >`
    SELECT pa."newsId", c."displayName", c."normalizedName", c."mentionCount"
    FROM "KMonitorPersonArticle" pa
    JOIN "KMonitorPersonCandidate" c ON c.id = pa."personId"
    WHERE pa."newsId" = ANY(${sql.array(ids)}::int[])
  `;
  // per-article amount (K-Monitor's "largest HUF figure mentioned" heuristic —
  // noisy, treated as a rough magnitude only, see damage estimate below)
  const amountByArticle = new Map<number, number>();
  for (const a of articles) {
    if (a.amountHuf != null) amountByArticle.set(a.newsId, Number(a.amountHuf));
  }

  const personByArticle = new Map<number, { displayName: string; normalizedName: string }>();
  const bestMention = new Map<number, number>();
  for (const p of personRows) {
    const prev = bestMention.get(p.newsId) ?? -1;
    if (p.mentionCount > prev) {
      bestMention.set(p.newsId, p.mentionCount);
      personByArticle.set(p.newsId, {
        displayName: p.displayName,
        normalizedName: p.normalizedName,
      });
    }
  }

  // 4. classify each article + assign canonical case key
  type Cls = {
    newsId: number;
    key: string;
    keySource: string;
    personName: string | null;
    personNorm: string | null;
    instName: string | null;
    instNorm: string | null;
    offences: string[];
    stage: Stage;
    authority: string;
    tier: string;
  };

  const classified: Cls[] = articles.map((a) => {
    const topics = a.topics ?? [];
    const offences = [
      ...new Set(
        topics
          .map((t) => topicToCode.get(norm(t)))
          .filter((c): c is string => Boolean(c)),
      ),
    ].sort((x, y) => (codeMeta.get(x)!.sort - codeMeta.get(y)!.sort));
    const stage = stageFromText(a.title, topics);
    const authority = authorityFor(topics, stage);
    const tier = offences[0] ? codeMeta.get(offences[0])!.tier : 'unknown';

    const person = personByArticle.get(a.newsId) ?? null;
    const inst = (a.institutions ?? [])[0] ?? null;
    const personNorm = person ? person.normalizedName : null;
    const instNorm = inst ? norm(inst) : null;

    // key composition — identity = WHO + transaction-counterparty + offence.
    // Person alone over-merges prolific figures (one oligarch's whole year of
    // coverage collapses into a single blob), so the institution acts as the
    // transaction splitter (the proxy for "which case", standing in for the
    // court/procurement ID we lack in K-Monitor). Amount/time stay OUT of the
    // key (they vary within a case). person+institution+offence is the anchor;
    // person-only or institution-only is a weaker, flagged fallback.
    // Offence is an AGGREGATED attribute of the case (multi-valued), not a key
    // component — the same matter is often reported under several offences and
    // must not split. The case grain is WHO + transaction-counterparty.
    let keyParts: string[];
    let keySource: string;
    if (personNorm && instNorm) {
      keyParts = ['pi', personNorm, instNorm];
      keySource = 'kmonitor_bootstrap';
    } else if (personNorm) {
      keyParts = ['p', personNorm];
      keySource = 'kmonitor_weak_person';
    } else if (instNorm) {
      keyParts = ['i', instNorm];
      keySource = 'kmonitor_weak_inst';
    } else {
      // too little identity to cluster safely → singleton, flagged for review
      keyParts = ['article', String(a.newsId)];
      keySource = 'kmonitor_singleton';
    }
    const key = createHash('sha256').update(keyParts.join('|')).digest('hex').slice(0, 32);

    return {
      newsId: a.newsId,
      key,
      keySource,
      personName: person?.displayName ?? null,
      personNorm,
      instName: inst,
      instNorm,
      offences,
      stage,
      authority,
      tier,
    };
  });

  // 5. group into cases
  type Case = {
    key: string;
    keySource: string;
    personName: string | null;
    personNorm: string | null;
    instName: string | null;
    instNorm: string | null;
    offences: Set<string>;
    stage: Stage;
    authority: string;
    tier: string;
    newsIds: number[];
  };
  const cases = new Map<string, Case>();
  for (const c of classified) {
    let g = cases.get(c.key);
    if (!g) {
      g = {
        key: c.key,
        keySource: c.keySource,
        personName: c.personName,
        personNorm: c.personNorm,
        instName: c.instName,
        instNorm: c.instNorm,
        offences: new Set(c.offences),
        stage: c.stage,
        authority: c.authority,
        tier: c.tier,
        newsIds: [],
      };
      cases.set(c.key, g);
    }
    c.offences.forEach((o) => g!.offences.add(o));
    g.stage = mostAdvanced(g.stage, c.stage);
    g.newsIds.push(c.newsId);
  }
  console.log(`distinct cases: ${cases.size}  (dedup ratio ${(articles.length / cases.size).toFixed(2)}x)`);

  // qualityScore by stage; authority/tier recomputed from final stage
  const qualityFor = (stage: Stage): string =>
    stage === 'final_verdict' || stage === 'verdict_first_instance'
      ? 'court_document'
      : stage === 'indicted'
        ? 'prosecutor_statement'
        : 'investigative_journalism';

  // 6. rebuild transactionally
  await sql.begin(async (tx) => {
    const prior = await tx`
      DELETE FROM "Investigation" WHERE "caseKeySource" LIKE 'kmonitor_%' RETURNING id
    `;
    console.log(`cleared ${prior.length} prior bootstrap cases`);

    let created = 0;
    for (const g of cases.values()) {
      const offenceArr = [...g.offences];
      const stage = g.stage;
      // court takes over once a verdict stage is reached, regardless of per-article authority
      const authority =
        stage === 'verdict_first_instance' || stage === 'final_verdict'
          ? 'court'
          : g.authority;
      const summary = `${g.personName ?? g.instName ?? 'ismeretlen'} — ${
        offenceArr.map((o) => codeMeta.get(o)?.label ?? o).join(', ') || 'besorolatlan'
      } (${g.newsIds.length} cikk)`;

      const [inv] = await tx<{ id: string }[]>`
        INSERT INTO "Investigation"
          (status, "primaryPersonName", "primaryPersonNormalized",
           "primaryEntityName", "primaryEntityNormalized", summary,
           "qualityScore", "disclosureTier", "articleCount",
           "offenceTypes", "proceduralStage", "competentAuthority", "matterTier",
           "canonicalCaseKey", "caseKeySource")
        VALUES
          ('new', ${g.personName}, ${g.personNorm},
           ${g.instName}, ${g.instNorm}, ${summary},
           ${qualityFor(stage)}::evidence_grade, 'internal', ${g.newsIds.length},
           ${offenceArr}::text[], ${stage}::procedural_stage,
           ${authority}::competent_authority, ${g.tier}::matter_tier,
           ${g.key}, ${g.keySource})
        RETURNING id
      `;
      if (!inv) throw new Error('investigation insert returned no row');
      created++;

      // damage estimate — rough magnitude from per-article K-Monitor amounts.
      // low = median (robust to the single-largest-figure outliers), high = max.
      // confidence='low': these are "largest figure mentioned", not adjudicated
      // damage; the precise per-claim alleged amount comes from the LLM layer.
      const amounts = g.newsIds
        .map((n) => amountByArticle.get(n))
        .filter((x): x is number => x != null)
        .sort((a, b) => a - b);
      if (amounts.length) {
        const lowHuf = median(amounts);
        const highHuf = amounts[amounts.length - 1]!;
        const inputsHash = createHash('sha256')
          .update(g.newsIds.slice().sort((a, b) => a - b).join(','))
          .digest('hex');
        const components = [
          {
            mechanism: 'other',
            lowHuf,
            highHuf,
            method: 'claim_consolidation',
            inputs: { articleCount: amounts.length, source: 'kmonitor_amount_regex' },
            formula: 'low = median, high = max of per-article K-Monitor amounts',
            citation: null,
            notes:
              'Hozzávetőleges nagyságrend; K-Monitor regex-szel kinyert "legnagyobb említett összeg" alapján, alacsony megbízhatóság.',
          },
        ];
        await tx`
          INSERT INTO "DamageEstimate"
            ("investigationId", "totalLowHuf", "totalHighHuf", confidence, components, "inputsHash")
          VALUES (${inv.id}, ${lowHuf}, ${highHuf}, 'low',
                  ${sql.json(components)}, ${inputsHash})
        `;
      }

      // link articles (idempotent composite PK)
      for (const newsId of g.newsIds) {
        await tx`
          INSERT INTO "InvestigationArticleLink" ("investigationId", "articleSource", "articleId", role)
          VALUES (${inv.id}, 'kmonitor', ${String(newsId)}, 'primary')
          ON CONFLICT DO NOTHING
        `;
      }
    }
    console.log(`created ${created} cases, linked ${classified.length} articles`);
  });

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
