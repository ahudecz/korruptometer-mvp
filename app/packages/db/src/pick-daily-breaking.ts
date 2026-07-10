/**
 * Picks the single editorially most important recent article to pin as the
 * homepage BREAKING banner (NewsArticle.breakingOverride), independent of
 * the site's fixed tracked-case keyword list (Hatvanpuszta, NKA, Mészáros,
 * etc.) — so a big story outside that list (a minister's interview, a mass
 * protest, a fresh arrest) can still surface instead of the banner going
 * stale for days. Called from a periodic Inngest cron; see
 * refresh-daily-breaking.ts.
 */
import { llmExtract, type LlmResult, type LlmToolSpec } from './llm';

export type BreakingCandidate = {
  id: string;
  headline: string;
  excerpt: string | null;
  sourceName: string | null;
  publishedAt: string;
};

export type BreakingPick = {
  hasPick: boolean;
  selectedId: string;
  reason: string;
};

const TOOL: LlmToolSpec = {
  name: 'pick_breaking',
  description: 'Select the single most editorially important recent Hungarian political/corruption news article to feature as a breaking-news banner.',
  schema: {
    type: 'object' as const,
    properties: {
      hasPick: {
        type: 'boolean',
        description: 'True if at least one candidate is genuinely significant enough to feature. False only if every candidate is minor/routine.',
      },
      selectedId: {
        type: 'string',
        description: 'The "id" field of the chosen candidate. Empty string if hasPick is false.',
      },
      reason: {
        type: 'string',
        description: 'One short Hungarian sentence explaining why this is the most important story right now.',
      },
    },
    required: ['hasPick', 'selectedId', 'reason'],
  },
};

const SYSTEM_PROMPT = `Te a Kegyencjárat (korrupciós adatbázis és NER-összeomlás tracker) szerkesztője vagy.
A feladatod: az alább felsorolt, elmúlt napokban megjelent cikkek közül kiválasztani AZT AZ EGYET,
amelyik a legfontosabb, leginkább "BREAKING" jellegű hír a nap folyamán — azt, amit egy olvasó
elsőként akarna látni az oldal tetején.

Mit tekints fontosnak (növekvő fontossági sorrendben nem, hanem együtt mérlegelve):
- Konkrét letartóztatás, őrizetbe vétel, vádemelés, ítélet, felmentés politikailag kötött személynél
- Magas rangú NER-vezető (miniszter, államtitkár, korábbi kormánytag) lemondása/menesztése/leleplezése
- Jelentős, korábban nem ismert korrupciós összefüggés nyilvánosságra kerülése (pl. egy interjú,
  amiben valaki belülről beszél titkos pénzmozgásokról)
- Jelentős intézményi/politikai fejlemény, ami közvetlenül a rendszerváltáshoz/elszámoltatáshoz kötődik
  (pl. nagy tüntetés, alaptörvény-módosítás, intézmény megszűnése)

Mit NE válassz, ha van nála fontosabb:
- Rutin napi politikai csörték, véleménycikkek, elemzések, amik nem tartalmaznak új tényt
- Külföldi hírek, sporthírek, témán kívüli anyagok

Csak akkor adj hasPick=false-t, ha TÉNYLEG semmi számottevő nincs a listában.`;

/** See resignation-detect.ts / court-verdict-detect.ts for why this returns the full LlmResult. */
export async function pickDailyBreaking(
  candidates: BreakingCandidate[],
): Promise<LlmResult<BreakingPick>> {
  const list = candidates
    .map((c, i) => `${i + 1}. [id=${c.id}] (${c.sourceName ?? 'ismeretlen forrás'}, ${c.publishedAt})\n${c.headline}\n${(c.excerpt ?? '').slice(0, 300)}`)
    .join('\n\n');

  const userMsg = `Cikkek:\n\n${list}`;

  return llmExtract<BreakingPick>({
    system: SYSTEM_PROMPT,
    user: userMsg,
    tool: TOOL,
    maxTokens: 300,
  });
}
