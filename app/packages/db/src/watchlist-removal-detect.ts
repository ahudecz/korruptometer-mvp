/**
 * Corroboration check for WATCH_LIST (watchlist-config.ts) "eltávolítva"
 * detections. Called from detect-watchlist-removals.ts.
 *
 * High-stakes by design (these are the sitting President, chief justices,
 * prosecutor general etc.) — deliberately requires the LLM to confirm at
 * least two ARTICLES that both state the mandate has ALREADY, FORMALLY
 * ended (law promulgated/hatályba lépett/megszűnt a megbízatása), not just
 * proposed/submitted/under debate. The caller (detect-watchlist-removals.ts)
 * additionally requires those confirmed articles to come from at least two
 * DISTINCT sources before writing anything.
 */
import { llmExtract, type LlmResult, type LlmToolSpec } from './llm';

export type RemovalCandidateArticle = {
  id: string;
  headline: string;
  excerpt: string | null;
  sourceName: string | null;
  publishedAt: string;
};

export type RemovalCheck = {
  confirmedArticleIds: string[];
  removalType: 'removed' | 'resigned' | 'unclear';
  primarySourceArticleId: string;
  lead: string;
  reason: string;
};

const TOOL: LlmToolSpec = {
  name: 'check_removal',
  description: 'Determine whether a set of recent Hungarian news articles confirm that a named public official has ALREADY, FORMALLY lost their position — not merely that this is proposed or pending.',
  schema: {
    type: 'object' as const,
    properties: {
      confirmedArticleIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'The "id" values of articles that explicitly and unambiguously state the mandate/position has ALREADY ended (past tense, formally enacted/promulgated/effective) — not articles that only say a law was proposed, submitted, is under debate, or "will" end the mandate at some future point.',
      },
      removalType: {
        type: 'string',
        enum: ['removed', 'resigned', 'unclear'],
        description: '"removed" if forced out by law/decision/dismissal; "resigned" if the article frames it as a voluntary resignation; "unclear" if confirmedArticleIds is empty or the framing is ambiguous.',
      },
      primarySourceArticleId: {
        type: 'string',
        description: 'The single best (most detailed, most authoritative) id from confirmedArticleIds to use as the primary cited source. Empty string if confirmedArticleIds is empty.',
      },
      lead: {
        type: 'string',
        description: 'One or two sentence Hungarian summary of what actually happened, based only on the confirmed articles. Empty string if confirmedArticleIds is empty.',
      },
      reason: {
        type: 'string',
        description: 'One short Hungarian sentence explaining the verdict, especially why any article was EXCLUDED (e.g. "csak javaslat, nem elfogadott törvény").',
      },
    },
    required: ['confirmedArticleIds', 'removalType', 'primarySourceArticleId', 'lead', 'reason'],
  },
};

const SYSTEM_PROMPT = `Te a Kegyencjárat (magyar korrupciós adatbázis és NER-összeomlás tracker) szerkesztője vagy.
A feladatod EXTRÉM óvatosan eldönteni, hogy az alább felsorolt cikkek közül melyik állítja
TÉNYSZERŰEN, MÚLT IDŐBEN, MÁR MEGTÖRTÉNTKÉNT, hogy egy közjogi tisztségviselő ELVESZTETTE a
pozícióját/megbízatását — mert ez alapján a Kegyencjárat oldal automatikusan "ELTÁVOLÍTVA"
státuszra vált egy olyan személynél, mint a köztársasági elnök vagy a legfőbb ügyész, ahol egy
téves korai riasztás komoly hitelességi hiba lenne.

KRITIKUS IDŐSÍK-MEGKÜLÖNBÖZTETÉS:
- NE fogadd el, ha a cikk csak arról szól, hogy egy törvényt/törvényjavaslatot BENYÚJTOTTAK,
  JAVASOLTAK, TERVEZNEK, VITATNAK, vagy amiről még csak SZAVAZNI FOGNAK.
- NE fogadd el jövő idejű vagy feltételes megfogalmazást ("meg fog szűnni", "el fogják
  távolítani", "várhatóan", "hamarosan").
- CSAK akkor fogadd el, ha a cikk kifejezetten és múlt időben állítja, hogy a törvényt
  ELFOGADTÁK ÉS KI IS HIRDETTÉK / HATÁLYBA LÉPETT, és emiatt a megbízatás TÉNYLEGESEN,
  MÁR MEGTÖRTÉNT MÓDON megszűnt — vagy hogy a személyt ténylegesen felmentették/eltávolították/
  a helyére mást neveztek ki.
- Ha bizonytalan vagy vegyes a megfogalmazás, NE fogadd el — inkább hagyd ki, mint hogy
  téves riasztást adj.

KRITIKUS SZEMÉLY-AZONOSÍTÁS (ki mondott le, nem csak kinek a neve szerepel a cikkben):
- A cikk-kereső kulcsszavas előszűrés (pl. "Polt Péter") CSAK azt garantálja, hogy a név
  valahol SZEREPEL a cikkben — azt NEM, hogy a vizsgált személy ÖNMAGA veszítette el a
  pozícióját. Magyar birtokos szerkezetek miatt egy cím tartalmazhatja a nevet úgy is, hogy
  valójában egy HOZZÁTARTOZÓJÁRÓL (felesége/férje/lánya/fia/testvére stb.) szól — pl.
  "Polt Péter FELESÉGE mondott le", "X ÉDESAPJÁT mentették fel" — ezek NEM számítanak a
  vizsgált személy távozásának, akkor sem, ha a vizsgált személy neve szó szerint benne van
  a címben.
- Mielőtt bármely cikket elfogadsz, ellenőrizd: a cikk kifejezetten azt állítja-e, hogy MAGA
  a lent megadott "Vizsgált személy" (nem egy hozzátartozója, nem egy vele egy intézményben
  dolgozó más személy) veszítette el a pozícióját. Ha a cikk egy családtagról vagy más
  személyről szól, és a vizsgált személy csak említésként/kontextusként szerepel, EXCLUDE-old
  — ezt írd is a reason mezőbe.

Csak a ténylegesen megerősítő cikkek id-jét told a confirmedArticleIds listába.`;

export async function checkRemoval(
  personName: string,
  institution: string,
  candidates: RemovalCandidateArticle[],
): Promise<LlmResult<RemovalCheck>> {
  const list = candidates
    .map((c) => `[id=${c.id}] (${c.sourceName ?? 'ismeretlen forrás'}, ${c.publishedAt})\n${c.headline}\n${(c.excerpt ?? '').slice(0, 400)}`)
    .join('\n\n');

  const userMsg = `Vizsgált személy: ${personName} (${institution})\n\nCikkek:\n\n${list}`;

  return llmExtract<RemovalCheck>({
    system: SYSTEM_PROMPT,
    user: userMsg,
    tool: TOOL,
    maxTokens: 500,
  });
}
