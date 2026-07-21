import 'server-only';
import { eq, inArray } from 'drizzle-orm';

import { adapters, canonicalUrl, dedupHash, scrapeRelevanceTier, isBreaking, shouldFeature } from '@korr/scrapers';
import type { OutletSlug, ScrapedArticle } from '@korr/scrapers';
import { schema } from '@/lib/db';
import { getDb } from '@/lib/db';
import { postEditorAlert } from '@/lib/slack';
import { classifyArticle } from '@/lib/ai-classify';
import { findSameStoryDuplicate } from '@/lib/same-story';
import { getMonitoredNames } from '@/lib/breaking-monitored';

import { inngest } from '../client';

const FAILURE_DISABLE_THRESHOLD = 5;
const ZERO_ARTICLE_ALERT_THRESHOLD = 5;
// 2026-07-19: minden classifyArticle-hiba (napi költés-limit VAGY tényleges
// API-kiesés) fail-closed — a bizonytalan cikket eldobjuk, l. lentebb.
// Ez a küszöb csak azt szabja meg, hányszori egymás utáni hiba után "nyit
// ki" a kör (aiCircuitOpen) — utána a maradék bizonytalan cikkre már meg
// se próbáljuk hívni a halott API-t, és egyszer jelzünk Slacken forrásonként.
const AI_CIRCUIT_BREAKER_THRESHOLD = 3;

/**
 * scrape.news (T151) — runs every hour on a cron, fans out one
 * step.run per enabled Source, persists new NewsArticle rows deduped by
 * sourceUrlHash, writes a ScraperRun row, bumps Source.lastScrapedAt /
 * lastSuccessAt / consecutiveFailures, auto-disables a source after 5
 * consecutive failures, and posts a Slack alert when an outlet returns 0
 * articles 5 runs in a row (the "silent rot" detector — T175).
 *
 * After the batch finishes, the function emits aggregate.link-articles
 * with the IDs of every freshly inserted article so the aggregator
 * (T157) can resolve case linkage.
 */
export const scrapeNews = inngest.createFunction(
  { id: 'scrape-news', name: 'Scrape news', concurrency: 2 },
  { cron: '0 * * * *' },
  async ({ step, logger }) => {
    const db = getDb();

    const sources = await step.run('list-sources', async () =>
      db.select().from(schema.sources).where(eq(schema.sources.enabled, true)),
    );

    // Egyszer számoljuk ki futásonként (nem forrásonként) — l.
    // breaking-monitored.ts getMonitoredNames(): dinamikusan uniózza a
    // WATCH_LIST/GALERIA/UGYEK configokat a ScandalCatalog/
    // PoliticalResignation/CourtVerdict DB-nevekkel, hogy a scrape-kapu
    // (scrapeRelevanceTier) is tudjon minden olyan névről, ami bárhol az
    // oldalon már szerepel — nem csak a statikus KEYWORDS listáról.
    const monitoredNames = await step.run('monitored-names', () => getMonitoredNames());

    const insertedIds: string[] = [];

    for (const source of sources) {
      const adapter = adapters[source.slug as OutletSlug];
      if (!adapter) {
        logger?.warn?.(`scrape.news: no adapter for source ${source.slug}`);
        continue;
      }

      const result = await step.run(`run-${source.slug}`, async () => {
        const startedAt = new Date();
        const [run] = await db
          .insert(schema.scraperRuns)
          .values({ sourceId: source.id, startedAt, status: 'running' })
          .returning({ id: schema.scraperRuns.id });

        try {
          const scraped = await adapter.crawl();
          const inserted = await persistArticles(source.id, adapter.queryAllowlist, scraped, adapter.relevantByDefault ?? false, monitoredNames, logger, source.slug);
          const finishedAt = new Date();
          await db
            .update(schema.scraperRuns)
            .set({
              finishedAt,
              status: 'success',
              articlesFound: scraped.length,
              articlesNew: inserted.length,
            })
            .where(eq(schema.scraperRuns.id, run!.id));
          await db
            .update(schema.sources)
            .set({
              lastScrapedAt: startedAt,
              lastSuccessAt: finishedAt,
              consecutiveFailures: 0,
            })
            .where(eq(schema.sources.id, source.id));
          return { ok: true, found: scraped.length, inserted };
        } catch (err) {
          const finishedAt = new Date();
          const message = err instanceof Error ? err.message : 'unknown';
          await db
            .update(schema.scraperRuns)
            .set({
              finishedAt,
              status: 'failure',
              errorMessage: message,
            })
            .where(eq(schema.scraperRuns.id, run!.id));
          const nextFailures = source.consecutiveFailures + 1;
          await db
            .update(schema.sources)
            .set({
              lastScrapedAt: startedAt,
              consecutiveFailures: nextFailures,
              enabled: nextFailures < FAILURE_DISABLE_THRESHOLD,
            })
            .where(eq(schema.sources.id, source.id));
          if (nextFailures >= FAILURE_DISABLE_THRESHOLD) {
            await postEditorAlert(
              `Source *${source.slug}* auto-disabled after ${nextFailures} consecutive failures: ${message}`,
            );
          }
          return { ok: false, found: 0, inserted: [] as string[], error: message };
        }
      });

      if (result.ok) insertedIds.push(...result.inserted);

      // Silent-rot detector: 5 consecutive zero-article (HTTP 200) runs.
      if (result.ok && result.found === 0) {
        await step.run(`silent-rot-${source.slug}`, async () => {
          const recent = await db
            .select({ articlesFound: schema.scraperRuns.articlesFound })
            .from(schema.scraperRuns)
            .where(eq(schema.scraperRuns.sourceId, source.id))
            .orderBy(schema.scraperRuns.startedAt)
            .limit(ZERO_ARTICLE_ALERT_THRESHOLD);
          if (
            recent.length === ZERO_ARTICLE_ALERT_THRESHOLD &&
            recent.every((r) => r.articlesFound === 0)
          ) {
            await postEditorAlert(
              `Source *${source.slug}* returned 0 articles ${ZERO_ARTICLE_ALERT_THRESHOLD} runs in a row — no articles parsed (selector drift?).`,
            );
          }
        });
      }
    }

    if (insertedIds.length > 0) {
      await step.sendEvent('emit-aggregate', {
        name: 'aggregate.link-articles',
        data: { articleIds: insertedIds },
      });
      // T020 — fan out one investigation.article.ingested per new article
      // so the extraction Inngest function (FR-001) picks it up.
      await step.sendEvent(
        'emit-ingested',
        insertedIds.map((id) => ({
          name: 'investigation.article.ingested' as const,
          data: { articleSource: 'news' as const, articleId: id },
        })),
      );
    }

    return { sources: sources.length, newArticles: insertedIds.length };
  },
);

async function persistArticles(
  sourceId: string,
  allowlist: readonly string[],
  scraped: ScrapedArticle[],
  relevantByDefault: boolean,
  monitoredNames: readonly string[],
  logger?: { info?: (...a: unknown[]) => void },
  sourceSlug?: string,
): Promise<string[]> {
  const db = getDb();
  const insertedIds: string[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let consecutiveAiFailures = 0;
  let aiCircuitOpen = false;

  // Scrape-relevancia 3 kupacban (003): a "biztos jó" és "biztos kuka" kulcsszó/
  // URL alapján dől el INGYEN; az AI CSAK a bizonytalan "maybe" kupacra fut, ha
  // van LLM-kulcs. Így olcsó marad, mégis kiszűri a külföld/szemét híreket.
  const useAi = Boolean(process.env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY);

  // 2026-07-21 — user report + mélyaudit: a forrás RSS/címlapja szinte minden
  // órában ugyanazokat a már ismert cikkeket adja vissza (mért:
  // ScraperRun.articlesFound ~8600/nap, articlesNew ~40-70/nap — a "megtalált"
  // cikkek 99%+-a nem új). Eddig a sourceUrlHash-alapú dedup csak a ciklus
  // VÉGÉN, az insert onConflictDoNothing()-jénél futott — vagyis egy már
  // korábban BEILLESZTETT cikk, ha "maybe" kupacba esett, MINDEN órában újra
  // kifizette a classifyArticle()-hívást, mielőtt az insert úgyis no-op lett
  // volna. Ez volt a mért napi LLM-hívásszám (637/nap) döntő hányadának a
  // forrása, nem a tényleges új cikkek mennyisége. Fix: egyetlen batch
  // SELECT-tel előre betöltjük, mely hash-ek szerepelnek már a DB-ben ebből a
  // futásból, és MÉG A TIER-SZÁMÍTÁS ELŐTT kihagyjuk őket — a same-story
  // ellenőrzés és a classify-hívás így soha nem fut le már ismert URL-re.
  // (A minta ugyanaz, mint a kmonitor-traverse-tag.ts-ben: batch SELECT +
  // Set + szűrés, csak ide eddig nem lett átültetve.)
  //
  // Megjegyzés: ez csak a korábban TÉNYLEGESEN BEILLESZTETT cikkeket fogja
  // ki (tier='in', vagy 'maybe'+AI relevánsnak ítélte) — az AI által korábban
  // irrelevánsnak ítélt, ezért be nem illesztett cikkekről nincs hash-nyilván-
  // tartás, azok elméletileg továbbra is újra-classify-elődhetnek, amíg a
  // forrás feedjében maradnak. Ha a hívásszám a fix után is magas marad, ez a
  // következő kör (egy "látott, de elutasított hash" tábla kellene hozzá).
  const canonicalByArticle = scraped.map((a) => canonicalUrl(a.sourceUrl, allowlist));
  const hashByArticle = canonicalByArticle.map((c) => dedupHash(c));
  const existingHashes = hashByArticle.length === 0
    ? new Set<string>()
    : new Set(
        (
          await db
            .select({ hash: schema.newsArticles.sourceUrlHash })
            .from(schema.newsArticles)
            .where(inArray(schema.newsArticles.sourceUrlHash, hashByArticle))
        ).map((r) => r.hash),
      );

  for (let idx = 0; idx < scraped.length; idx += 1) {
    const a = scraped[idx]!;
    const canonical = canonicalByArticle[idx]!;
    const hash = hashByArticle[idx]!;

    if (existingHashes.has(hash)) continue; // már ismert URL — sose ér el a fizetős lépésig

    // 1. Ingyenes előszűrés (kulcsszó + URL-szekció + élő névlista).
    const tier = scrapeRelevanceTier(a.headline, a.excerpt, canonical, relevantByDefault, monitoredNames);
    if (tier === 'out') continue; // biztos kuka — AI nélkül eldobjuk

    // 2026-07-21 — user report: a napi költés majdnem duplájára ugrott egy
    // nagy hírnapon (Sulyok-lemondás utóélete, Polgár Judit-sztori — tucatnyi
    // lap írta meg ugyanazt). A kereszt-forrásos "ugyanaz a sztori" szűrő
    // (findSameStoryDuplicate) régen csak a 3. lépésben, az AI-classify UTÁN
    // futott — vagyis ha 10 lap hozta ugyanazt a sztorit, és mind a 10 a
    // bizonytalan "maybe" kupacba esett, MIND A 10 kifizetett egy classify-
    // hívást, mielőtt a duplikátum-szűrő 9-et eldobott volna. A szűrő maga
    // a NYERS headline/excerpten fut (l. same-story.ts — nem igényli az AI
    // által finomított szöveget), úgyhogy nyugodtan előrébb hozható: most
    // MÉG A CLASSIFY ELŐTT fut, a nyilvánvaló duplikátum sose éri el a fizetős
    // lépést. (A szűrő maga is ritkán hív AI-t — csak a "bizonytalan"
    // hasonlósági sávban, egyetlen jelölt ellen —, de ez a hívás is a közös
    // cache-elt llmExtract()-en megy, tehát ugyanúgy olcsó/kapuzott.)
    const sameStory = await findSameStoryDuplicate({ headline: a.headline, excerpt: a.excerpt, sourceId });
    if (sameStory.duplicate) {
      logger?.info?.(`same-story: skipped "${a.headline}" (matches ${sameStory.matchId}, via ${sameStory.via})`);
      continue;
    }

    let finalExcerpt = a.excerpt;
    let finalTag = a.tag ?? null;
    let finalFeatured = shouldFeature(a.headline, a.excerpt);
    // Breaking-jelölt: börtön/eljárás-trigger + figyelt személy/ügy (kulcsszavas, AI nélkül).
    const finalBreaking = isBreaking(a.headline, a.excerpt, monitoredNames);

    // 2. AI CSAK a bizonytalan "maybe" kupacra (és csak ha van kulcs).
    if (tier === 'maybe' && useAi) {
      // A kör már kinyílt ebben a futásban (3+ egymás utáni API-hiba) — az
      // AI-t feltételezetten halottnak tekintjük a futás hátralévő
      // részére, a bizonytalan cikket inkább eldobjuk, nem hívjuk feleslegesen.
      if (aiCircuitOpen) continue;

      try {
        const ai = await classifyArticle(a.headline, a.excerpt);
        totalInputTokens += ai.inputTokens;
        totalOutputTokens += ai.outputTokens;

        // 2026-07-19: fail-open → fail-closed (user request). 2026-07-11's
        // fail-open logic assumed an apiFailed run was a rare, transient
        // outage (dead credit key) — but a DAILY BUDGET CEILING refusal
        // (l. packages/db/src/llm.ts) is not rare or transient: it fires
        // reliably, every call, for the rest of every day once the shared
        // spend cap is hit. Fail-open under THAT condition meant every
        // uncertain "maybe"-tier article (from a relevantByDefault source)
        // flooded straight onto the site unfiltered for hours at a time —
        // this is what put weather/tram-accident/lawnmowing pieces from
        // Magyar Hang into the news feed on 2026-07-19 (that source has
        // since also lost relevantByDefault entirely, see magyar-hang.ts).
        // Now: any classify failure (budget refusal or a genuine transient
        // API error) discards the uncertain article instead of keeping it
        // — a real corruption story is never lost this way, because a hard
        // keyword/monitored-name match always takes the 'in' tier and
        // bypasses AI entirely, regardless of budget state. The circuit
        // breaker below now exists only to avoid hammering a dead API
        // with pointless retries within one run, not to decide keep/drop.
        if (ai.apiFailed) {
          consecutiveAiFailures += 1;
          if (consecutiveAiFailures >= AI_CIRCUIT_BREAKER_THRESHOLD && !aiCircuitOpen) {
            aiCircuitOpen = true;
            await postEditorAlert(
              `AI-classify tartósan hibázik (${consecutiveAiFailures} egymás utáni API-hiba, pl. napi költés-limit) *${sourceSlug ?? sourceId}* forrásnál — a maradék bizonytalan cikkeket ebben a futásban eldobjuk (fail-closed), amíg az AI/keret vissza nem áll.`,
            );
          }
          logger?.info?.(`classifyArticle: API hiba (${consecutiveAiFailures}/${AI_CIRCUIT_BREAKER_THRESHOLD}), eldobva (fail-closed) — "${a.headline}"`);
          continue;
        } else if (!ai.relevant) {
          consecutiveAiFailures = 0;
          continue; // az AI szerint szemét → eldobjuk
        } else {
          consecutiveAiFailures = 0;
          finalExcerpt = ai.excerpt || a.excerpt;
          if (ai.tag) finalTag = ai.tag;
          if (ai.tag === 'lemondás') finalFeatured = true;
        }
      } catch {
        // Ugyanaz a hiba-számláló, mint az apiFailed ágnál — a try/catch
        // csak a nem-várt (pl. hálózati kivétel) hibákat fogja el, amiket
        // classifyArticle maga nem alakít apiFailed-dé.
        consecutiveAiFailures += 1;
        if (consecutiveAiFailures >= AI_CIRCUIT_BREAKER_THRESHOLD) {
          aiCircuitOpen = true;
          await postEditorAlert(
            `AI-classify tartósan hibázik (${consecutiveAiFailures} egymás utáni kivétel) *${sourceSlug ?? sourceId}* forrásnál — a maradék bizonytalan cikkeket ebben a futásban eldobjuk (fail-closed), amíg az AI vissza nem áll.`,
          );
          continue;
        }
      }
    }

    const inserted = await db
      .insert(schema.newsArticles)
      .values({
        sourceId,
        headline: a.headline.slice(0, 500),
        excerpt: finalExcerpt,
        sourceUrl: canonical,
        sourceUrlHash: hash,
        publishedAt: a.publishedAt,
        tag: finalTag,
        imageUrl: a.imageUrl ?? null,
        featured: finalFeatured,
        isBreakingCandidate: finalBreaking,
      })
      .onConflictDoNothing({ target: schema.newsArticles.sourceUrlHash })
      .returning({ id: schema.newsArticles.id });
    if (inserted[0]) insertedIds.push(inserted[0].id);
  }

  if (useAi && (totalInputTokens > 0 || totalOutputTokens > 0)) {
    const costUsd = ((totalInputTokens / 1_000_000) * 0.8 + (totalOutputTokens / 1_000_000) * 4).toFixed(5);
    logger?.info?.(`AI classify: ${totalInputTokens} in + ${totalOutputTokens} out tokens = ~$${costUsd}`);
  }

  return insertedIds;
}
