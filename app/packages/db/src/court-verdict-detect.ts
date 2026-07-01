/**
 * LLM-based court verdict / pretrial detention detector.
 * Called from the Inngest detect-verdicts function.
 */
import { llmExtract, type LlmToolSpec } from './llm';

export type VerdictExtraction = {
  isVerdict: boolean;
  personName: string;
  position: string;
  crimes: string[];
  sentenceYears: number;
  sentenceMonths: number | null;
  sentenceLabel: string;
  verdictType: 'előzetesben' | 'elsőfokú' | 'jogerős' | 'vádemelés' | 'egyéb';
  verdictDate: string;
  court: string;
  summary: string;
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
        enum: ['előzetesben', 'elsőfokú', 'jogerős', 'vádemelés', 'egyéb'],
        description: 'előzetesben = pretrial detention ordered; elsőfokú = first-degree verdict; jogerős = final/binding verdict; vádemelés = indictment filed; egyéb = other.',
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
      confidence: {
        type: 'number',
        description: 'Confidence 0–1 that this is a real court verdict/pretrial/indictment of a politically connected person in Hungary.',
      },
    },
    required: [
      'isVerdict', 'personName', 'position', 'crimes', 'sentenceYears',
      'sentenceMonths', 'sentenceLabel', 'verdictType', 'verdictDate',
      'court', 'summary', 'confidence',
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

Csak akkor jelöld isVerdict=true-val, ha:
- Egyértelmű, hogy bírósági döntés, előzetes letartóztatás, vagy formális vádemelés történt
- Magyar ügyre vonatkozik
- Az érintett politikailag kötött személy, VAGY egy politikai/közpénzes
  korrupciós ügy gyanúsítottja/vádlottja (akkor is, ha nem politikus)

Ne jelöld, ha:
- Csak nyomozás folyik (előzetes letartóztatás nélkül)
- Más ország ügyéről van szó
- Csak spekuláció vagy vélemény`;

export async function detectVerdictFromArticle(
  headline: string,
  excerpt: string,
  todayIso: string,
): Promise<VerdictExtraction | null> {
  const userMsg = `Cikk:
Cím: ${headline}
Szöveg: ${excerpt}

Mai dátum: ${todayIso}`;

  const { data } = await llmExtract<VerdictExtraction>({
    system: SYSTEM_PROMPT,
    user: userMsg,
    tool: TOOL,
    maxTokens: 512,
  });
  return data;
}
