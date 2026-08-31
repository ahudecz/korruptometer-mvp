import 'server-only';
import { and, desc, eq, gt, sql } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { renderMilestoneImage, renderBreakingImage } from '@/lib/social-image';
import { milestoneCaption, breakingCaption } from '@/lib/social-caption';
import { sendTelegramPhoto, type InlineKeyboardMarkup } from '@/lib/telegram';
import { computeComplaintTotal } from '@app/birosagi-iteletek/complaint-stats';
import { computeNextMilestone, formatMilliardLabel } from '@/lib/social-milestone';
import { WATCH_LIST } from '@app/_home/watchlist-config';
import type { BypassStep, BypassLogger } from '@/lib/cron-bypass';

/**
 * check.social-triggers — óránként (GitHub Actions,
 * .github/workflows/hourly-social-triggers.yml).
 *
 * user kérés, 2026-08-30: automatikus, Telegram-jóváhagyás mögötti Facebook-
 * posztok (1) a feljelentési összeg minden +1000 milliárdos mérföldkövénél,
 * (2) breaking eseményeknél (v1: csak WATCH_LIST-es személy lemondása —
 * a médium-megszűnés/ítélet/vagyonvisszaszerzés ugyanezzel a mintával
 * bővíthető később, l. addResignationTriggers minta).
 *
 * SOSEM posztol közvetlenül — mindig SocialPostOutbox sort ír
 * 'pending_approval' státusszal, és egy KÉPES Telegram-üzenetet küld
 * Jóváhagyás/Elutasítás gombokkal (l. telegram/webhook route.ts 's' ág).
 * Nincs LLM-hívás (sablon-alapú caption, l. social-caption.ts) — a napi
 * Anthropic-keretre nulla hatással van.
 */

const BREAKING_LOOKBACK_HOURS = 2; // órás cron + puffer; a valódi dedup a triggerRefId-egyediség

type OutboxInsert = {
  triggerType: string;
  triggerRefId: string | null;
  milestoneValueFt: bigint | null;
  headline: string;
  caption: string;
  imagePng: Buffer;
  imageText: string; // a képre írt, "✏️ Módosítás"-sal szerkeszthető szöveg (subline/detail)
  kicker: string | null; // csak breaking-típusoknál — l. schema.ts komment
};

async function buildMilestoneTrigger(db: ReturnType<typeof getDb>): Promise<OutboxInsert | null> {
  const rows = await db.select({ amountLabel: schema.criminalComplaints.amountLabel }).from(schema.criminalComplaints);
  const total = computeComplaintTotal(rows);

  // A státusztól FÜGGETLENÜL számít, ha egy küszöbérték már egyszer sorba
  // került — egy kézzel elutasított mérföldkövet ne kérdezzünk meg minden
  // órában újra (2026-08-30, saját QA közben derült ki).
  const [lastRow] = await db
    .select({ maxVal: sql<string>`COALESCE(MAX("milestoneValueFt"), 0)` })
    .from(schema.socialPostOutbox)
    .where(eq(schema.socialPostOutbox.triggerType, 'complaint_milestone'));
  const lastMax = lastRow ? BigInt(lastRow.maxVal) : 0n;

  const currentThreshold = computeNextMilestone(total, lastMax);
  if (currentThreshold === null) return null;

  const amountLabel = formatMilliardLabel(currentThreshold);
  const subline = 'NER-hez és államigazgatáshoz köthető feljelentések összértéke';
  const image = await renderMilestoneImage({ amountLabel, subline });
  return {
    triggerType: 'complaint_milestone',
    triggerRefId: null,
    milestoneValueFt: currentThreshold,
    headline: `Mérföldkő: ${amountLabel}`,
    caption: milestoneCaption(amountLabel),
    imagePng: image,
    imageText: subline,
    kicker: null,
  };
}

async function buildResignationTriggers(db: ReturnType<typeof getDb>): Promise<OutboxInsert[]> {
  const since = new Date(Date.now() - BREAKING_LOOKBACK_HOURS * 60 * 60 * 1000);
  const recent = await db
    .select({ id: schema.politicalResignations.id, name: schema.politicalResignations.name, institution: schema.politicalResignations.institution, position: schema.politicalResignations.position, resignationType: schema.politicalResignations.resignationType })
    .from(schema.politicalResignations)
    .where(and(
      eq(schema.politicalResignations.reviewStatus, 'approved'),
      gt(schema.politicalResignations.createdAt, since),
    ))
    .orderBy(desc(schema.politicalResignations.createdAt));

  if (recent.length === 0) return [];

  const alreadyPosted = await db
    .select({ triggerRefId: schema.socialPostOutbox.triggerRefId })
    .from(schema.socialPostOutbox)
    .where(eq(schema.socialPostOutbox.triggerType, 'resignation'));
  const alreadyPostedIds = new Set(alreadyPosted.map((r) => r.triggerRefId));

  const out: OutboxInsert[] = [];
  for (const r of recent) {
    if (alreadyPostedIds.has(r.id)) continue;
    const isWatchlisted = WATCH_LIST.some((p) => p.name.toLowerCase() === r.name.toLowerCase());
    if (!isWatchlisted) continue; // v1: csak országosan ismert, figyelt személy — l. fájl fejléce

    const RESIGNATION_KICKERS: Record<string, string> = {
      'lemondás': 'LEMONDÁS', 'kirúgás': 'KIRÚGÁS', 'felmentés': 'FELMENTÉS', 'visszahívás': 'VISSZAHÍVÁS',
    };
    const kicker = RESIGNATION_KICKERS[r.resignationType] ?? 'TÁVOZÁS';
    const headline = `${r.name} távozott: ${r.position}, ${r.institution}`;
    const image = await renderBreakingImage({ kicker, headline });
    out.push({
      triggerType: 'resignation',
      triggerRefId: r.id,
      milestoneValueFt: null,
      headline,
      caption: breakingCaption(kicker, headline),
      imagePng: image,
      imageText: '',
      kicker,
    });
  }
  return out;
}

export function approvalKeyboard(outboxId: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: '✅ Közzététel (Facebook)', callback_data: `s:a:${outboxId}` }],
      [
        { text: '✏️ Módosítás', callback_data: `s:m:${outboxId}` },
        { text: '❌ Elutasítás', callback_data: `s:r:${outboxId}` },
      ],
    ],
  };
}

export async function runSocialTriggersCore({
  step,
  logger,
}: {
  step: BypassStep;
  logger?: BypassLogger;
}) {
  const db = getDb();

  const candidates: OutboxInsert[] = [];
  const milestone = await step.run('check-milestone', () => buildMilestoneTrigger(db));
  if (milestone) candidates.push(milestone);
  const resignations = await step.run('check-resignations', () => buildResignationTriggers(db));
  candidates.push(...resignations);

  let queued = 0;
  for (const c of candidates) {
    await step.run(`queue-${c.triggerType}-${c.triggerRefId ?? c.milestoneValueFt}`, async () => {
      const [inserted] = await db
        .insert(schema.socialPostOutbox)
        .values({
          triggerType: c.triggerType,
          triggerRefId: c.triggerRefId,
          milestoneValueFt: c.milestoneValueFt,
          headline: c.headline,
          caption: c.caption,
          imagePng: c.imagePng.toString('base64'),
          imageText: c.imageText,
          kicker: c.kicker,
          status: 'pending_approval',
        })
        .returning({ id: schema.socialPostOutbox.id });
      if (!inserted) return;

      const messageId = await sendTelegramPhoto(
        c.imagePng,
        `📢 Új Facebook-poszt-jelölt\n\n${c.caption}`,
        approvalKeyboard(inserted.id),
      );
      if (messageId) {
        await db.update(schema.socialPostOutbox).set({ telegramMessageId: messageId }).where(eq(schema.socialPostOutbox.id, inserted.id));
      }
      queued++;
    });
  }

  logger?.info?.(`check-social-triggers: candidates=${candidates.length} queued=${queued}`);
  return { candidates: candidates.length, queued };
}
