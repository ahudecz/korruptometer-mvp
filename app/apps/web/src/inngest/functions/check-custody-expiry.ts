import 'server-only';
import { and, eq } from 'drizzle-orm';

import { selectExpiredCustodyRows, type CustodyRow } from '@korr/db';
import { getDb, schema } from '@/lib/db';
import { sendTelegramMessage } from '@/lib/telegram';
import type { BypassStep, BypassLogger } from '@/lib/cron-bypass';

/**
 * check.custody-expiry — "lejárt-e az őrizet?" figyelő.
 *
 * 2026-09-16, user kérés: "figyelje a híreket, ha kiengednek olyat aki csak
 * őrizetben van, akkor frissüljön az adat."
 *
 * Miért kell külön figyelő, ha a detektor amúgy is felismeri a kiengedést:
 * a szabadon bocsátás sokkal ritkábban hír, mint az elfogás, és amikor mégis,
 * a hír gyakran NEM nevesít ("a három gyanúsítottat elengedték") — ilyenkor a
 * findExistingVerdict() név-egyeztetése nem talál sort, tehát a meglévő
 * 'előzetesben' sor csendben elavul. Az őrizet viszont TÖRVÉNY SZERINT
 * legfeljebb 72 óra: utána vagy letartóztatás van (az önálló hír), vagy az
 * illető szabad. A 72 óra elteltét tehát nem kell hírből megtudni — az naptár
 * kérdése.
 *
 * Amit ez a job NEM csinál: nem írja át magától 'szabadlábra helyezve'-re a
 * sort. A kiengedés tény, nem következtetés; kitalálni ugyanaz a hiba lenne,
 * mint amit a coercePretrialClaim() az ellenkező irányban javít (l.
 * packages/db/src/verdict-gate.ts). Ezért Telegram-értesítést küld, a
 * forráscikkekkel együtt, hogy ember döntsön.
 *
 * Költség: NULLA LLM-hívás (egy SELECT + Telegram-üzenet), l.
 * [[feedback-llm-cost-isolation]].
 *
 * Idempotencia: soronként egyetlen AuditLog-bejegyzés
 * ('custody_expiry_flagged'), így az óránkénti pipeline-kör nem ismétli az
 * értesítést. Ha a sor később tényleg frissül (a verdictType már nem
 * 'előzetesben'), kikerül a lekérdezésből.
 */

const AUDIT_ACTION = 'custody_expiry_flagged';

export async function runCustodyExpiryCheckCore({
  step,
  logger,
}: {
  step: BypassStep;
  logger?: BypassLogger;
}) {
  const db = getDb();

  const candidates = (await step.run('load-pretrial-rows', async () =>
    db
      .select({
        id: schema.courtVerdicts.id,
        personName: schema.courtVerdicts.personName,
        sentenceLabel: schema.courtVerdicts.sentenceLabel,
        summary: schema.courtVerdicts.summary,
        verdictDate: schema.courtVerdicts.verdictDate,
        sourceUrls: schema.courtVerdicts.sourceUrls,
      })
      .from(schema.courtVerdicts)
      .where(
        and(
          eq(schema.courtVerdicts.verdictType, 'előzetesben'),
          eq(schema.courtVerdicts.reviewStatus, 'approved'),
        ),
      ),
  )) as CustodyRow[];

  const expired = selectExpiredCustodyRows(candidates);
  if (expired.length === 0) {
    logger?.info?.(`check-custody-expiry: ${candidates.length} előzetes sor, egyik sem jár le.`);
    return { checked: candidates.length, flagged: 0 };
  }

  // Már jelzett sorok kiszűrése — append-only AuditLog a memória.
  const alreadyFlagged = (await step.run('load-flagged', async () =>
    db
      .select({ entityId: schema.auditLogs.entityId })
      .from(schema.auditLogs)
      .where(
        and(
          eq(schema.auditLogs.action, AUDIT_ACTION),
          eq(schema.auditLogs.entityType, 'CourtVerdict'),
        ),
      ),
  )) as Array<{ entityId: string }>;
  const flaggedIds = new Set(alreadyFlagged.map((r) => r.entityId));

  const fresh = expired.filter((r) => !flaggedIds.has(r.id));
  if (fresh.length === 0) {
    logger?.info?.(`check-custody-expiry: ${expired.length} lejárt sor, mind jelezve korábban.`);
    return { checked: candidates.length, flagged: 0 };
  }

  await step.run('notify-custody-expiry', async () => {
    const lines = fresh.map((r) => {
      const date = (r.verdictDate instanceof Date ? r.verdictDate : new Date(r.verdictDate))
        .toISOString()
        .slice(0, 10);
      const src = r.sourceUrls?.[r.sourceUrls.length - 1] ?? '';
      return `• ${r.personName} — őrizetbe véve ${date}\n  ${src}`;
    });
    await sendTelegramMessage(
      [
        `⏳ Lejárt a 72 órás őrizet — ${fresh.length} sor lehet elavult.`,
        '',
        'Ezek a sorok kizárólag ŐRIZETRE hivatkoznak, mégis "ELŐZETESBEN"-ként',
        'látszanak az oldalon. Az őrizet max. 72 óra: azóta vagy letartóztatás',
        'lett belőle (az külön hír), vagy kiengedték őket.',
        '',
        lines.join('\n\n'),
        '',
        'Ha kiengedték: állítsd a sort "szabadlábra helyezve"-re.',
        'Ha letartóztatták: elég a forrást hozzáfűzni, a típus marad.',
      ].join('\n'),
    );
  });

  await step.run('record-flags', async () => {
    await db.insert(schema.auditLogs).values(
      fresh.map((r) => ({
        action: AUDIT_ACTION,
        entityType: 'CourtVerdict',
        entityId: r.id,
        detail: { personName: r.personName, verdictDate: r.verdictDate } as Record<string, unknown>,
      })),
    );
  });

  logger?.info?.(`check-custody-expiry: checked=${candidates.length} flagged=${fresh.length}`);
  return { checked: candidates.length, flagged: fresh.length };
}
