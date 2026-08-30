import 'server-only';
import { eq } from 'drizzle-orm';

import { fetchKormanyHuComplaints, type KormanyHuComplaint } from '@korr/scrapers/kormanyhu-feljelentes';
import { isLikelyMatch, looksGovernmentFiled, mapOfficialStatus } from '@korr/db';
import { getDb, schema } from '@/lib/db';
import { sendTelegramMessage } from '@/lib/telegram';
import type { BypassStep, BypassLogger } from '@/lib/cron-bypass';

/**
 * sync.kormanyhu-complaints — napi 09:00-kor (GitHub Actions,
 * .github/workflows/daily-kormanyhu-sync.yml).
 *
 * user döntés, 2026-08-30: a kormany.hu/atlathato/feljelentes (a
 * minisztériumok SAJÁT maguk által tett feljelentéseinek hivatalos listája)
 * az elsődleges forrás a KORMÁNYZATI bejelentőjű sorainkra — a számoknak
 * szóról szóra, számról számra egyezniük kell (l. project-kormanyhu-
 * official-source memória). Harmadik felek (Hadházy Ákos, Transparency
 * International, ÁSZ stb.) feljelentéseit ez a job nem érinti.
 *
 * Három ág:
 * 1) Hivatalos tétel MATCHEL egy nálunk lévő sorral (l. kormanyhu-match.ts)
 *    → ha az összeg/dátum/státusz eltér, frissítjük a hivatalos adatra.
 * 2) Hivatalos tétel NEM matchel semmivel → új sor, kormany.hu forrással,
 *    azonnal 'approved' (megbízható forrás, nem kell emberi jóváhagyás).
 * 3) Nálunk lévő KORMÁNYZATI bejelentőjű sor, amit EGYETLEN hivatalos tétel
 *    sem matchelt → Telegram-jelzés, NEM töröljük automatikusan (lehet,
 *    hogy csak a matcher hibázott — l. kormanyhu-match.ts fejléce a
 *    Kismotor/Játékmotor esetről —, vagy tényleg nincs még fent náluk).
 *
 * NINCS LLM-hívás sehol ebben a jobban — HTML-attribútum-parse +
 * szó-egyeztetés, a napi Anthropic-keretre nulla hatással van (l.
 * feedback-llm-cost-isolation memória).
 */

type OurComplaintRow = typeof schema.criminalComplaints.$inferSelect;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function findBestMatch(item: KormanyHuComplaint, ourRows: OurComplaintRow[]): OurComplaintRow | null {
  const officialText = `${item.name} ${item.description}`;
  let best: OurComplaintRow | null = null;
  for (const row of ourRows) {
    const candidateText = `${row.targetName} ${row.description ?? ''}`;
    if (isLikelyMatch(officialText, item.sourceUrl, candidateText, row.sourceUrls)) {
      // Az első jó egyezés is elég — a hivatalos lista 22 tétele és a mi
      // állományunk mérete miatt (néhány tucat sor) a több egyidejű
      // találat esélye elhanyagolható; nem versenyeztetünk pontszám szerint.
      best = row;
      break;
    }
  }
  return best;
}

export async function runKormanyHuSyncCore({
  step,
  logger,
}: {
  step: BypassStep;
  logger?: BypassLogger;
}) {
  const db = getDb();

  const official = await step.run('fetch-kormanyhu', () => fetchKormanyHuComplaints());
  if (official.length === 0) {
    logger?.warn?.('sync-kormanyhu: 0 sort talált — valószínűleg megváltozott az oldal szerkezete, kihagyva.');
    return { added: 0, updated: 0, flagged: 0 };
  }

  const ourRows = await step.run('load-our-complaints', () =>
    db.select().from(schema.criminalComplaints),
  );

  const matchedIds = new Set<string>();
  const addedLines: string[] = [];
  const updatedLines: string[] = [];

  for (const item of official) {
    const match = findBestMatch(item, ourRows);

    if (match) {
      matchedIds.add(match.id);
      const changes: string[] = [];
      if (match.amountLabel !== item.amountLabel) changes.push(`összeg: "${match.amountLabel ?? '–'}" → "${item.amountLabel}"`);
      const mappedStatus = mapOfficialStatus(item.status);
      if (match.status !== mappedStatus) changes.push(`státusz: "${match.status}" → "${mappedStatus}"`);

      if (changes.length > 0) {
        await step.run(`update-${match.id}`, () =>
          db.update(schema.criminalComplaints)
            .set({ amountLabel: item.amountLabel, status: mappedStatus, updatedAt: new Date() })
            .where(eq(schema.criminalComplaints.id, match.id)),
        );
        updatedLines.push(`• ${item.name} — ${changes.join(', ')}`);
      }
      continue;
    }

    await step.run(`insert-${item.name}`, () =>
      db.insert(schema.criminalComplaints).values({
        targetName: item.name.slice(0, 200),
        filerName: item.ministry.slice(0, 200),
        description: item.description.slice(0, 1000),
        amountLabel: item.amountLabel,
        status: mapOfficialStatus(item.status),
        eventDate: new Date(item.filedDateIso ?? todayIso()),
        filedAt: item.filedDateIso ? new Date(item.filedDateIso) : null,
        sourceUrls: [item.sourceUrl],
        sourceNames: ['kormany.hu (hivatalos)'],
        sourceHeadlines: [item.name],
        sourceDates: [item.filedDateIso ?? todayIso()],
        reviewStatus: 'approved',
      }),
    );
    addedLines.push(`• ${item.name} (${item.ministry}, ${item.amountLabel})`);
  }

  // Kormányzati bejelentőjű sorunk, amit ma egyetlen hivatalos tétel sem
  // matchelt — flag, nem törlés (l. fájl fejléce).
  const unmatchedGovRows = ourRows.filter((r) => !matchedIds.has(r.id) && looksGovernmentFiled(r.filerName));
  const flaggedLines = unmatchedGovRows.map((r) => `• ${r.targetName} (bejelentő: ${r.filerName}, ${r.amountLabel ?? 'nincs összeg'})`);

  if (addedLines.length > 0 || updatedLines.length > 0 || flaggedLines.length > 0) {
    await step.run('notify-kormanyhu-sync', async () => {
      const parts: string[] = ['📋 Kormany.hu napi egyeztetés'];
      if (addedLines.length > 0) parts.push(`\n➕ Új tétel (${addedLines.length}):\n${addedLines.join('\n')}`);
      if (updatedLines.length > 0) parts.push(`\n✏️ Frissítve (${updatedLines.length}):\n${updatedLines.join('\n')}`);
      if (flaggedLines.length > 0) {
        parts.push(
          `\n⚠️ Nálunk kormányzati bejelentőjű, de ma nem talált hivatalos párja (${flaggedLines.length}) — lehet, hogy csak a szöveges egyeztetés hibázott (l. kormanyhu-match.ts), nézd át kézzel:\n${flaggedLines.join('\n')}`,
        );
      }
      await sendTelegramMessage(parts.join('\n'));
    });
  }

  logger?.info?.(`sync-kormanyhu: official=${official.length} added=${addedLines.length} updated=${updatedLines.length} flagged=${flaggedLines.length}`);
  return { added: addedLines.length, updated: updatedLines.length, flagged: flaggedLines.length };
}
