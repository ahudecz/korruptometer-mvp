/**
 * LLM-based court verdict / pretrial detention detector.
 * Called from the Inngest detect-verdicts function.
 */
import { llmExtract, type LlmResult, type LlmToolSpec } from './llm';

export type VerdictExtraction = {
  isVerdict: boolean;
  personName: string;
  position: string;
  crimes: string[];
  sentenceYears: number;
  sentenceMonths: number | null;
  sentenceLabel: string;
  verdictType: 'előzetesben' | 'elsőfokú' | 'jogerős' | 'vádemelés' | 'szabadlábra helyezve' | 'eljárás megszűnt' | 'felmentve' | 'egyéb';
  verdictDate: string;
  court: string;
  summary: string;
  /** Max 6 word teaser for the homepage/birosagi-iteletek "legfrissebb" summary blocks. */
  description: string;
  confidence: number;
};

const TOOL: LlmToolSpec = {
  name: 'extract_verdict',
  description: 'Extract structured data about a Hungarian court verdict, pretrial detention, or indictment from a news article.',
  schema: {
    type: 'object' as const,
    properties: {
      isVerdict: {
        type: 'boolean',
        description: 'True if the article is about a court verdict, pretrial detention order, or indictment related to a Hungarian political figure or NER-connected person.',
      },
      personName: {
        type: 'string',
        description: 'Full name of the person. Empty string if isVerdict is false.',
      },
      position: {
        type: 'string',
        description: 'Role/title of the person (e.g. "volt polgármester", "miniszter", "vállalkozó"). Empty if isVerdict is false.',
      },
      crimes: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of crimes charged with or convicted of, in Hungarian (e.g. "hűtlen kezelés", "vesztegetés", "sikkasztás"). Empty array if isVerdict is false.',
      },
      sentenceYears: {
        type: 'number',
        description: 'Prison sentence in years (integer). 0 for pretrial detention, indictment, or acquittal.',
      },
      sentenceMonths: {
        type: 'number',
        description: 'Additional months of sentence beyond sentenceYears. Null if not applicable.',
      },
      sentenceLabel: {
        type: 'string',
        description: 'Human-readable sentence label in Hungarian (e.g. "3 év börtön", "előzetes letartóztatás", "vádemelés", "felmentés"). Empty string if isVerdict is false.',
      },
      verdictType: {
        type: 'string',
        enum: ['előzetesben', 'elsőfokú', 'jogerős', 'vádemelés', 'szabadlábra helyezve', 'eljárás megszűnt', 'felmentve', 'egyéb'],
        description: 'előzetesben = held in custody/pretrial detention; elsőfokú = first-degree verdict; jogerős = final/binding verdict; vádemelés = indictment filed; szabadlábra helyezve = released from custody/detention (article reports the person was let go — this is itself a reportable status change, not "nothing happened"); eljárás megszűnt = proceedings terminated/dropped; felmentve = acquitted; egyéb = other.',
      },
      verdictDate: {
        type: 'string',
        description: "Date of the verdict/detention/indictment as ISO 8601 (YYYY-MM-DD). Use today's date if only 'today' is mentioned.",
      },
      court: {
        type: 'string',
        description: 'Name of the court in Hungarian (e.g. "Fővárosi Törvényszék", "Budaörsi Járásbíróság"). "Ismeretlen bíróság" if not mentioned.',
      },
      summary: {
        type: 'string',
        description: 'One or two sentence summary in Hungarian of what happened. Empty if isVerdict is false.',
      },
      description: {
        type: 'string',
        description: 'Ultra-short Hungarian teaser, MAXIMUM 6 words, format "Név: esemény, ügy" (e.g. "Szakács István: letartóztatás, terrorcselekmény előkészítése"). Empty string if isVerdict is false.',
      },
      confidence: {
        type: 'number',
        description: 'Confidence 0–1 that this is a real court verdict/pretrial/indictment of a politically connected person in Hungary.',
      },
    },
    required: [
      'isVerdict', 'personName', 'position', 'crimes', 'sentenceYears',
      'sentenceMonths', 'sentenceLabel', 'verdictType', 'verdictDate',
      'court', 'summary', 'description', 'confidence',
    ],
  },
};

const SYSTEM_PROMPT = `Te egy magyar politikai bírósági ügyeket elemző asszisztens vagy.
A feladatod megállapítani, hogy egy cikk politikailag kötött személy ellen indított büntetőeljárásról szól-e Magyarországon — legyen szó előzetes letartóztatásról, vádemelésről, elsőfokú vagy jogerős ítéletről.

Politikailag kötött személynek minősül:
- Jelenlegi vagy volt miniszterek, államtitkárok, miniszterelnökök
- Jelenlegi vagy volt polgármesterek, alpolgármesterek, képviselők
- Állami vállalatok, KESMA, NER-közeli alapítványok (MCC, Alapjogokért stb.) vezetői
- NER-hez kötött vállalkozók, tanácsadók
- Pártvezetők, politikai tisztségviselők

FONTOS — nem politikusok is beleszámítanak: ha valakit egy POLITIKAI vagy
KÖZPÉNZES korrupciós ügyben tartóztatnak le / állítanak bíróság elé, akkor
akkor is jelöld, ha ő maga nem politikus és nem NER-közeli. Ide tartoznak pl.:
- Közbeszerzést nyerő vállalkozók, alvállalkozók, cégtulajdonosok
- Kenőpénz-közvetítők, strómanok, tanácsadók
- Bárki, aki az ügy gyanúsítottja/vádlottja a politikusok mellett
Példa: a parkfenntartási kenőpénzbotrányban a politikusok mellett letartóztatott
parkfenntartó vállalkozó és a kenőpénz-közvetítő is beleszámít.

FONTOS — politikai indíttatású eljárások is beleszámítanak: ha valakit
NYILVÁNVALÓAN POLITIKAI indíttatású (nem hagyományos bűnügyi) eljárásban
tartóztatnak le / állítanak bíróság elé / ítélnek el — pl. egy kormánykritikus
közösségimédia-tartalom, tüntetésen való részvétel, vagy a kormánnyal szembeni
nyilvános kiállás miatt —, akkor is jelöld, ha az érintett:
- NER-közeli közéleti szereplő (pl. állami propagandaszervezet, pl. Megafon,
  munkatársa/aktivistája), VAGY
- nyilvánosan ismert, kormánykritikus közéleti szereplő.
Ez nem klasszikus korrupciós ügy, de a rendszer célja a NER-hez köthető
jogi fellépések nyomon követése is, nem csak a korrupciós elszámoltatásé.
Példa: egy állami propagandaoldal munkatársát letartóztatják, mert kritikus
posztot írt a kormányfő nyilatkozatára reagálva — ez jelölendő.

FONTOS — a szabadon engedés/kiengedés is önálló, jelölendő esemény: ha egy
korábban letartóztatott/őrizetbe vett/előzetesben lévő személyt szabadlábra
helyeznek, elengednek a rendőrségről, vagy megszüntetik/ejtik ellene az
eljárást, ez ÖNMAGÁBAN is isVerdict=true, verdictType='szabadlábra helyezve'
(vagy 'eljárás megszűnt'/'felmentve') — NEM "nem történt semmi". Ez egy
állapotváltozás, amit a korábbi letartóztatás-bejegyzés frissítéséhez
használunk.

Csak akkor jelöld isVerdict=true-val, ha:
- Egyértelmű, hogy bírósági döntés, előzetes letartóztatás, szabadon
  engedés/az eljárás megszüntetése, vagy formális vádemelés történt
- Magyar ügyre vonatkozik
- Az érintett politikailag kötött személy, VAGY egy politikai/közpénzes
  korrupciós ügy gyanúsítottja/vádlottja (akkor is, ha nem politikus), VAGY
  egy fent leírt politikai indíttatású eljárás érintettje

Ne jelöld, ha:
- Csak nyomozás folyik (előzetes letartóztatás, vádemelés vagy ítélet nélkül)
- Más ország ügyéről van szó
- Csak spekuláció vagy vélemény
- Az érintett teljesen ismeretlen magánszemély, nincs közéleti szerepe, és
  az ügy sem politikai, sem közpénzes/korrupciós jellegű`;

/** See resignation-detect.ts for why this returns the full LlmResult. */
export async function detectVerdictFromArticle(
  headline: string,
  excerpt: string,
  todayIso: string,
): Promise<LlmResult<VerdictExtraction>> {
  const userMsg = `Cikk:
Cím: ${headline}
Szöveg: ${excerpt}

Mai dátum: ${todayIso}`;

  return llmExtract<VerdictExtraction>({
    system: SYSTEM_PROMPT,
    user: userMsg,
    tool: TOOL,
    maxTokens: 512,
  });
}
