/**
 * 003 financial-evidence layer — cross-reference cases to TED notices and
 * compute GROUNDED overpricing damage.
 *
 * Matches each catalog case to TED award notices by normalized core contractor
 * name (legal forms + consortium prefixes stripped). For matched contracts that
 * carry BOTH an awarded value and the authority's pre-tender estimate, the
 * documented overrun (awarded − estimate, when positive) is a grounded
 * overpricing signal. Stored as:
 *   • ExternalRecord links (case ↔ TED notice, auditable source), and
 *   • a DamageEstimate (method benchmark_deviation) citing each notice.
 * Confidence = 'medium': a documented overrun is a signal, not proven loss.
 * Cases with no matched overrun get NO figure — they stay "kár n/a".
 *
 * Usage: pnpm --filter @korr/db tsx src/ted-crossref-damage.ts
 */
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

import postgres from 'postgres';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL not set');
const sql = postgres(DB_URL, { prepare: false, max: 4 });

const LEGAL = /\b(kft|zrt|nyrt|bt|rt|zartkoruen mukodo reszvenytarsasag|korlatolt felelossegu tarsasag|reszvenytarsasag|altalanos|epitoipari|epito|ipari kereskedelmi es szolgaltato|kereskedelmi es szolgaltato|magyarorszag|holding|csoport)\b/g;
const PREFIX = /^(kozos ajanlattevok:?\s*)?(vezeto tag:?\s*)?(tag:?\s*)?/;

function core(name: string): string {
  return name
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/["()].*$/, '')
    .replace(PREFIX, '')
    .replace(LEGAL, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Match only on exact core, or when the SHORTER core is a multi-word
// word-boundary prefix of the longer (so "duna aszfalt" matches "duna aszfalt
// ut es melyepito", but a generic 1-word core like "market" never matches
// "market asset management").
function coreMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (shorter.split(' ').filter(Boolean).length < 2) return false;
  return longer.startsWith(shorter + ' ');
}

async function main() {
  // idempotent: clear this pass's prior outputs for bootstrap cases
  await sql`DELETE FROM "DamageEstimate" d USING "Investigation" i WHERE i.id=d."investigationId" AND i."caseKeySource" LIKE 'kmonitor_%'`;
  await sql`DELETE FROM "ExternalRecord" e USING "Investigation" i WHERE i.id=e."investigationId" AND i."caseKeySource" LIKE 'kmonitor_%' AND e."sourceSystem"='TED'`;
  const notices = await sql<{
    publicationNumber: string; contractors: string[]; valAwardedHuf: string | null;
    valEstimatedHuf: string | null; cpvMain: string | null; title: string | null; canonicalUrl: string;
  }[]>`
    SELECT "publicationNumber", contractors, "valAwardedHuf"::text, "valEstimatedHuf"::text,
           "cpvMain", title, "canonicalUrl"
    FROM "TedNotice" WHERE "valAwardedHuf" IS NOT NULL`;

  // core-name → notices index
  const byCore = new Map<string, (typeof notices)[number][]>();
  for (const n of notices)
    for (const c of n.contractors) {
      const k = core(c);
      if (k.length < 5) continue;
      (byCore.get(k) ?? byCore.set(k, []).get(k)!).push(n);
    }
  console.log(`${notices.length} TED notices with value · ${byCore.size} distinct contractor cores`);

  const cases = await sql<{ id: string; entity: string | null; caseName: string | null }[]>`
    SELECT id, "primaryEntityName" AS entity, "caseName"
    FROM "Investigation" WHERE "caseKeySource" LIKE 'kmonitor_%' AND status='new'`;

  // Candidate contractor names per case = primaryEntityName + institutions
  // mentioned PROMINENTLY in the case's articles (≥2 articles → guards against
  // tangential one-off mentions). These widen matching beyond the primary entity.
  const instRows = await sql<{ id: string; inst: string }[]>`
    SELECT l."investigationId" AS id, inst
    FROM "InvestigationArticleLink" l
    JOIN "KMonitorArticle" k ON k."newsId" = l."articleId"::int
    JOIN "Investigation" i ON i.id = l."investigationId"
    CROSS JOIN LATERAL jsonb_array_elements_text(k.institutions) inst
    WHERE i."caseKeySource" LIKE 'kmonitor_%' AND i.status='new'
      AND l."articleSource" = 'kmonitor'
      AND jsonb_typeof(k.institutions) = 'array'
    GROUP BY 1, 2 HAVING count(*) >= 2`;
  const candByCase = new Map<string, Set<string>>();
  for (const c of cases) {
    const set = new Set<string>();
    if (c.entity) { const k = core(c.entity); if (k.length >= 5) set.add(k); }
    candByCase.set(c.id, set);
  }
  for (const r of instRows) {
    const k = core(r.inst);
    if (k.length >= 5) candByCase.get(r.id)?.add(k);
  }

  const today = new Date().toISOString().slice(0, 10);
  let matchedCases = 0, withDamage = 0, links = 0;
  for (const c of cases) {
    const cands = candByCase.get(c.id);
    if (!cands || !cands.size) continue;
    // match notices whose contractor core matches ANY of the case's candidate
    // entity cores (primary entity + prominent article institutions)
    const seen = new Set<string>();
    const matched: (typeof notices)[number][] = [];
    for (const [nk, ns] of byCore) {
      if ([...cands].some((ck) => coreMatch(ck, nk))) {
        for (const n of ns) if (!seen.has(n.publicationNumber)) { seen.add(n.publicationNumber); matched.push(n); }
      }
    }
    if (!matched.length) continue;
    matchedCases++;

    // ExternalRecord links (auditable case ↔ notice)
    for (const n of matched) {
      await sql`
        INSERT INTO "ExternalRecord"
          ("investigationId","sourceSystem","externalId","canonicalUrl","fetchedAt","fetchHash","recordType","rawPayload","relevance")
        VALUES (${c.id}, 'TED', ${n.publicationNumber}, ${n.canonicalUrl}, now(),
                ${createHash('sha256').update(n.publicationNumber).digest('hex')}, 'contract_award',
                ${sql.json({ title: n.title, cpvMain: n.cpvMain, awardedHuf: n.valAwardedHuf, estimatedHuf: n.valEstimatedHuf })},
                'corroborates')
        ON CONFLICT ("investigationId","sourceSystem","externalId") DO NOTHING`;
      links++;
    }

    // grounded overpricing = Σ positive (awarded − estimate)
    const comps: Record<string, unknown>[] = [];
    let overrun = 0;
    for (const n of matched) {
      const a = Number(n.valAwardedHuf), e = n.valEstimatedHuf ? Number(n.valEstimatedHuf) : null;
      // Only count as overpricing when awarded exceeds the estimate by a
      // PLAUSIBLE margin (≤3×). A larger ratio almost always means the estimate
      // and the awarded value aren't comparable (total vs per-lot) — excluded to
      // keep figures trustworthy rather than inflated.
      if (e && e > 10_000_000 && a > e && a <= e * 3) {
        const d = a - e; overrun += d;
        comps.push({
          mechanism: 'overpricing',
          lowHuf: String(d), highHuf: String(d),
          method: 'benchmark_deviation',
          inputs: {
            formula: 'túlárazás = megítélt érték − ajánlatkérői becslés (TED közbeszerzési adat)',
            citation: { studyId: `TED ${n.publicationNumber}`, sourceUrl: n.canonicalUrl, lastVerifiedAt: today },
          },
          notes: `Megítélt ${(a / 1e9).toFixed(2)} Mrd Ft vs ajánlatkérői becslés ${(e / 1e9).toFixed(2)} Mrd Ft`,
        });
      }
    }
    if (overrun > 0 && comps.length) {
      await sql`
        INSERT INTO "DamageEstimate" ("investigationId","totalLowHuf","totalHighHuf",confidence,basis,components,"inputsHash")
        VALUES (${c.id}, ${Math.round(overrun)}, ${Math.round(overrun)}, 'medium', 'procurement_modeled',
                ${sql.json(comps as Parameters<typeof sql.json>[0])}, ${createHash('sha256').update(c.id + ':ted').digest('hex')})
        ON CONFLICT ("investigationId") DO UPDATE
          SET "totalLowHuf"=EXCLUDED."totalLowHuf","totalHighHuf"=EXCLUDED."totalHighHuf",
              confidence=EXCLUDED.confidence, basis=EXCLUDED.basis, components=EXCLUDED.components, "computedAt"=now()`;
      withDamage++;
      console.log(`  ${c.caseName?.slice(0, 40)} [${c.entity}] → ${matched.length} TED contracts · overrun ${(overrun / 1e9).toFixed(2)} Mrd`);
    }
  }
  console.log(`\ndone. ${matchedCases} cases matched to TED, ${links} record links, ${withDamage} got a grounded overpricing figure.`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
