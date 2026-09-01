import { NextResponse } from 'next/server';
import { and, eq, gte, sql } from 'drizzle-orm';
import { z } from 'zod';

import { encryptPii } from '@korr/shared/encryption';
import { subscribeIpHourLimiter, subscribeIpLimiter } from '@korr/shared/ratelimit';
import { CONSENT_TEXT_VERSION, SUBSCRIPTION_SECTIONS } from '@korr/shared/sections';

import { getDb, schema } from '@/lib/db';
import { inngest } from '@/inngest/client';
import { checkHoneypot } from '@/lib/poll-validation';
import {
  CONFIRM_COOLDOWN_MINUTES,
  hashIp,
  hashSubscriberEmail,
  refuseAddress,
} from '@/lib/subscriber-crypto';
import { sendTelegramMessage } from '@/lib/telegram';

/**
 * 012-reader-subscriptions — a feliratkozó végpont (FR-032, FR-043…FR-046,
 * FR-089…FR-096).
 *
 * A SORREND a szerződés: a legolcsóbb ellenőrzés elöl, és az 1–6. lépés
 * EGYETLEN adatbázis-olvasást vagy -írást sem végez (FR-095). Amit a csali-mező
 * elutasít, az nulla adatbázis-munkát okoz.
 *
 * A válasz minden nem-szüneteltetett ágon UGYANAZ (FR-043), hogy az űrlap ne
 * legyen használható annak kiderítésére, fel van-e iratkozva egy cím.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * FR-079 — ennyi feliratkozás felett ugyanarról a hálózati cím-hashről egy óra
 * alatt a szerkesztő értesítést kap.
 *
 * Ez NEVESÍTETT észlelési kontroll, nem kényelmi funkció. Kihívás-widget
 * nélkül (A11) ez az EGYETLEN jel, ami embernek megmondja, hogy bot-futás
 * zajlik — ezért az űrlappal EGYÜTT szállít, nem később.
 */
const SIGNUP_BURST_THRESHOLD = 10;

/**
 * Minden elutasítás UGYANEZT a szöveget kapja. Egy bot így nem tanulja meg,
 * melyik ellenőrzésen bukott el (FR-089).
 */
const GENERIC_FAILURE = 'A beküldés nem sikerült.';

/** Minden sikeres ág UGYANEZT adja vissza (FR-043). */
const UNIFORM_SUCCESS = {
  ok: true,
  message: 'Elküldtük a megerősítő levelet. Nézd meg a postaládád.',
};

function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? '127.0.0.1';
}

/**
 * A ritmus MA csak `weekly` lehet, és az űrlap nem is kérdezi meg.
 *
 * A `digest-draft` kizárólag a `5 7 * * 1` ütemezésen fut, tehát egy
 * `daily`-ként tárolt feliratkozó EGYETLEN olyan összefoglalóhoz sem
 * illeszkedne, amit a küldő valaha felépít: nem kapna semmit, és egyetlen
 * egészség-feltétel sem jelezné. Az oszlop és az enum viszi a `daily`-t (A6),
 * úgyhogy a napi ritmus bevezetése később egy ütemezés és egy űrlapelem, nem
 * migráció.
 */
const bodySchema = z.object({
  email: z.string().trim().min(3).max(254).email(),
  sections: z.array(z.enum(SUBSCRIPTION_SECTIONS)).min(1).max(SUBSCRIPTION_SECTIONS.length),
  cadence: z.literal('weekly').optional(),
  website: z.unknown().optional(),
});

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: GENERIC_FAILURE }, { status: 400 });
  }

  // ── 1. Csali-mező. MINDEN más ellenőrzés előtt, és MINDEN adatbázis-hívás
  //    előtt (FR-089, FR-095). Ugyanaz a megosztott segéd, amit a szavazat-
  //    beküldés is hív — egy megvalósítás, nem kettő.
  if (!checkHoneypot(body.website).valid) {
    return NextResponse.json({ error: GENERIC_FAILURE }, { status: 400 });
  }

  const ip = getClientIp(req);

  // ── 2–3. Hálózati cím küszöbei (FR-046, FR-093). A gyárból épített,
  //    KÜLÖN limiterek — nem a szavazás nagyvonalú, 75/nap küszöbe.
  const hourly = await subscribeIpHourLimiter().limit(`subh:${ip}`);
  if (!hourly.success) {
    return NextResponse.json(
      { error: 'Túl sok feliratkozási kísérlet erről a hálózatról. Próbáld újra később.' },
      { status: 429 },
    );
  }
  const daily = await subscribeIpLimiter().limit(`subsd:${ip}`);
  if (!daily.success) {
    return NextResponse.json(
      { error: 'Túl sok feliratkozási kísérlet erről a hálózatról. Próbáld újra később.' },
      { status: 429 },
    );
  }

  // ── 4. Alak.
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: GENERIC_FAILURE }, { status: 400 });
  }
  const { email, sections } = parsed.data;

  // ── 5. Szerepcímek és eldobható domainek (FR-045). Még mindig nulla
  //    adatbázis-munka.
  if (refuseAddress(email)) {
    return NextResponse.json({ error: GENERIC_FAILURE }, { status: 400 });
  }

  // ── 6. Szünetel-e az e-mail (FR-044). KÜLÖNBÖZŐ válasz, nem hamis 201: az
  //    egységes válasz szabálya a cím-kitalálás ellen véd, és az itt nem áll
  //    fenn — a csatorna van kikapcsolva, nem a címről mondunk valamit.
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { paused: true, message: 'A feliratkozás átmenetileg szünetel.' },
      { status: 503 },
    );
  }

  try {
    const db = getDb();
    const emailHash = hashSubscriberEmail(email);
    const signupIpHash = hashIp(ip);

    // ── 7–8. Innentől van adatbázis-munka.
    const [existing] = await db
      .select({
        id: schema.subscribers.id,
        status: schema.subscribers.status,
        emailEnc: schema.subscribers.emailEnc,
        purgePiiAt: schema.subscribers.purgePiiAt,
        confirmLastSentAt: schema.subscribers.confirmLastSentAt,
      })
      .from(schema.subscribers)
      .where(eq(schema.subscribers.emailHash, emailHash))
      .limit(1);

    let subscriberId: string | null = null;
    let enqueueConfirmation = false;

    if (existing) {
      const erased = existing.emailEnc === null && existing.purgePiiAt !== null;
      if (erased || existing.status === 'complained') {
        // Sírkő, illetve visszavonhatatlan panasz — semmit nem küldünk, és a
        // választ nem különböztetjük meg (FR-045, FR-043).
        return NextResponse.json(UNIFORM_SUCCESS, { status: 201 });
      }

      if (existing.status === 'active') {
        // FR-090 — HELYBEN frissítjük a szekciókat, üzenet nélkül.
        await db
          .update(schema.subscribers)
          .set({ sections, cadence: 'weekly' })
          .where(eq(schema.subscribers.id, existing.id));
        subscriberId = existing.id;
      } else {
        const cooledDown =
          !existing.confirmLastSentAt ||
          Date.now() - existing.confirmLastSentAt.getTime() >= CONFIRM_COOLDOWN_MINUTES * 60_000;
        await db
          .update(schema.subscribers)
          .set({
            sections,
            cadence: 'weekly',
            status: 'pending',
            emailEnc: encryptPii(email),
            consentTextVersion: CONSENT_TEXT_VERSION,
            signupIpHash,
          })
          .where(eq(schema.subscribers.id, existing.id));
        subscriberId = existing.id;
        // FR-090 — a türelmi időn belül nem megy újabb üzenet. A DARABSZÁM-
        // korlátot itt SZÁNDÉKOSAN nem ellenőrizzük: azt a küldő tranzakciója
        // érvényesíti, mert csak ott atomi a növeléssel (FR-038). Egy második,
        // versenyfüggő másolat ugyanabból a kontrollból rosszabb, mint egy.
        enqueueConfirmation = cooledDown;
      }
    } else {
      // ── 9. Új sor.
      const [inserted] = await db
        .insert(schema.subscribers)
        .values({
          emailHash,
          emailEnc: encryptPii(email),
          sections,
          cadence: 'weekly',
          status: 'pending',
          consentTextVersion: CONSENT_TEXT_VERSION,
          signupIpHash,
        })
        .returning({ id: schema.subscribers.id });
      subscriberId = inserted?.id ?? null;
      enqueueConfirmation = Boolean(subscriberId);
    }

    // ── 10. A megerősítő levél SORBA kerül. A szolgáltatói hívás soha nem a
    //    kérés útvonalán történik.
    //
    //    A sorbaállítás NEM VÉGZETES: a feliratkozó sora már megvan. Ha a sor
    //    éppen nem elérhető, a megerősítő levél elmarad, de az olvasót nem
    //    utasítjuk el egy olyan hibáért, amiről nem tehet — és a `pending`,
    //    nulla küldésű sort az egészség-ellenőrzés úgyis jelenti.
    if (enqueueConfirmation && subscriberId) {
      try {
        await inngest.send({ name: 'subscriber.confirm-send', data: { subscriberId } });
      } catch (err) {
        console.error('[hirlevel/feliratkozas] confirmation enqueue failed (non-fatal):', err);
      }
    }

    // ── 11. Bot-futás jelzése a szerkesztőnek (FR-079). SAJÁT óránkénti
    //    számlálás, SOHA nem az egészség-ellenőrző napi jelölője — különben egy
    //    leállási feltétel elnyomná a visszaélés-jelzést a nap hátralévő
    //    részére (FR-075).
    if (signupIpHash) {
      await maybeNotifySignupBurst(db, signupIpHash);
    }

    // ── 12. Audit, olvasható cím NÉLKÜL (FR-091). Szintén nem végzetes: egy
    //    elmaradt auditsor nem indok arra, hogy egy már beírt feliratkozást
    //    hibával zárjunk le.
    if (subscriberId) {
      try {
        await db.insert(schema.auditLogs).values({
          action: 'subscriber.subscribe',
          entityType: 'Subscriber',
          entityId: subscriberId,
          detail: { sections, cadence: 'weekly', emailHashPrefix: emailHash.slice(0, 12) },
        });
      } catch (err) {
        console.error('[hirlevel/feliratkozas] audit write failed (non-fatal):', err);
      }
    }

    // ── 13. Ugyanaz a válasz minden ágról.
    return NextResponse.json(UNIFORM_SUCCESS, { status: 201 });
  } catch (err) {
    console.error('[hirlevel/feliratkozas] failed:', err);
    return NextResponse.json({ error: GENERIC_FAILURE }, { status: 500 });
  }
}

/** FR-079 — óránként legfeljebb egy jelzés hálózati cím-hashenként. */
async function maybeNotifySignupBurst(
  db: ReturnType<typeof getDb>,
  signupIpHash: string,
): Promise<void> {
  try {
    const since = new Date(Date.now() - 60 * 60_000);
    const rows = await db
      .select({ id: schema.subscribers.id })
      .from(schema.subscribers)
      .where(
        and(
          eq(schema.subscribers.signupIpHash, signupIpHash),
          gte(schema.subscribers.createdAt, since),
        ),
      );
    if (rows.length <= SIGNUP_BURST_THRESHOLD) return;

    // Az óránkénti jelölő maga az AuditLog: ha az elmúlt órában már ment
    // jelzés erre a hashre, nem küldünk másodikat.
    const alreadyPinged = (await db.execute(sql`
      SELECT 1 FROM "AuditLog"
       WHERE action = 'subscriber.signup-burst'
         AND "entityId" = ${signupIpHash}
         AND at > now() - interval '1 hour'
       LIMIT 1
    `)) as unknown as unknown[];
    if (alreadyPinged.length > 0) return;

    await db.insert(schema.auditLogs).values({
      action: 'subscriber.signup-burst',
      entityType: 'SubscriberSignupIp',
      entityId: signupIpHash,
      detail: { count: rows.length, windowMinutes: 60 },
    });

    await sendTelegramMessage(
      '⚠️ Korruptométer: feliratkozás-hullám.\n\n'
      + `Az elmúlt órában ${rows.length} feliratkozás érkezett ugyanarról a hálózatról.\n\n`
      + 'Az űrlap előtt nincs kihívás-widget, ezért ez az egyetlen jel, ami emberhez eljut '
      + 'egy bot-futásról. A megerősítő levelek napi kerete legfeljebb 50 üzenetnél megáll, '
      + 'és egyetlen meg nem erősített cím sem kap mást, mint a saját megerősítő levelét.',
    );
  } catch (err) {
    // Egy jelzés elmaradása soha nem buktathatja el a feliratkozást.
    console.error('[hirlevel/feliratkozas] signup-burst ping failed (non-fatal):', err);
  }
}
