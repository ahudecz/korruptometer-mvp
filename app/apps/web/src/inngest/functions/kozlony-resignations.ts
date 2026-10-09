import 'server-only';
import { eq } from 'drizzle-orm';

import { fetchKozlonyFeed, fetchKozlonyText, extractPersonnelDecisions } from '@korr/scrapers/magyar-kozlony';
import { detectResignationFromArticle } from '@korr/db/ai';
import { isTransientLlmFailure } from '@korr/db';
import { getDb, schema } from '@/lib/db';
import { sendTelegramMessage } from '@/lib/telegram';
import type { BypassStep, BypassLogger } from '@/lib/cron-bypass';
import { processResignationArticle } from './detect-resignations';

/**
 * Magyar Közlöny → lemondás-detektor. User kérés, 2026-10-09 (GVH
 * elnökhelyettes, Bak László: a lemondás csak a Közlönyben és általunk nem
 * gyűjtött lapokban jelent meg).
 *
 * Menet: RSS → minden ÚJ lapszám PDF-je → tartalomjegyzékből a személyi
 * döntések (LLM nélkül, l. extractPersonnelDecisions) → csak ezek rövid
 * szövege megy a meglévő lemondás-detektorhoz (Haiku, ugyanaz a kinyerés,
 * dedup és jóváhagyási kapu, mint a hírcikkeknél). Egy szám jellemzően 0–3
 * ilyen határozatot tartalmaz, ez napi pár fillér.
 *
 * Vízjel: a WorkerHeartbeat tábla 'magyar-kozlony' sora (id + at) — az utolsó
 * TELJESEN feldolgozott lapszám megjelenési ideje. Átmeneti LLM-hiba (pl. a
 * napi keret elfogyott) esetén a vízjel NEM lép tovább, a következő futás
 * újrapróbálja ugyanazt a számot.
 */

const WATERMARK_ID = 'magyar-kozlony';
/** Első futáskor ennyi napra visszamenőleg dolgozzuk fel a számokat. */
const INITIAL_LOOKBACK_DAYS = 3;
/** Egy futásban legfeljebb ennyi lapszám (a PDF-ek 50–100 oldalasak). */
const MAX_ISSUES_PER_RUN = 6;

export async function runKozlonyResignationsCore({ step, logger }: { step: BypassStep; logger?: BypassLogger }) {
  const db = getDb();

  const watermark = await step.run('load-watermark', async () => {
    const [row] = await db
      .select({ at: schema.workerHeartbeats.at })
      .from(schema.workerHeartbeats)
      .where(eq(schema.workerHeartbeats.id, WATERMARK_ID));
    return (row?.at ?? new Date(Date.now() - INITIAL_LOOKBACK_DAYS * 86_400_000)).toISOString();
  });

  const issues = await step.run('fetch-feed', async () => {
    const all = await fetchKozlonyFeed();
    return all
      .filter((i) => i.publishedAt.getTime() > new Date(watermark).getTime())
      .sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime())
      .slice(0, MAX_ISSUES_PER_RUN)
      .map((i) => ({ ...i, publishedAt: i.publishedAt.toISOString() }));
  });

  let decisionsSeen = 0;
  let inserted = 0;
  const failures: string[] = [];
  // Nem csendes kihagyás: ami nem került be (alacsony bizonyosság, duplikátum,
  // nem lemondás), az egy összesítő Telegram-üzenetben megjelenik.
  const skipped: string[] = [];

  for (const issue of issues) {
    const res = await step.run(`issue-${issue.year}-${issue.serial}`, async () => {
      const text = await fetchKozlonyText(issue.pdfUrl);
      const decisions = extractPersonnelDecisions(text);
      let ins = 0;
      for (const d of decisions) {
        const headline = `Magyar Közlöny ${issue.year}/${issue.serial}: ${d.ref} határozat — ${d.title}`;
        const llm = await detectResignationFromArticle(headline, d.body, issue.publishedAt.slice(0, 10));
        if (isTransientLlmFailure(llm)) return { ok: false as const, decisions: decisions.length, ins };
        try {
          const out = await processResignationArticle(
            {
              id: '',
              headline: headline.slice(0, 500),
              excerpt: d.body,
              publishedAt: issue.publishedAt,
              sourceUrl: issue.viewUrl,
              sourceName: 'Magyar Közlöny',
            } as never,
            llm.data,
          );
          if (out.inserted) ins++;
          else skipped.push(`• ${d.title.slice(0, 110)} — ${issue.viewUrl}`);
        } catch (err) {
          failures.push(`• ${headline.slice(0, 120)} — ${(err instanceof Error ? err.message : String(err)).slice(0, 160)}`);
        }
      }
      return { ok: true as const, decisions: decisions.length, ins };
    });

    decisionsSeen += res.decisions;
    inserted += res.ins;
    if (!res.ok) {
      logger?.warn?.(`kozlony: átmeneti LLM-hiba a ${issue.year}/${issue.serial}. számnál — a vízjel nem lép tovább`);
      break;
    }
    await step.run(`advance-watermark-${issue.serial}`, () =>
      db
        .insert(schema.workerHeartbeats)
        .values({ id: WATERMARK_ID, at: new Date(issue.publishedAt) })
        .onConflictDoUpdate({ target: schema.workerHeartbeats.id, set: { at: new Date(issue.publishedAt) } }),
    );
  }

  if (skipped.length > 0) {
    await step.run('notify-skipped', () =>
      sendTelegramMessage(
        `ℹ️ Magyar Közlöny: ${skipped.length} személyi határozat NEM került a lemondások közé (duplikátum, nem lemondás vagy bizonytalan). Ha valamelyik kell, szólj.\n\n${skipped.slice(0, 8).join('\n')}`,
      ).catch(() => undefined),
    );
  }

  if (failures.length > 0) {
    await step.run('notify-failures', () =>
      sendTelegramMessage(`⚠️ Magyar Közlöny: ${failures.length} határozat feldolgozása hibával elszállt.\n\n${failures.slice(0, 8).join('\n')}`).catch(
        () => undefined,
      ),
    );
  }

  logger?.info?.(`kozlony: issues=${issues.length} decisions=${decisionsSeen} inserted=${inserted}`);
  return { issues: issues.length, decisions: decisionsSeen, inserted };
}
