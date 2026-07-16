/**
 * LLM-based criminal complaint (feljelentés) detector.
 * Called from the Inngest detect-criminal-complaints function.
 * Uses the switchable LLM layer (LangDock/Gemini/Claude — see ./llm).
 */
import { llmExtract, type LlmResult, type LlmToolSpec } from './llm';

export type ComplaintStatusExtracted = 'feljelentés' | 'nyomozás' | 'vádemelés' | 'ítélet' | 'elutasítva';

export type ComplaintEvent = {
  targetName: string;
  filerName: string;
  description: string;
  status: ComplaintStatusExtracted;
  confidence: number;
};

/**
 * An article can (and often does) describe SEVERAL distinct criminal
 * complaints at once — e.g. a single kormányinfó press conference announcing
 * 5 unrelated complaints in one story (see spec 009 Input for a real
 * example). `complaints` is empty when the article describes no complaint
 * that meets the relevance bar below.
 */
export type ComplaintExtraction = {
  complaints: ComplaintEvent[];
};

const TOOL: LlmToolSpec = {
  name: 'extract_criminal_complaints',
  description:
    'Extract structured data about EVERY Hungarian criminal complaint (feljelentés) described in a news article that targets NER-connected or state-related actors. An article can describe several distinct, unrelated complaints — extract one entry per complaint, not just the most prominent one.',
  schema: {
    type: 'object' as const,
    properties: {
      complaints: {
        type: 'array',
        description:
          'One entry per distinct criminal complaint / legal proceeding update described in the article. Empty array if the article describes no complaint meeting the relevance criteria in the system prompt. If several distinct complaints are described in one article (e.g. a press conference announcing 5 separate complaints), you MUST include ALL of them as separate array entries.',
        items: {
          type: 'object' as const,
          properties: {
            targetName: {
              type: 'string',
              description:
                'Short, specific, stable Hungarian label for the CASE or TARGET the complaint is about (e.g. "Orbán-kori gyanús közbeszerzések", "281 milliárdos állami befektetés — Mészáros/Tiborcz/Nagy Márton érdekkör", "Tiborczhoz köthető cégek Alteo-részvény akciója"). This is the matching key used to link follow-up articles about the SAME case — keep it specific enough to not collide with an unrelated case against the same institution, but do not bake a person\'s name in as the sole label if the case is really about an institution/scheme.',
            },
            filerName: {
              type: 'string',
              description:
                'Who is filing/filed the complaint — institution or person (e.g. "Miniszterelnökség", "a kormány", "Transparency International", "Hadházy Ákos"). No restriction on who this can be — government, opposition, civil society, private citizen are all valid.',
            },
            description: {
              type: 'string',
              description: 'One or two sentence Hungarian summary of what the complaint/development is about.',
            },
            status: {
              type: 'string',
              enum: ['feljelentés', 'nyomozás', 'vádemelés', 'ítélet', 'elutasítva'],
              description:
                'feljelentés = a complaint was just filed, nothing further reported yet; nyomozás = police/authority investigation confirmed opened as a result; vádemelés = formal indictment followed; ítélet = a court verdict was reached; elutasítva = the complaint was rejected/dismissed or the case was dropped. Use the HIGHEST stage explicitly confirmed in THIS article — if the article only reports the filing, use "feljelentés" even if you suspect more happened elsewhere.',
            },
            confidence: {
              type: 'number',
              description: 'Confidence 0–1 that THIS SPECIFIC entry is a real criminal complaint meeting the relevance criteria.',
            },
          },
          required: ['targetName', 'filerName', 'description', 'status', 'confidence'],
        },
      },
    },
    required: ['complaints'],
  },
};

const SYSTEM_PROMPT = `Te egy magyar korrupciós ügyeket elemző asszisztens vagy.
A feladatod megtalálni egy cikkben MINDEN olyan feljelentést (büntetőeljárást kezdeményező bejelentést) vagy egy MÁR MEGLÉVŐ feljelentéshez kapcsolódó fejleményt (nyomozás indítása, vádemelés, ítélet, elutasítás), amelynek TÁRGYA az alábbiak közül legalább egyhez kapcsolódik:

- NER-hez (Nemzeti Együttműködés Rendszeréhez) köthető személyek, cégek, alapítványok
- Állami/kormányzati szereplők, minisztériumok, állami intézmények, állami vállalatok
- NER-hez kapcsolódó gazdasági szereplők, üzletemberek, vállalatcsoportok
- Az előző (Orbán-kori) kormányzat tevékenysége, döntései, kinevezettjei

A FELJELENTŐ KILÉTE NEM SZÁMÍT — bárki lehet: kormány, minisztérium, ellenzéki
politikus, civil szervezet (pl. Transparency International), újságíró,
magánszemély. KIZÁRÓLAG a feljelentés TÁRGYA (kire/mire vonatkozik) dönt.

NE vegyél fel bejegyzést, ha:
- A feljelentés tárgya tisztán magánjellegű, NER/állami kontextus nélküli
  ügy (pl. rágalmazás, becsületsértés két magánfél vagy két politikus között,
  ami nem korrupciós/közpénzes jellegű) — még akkor sem, ha a felek közéleti
  szereplők
- A feljelentés egy NER-közeli/kormányzati szereplőtől ÉS egy kormánykritikus
  személy/szervezet ELLEN irányul (pl. egy kormányszóvivő feljelentése egy
  ellenzéki politikus ellen rágalmazásért) — itt a TÁRGY (a célpont) nem
  NER-es/állami, tehát nem esik a hatókörbe, függetlenül attól, hogy a
  feljelentő kormányzati szereplő
- Más ország ügyéről van szó
- Csak spekuláció, fenyegetőzés vagy szándéknyilatkozat ("fontolgatja a
  feljelentést", "feljelentéssel fenyeget") — a feljelentésnek TÉNYLEGESEN
  meg kell történnie (múlt idő: "feljelentést tett", "feljelentette")

FONTOS — több különálló feljelentés egy cikkben: egy kormányinfó vagy más
sajtóesemény gyakran több, EGYMÁSTÓL FÜGGETLEN feljelentést jelent be egyszerre
(pl. "öt korrupciógyanús ügyben tett feljelentést a kormány" — ha a cikk
felsorolja/körülírja az öt ügyet, mindegyiket KÜLÖN bejegyzésként vedd fel).
Ha a cikk csak összesítve említi a számot konkrét ügyek nélkül, egyetlen
általános bejegyzést vegyél fel.

FONTOS — a "status" mező: mindig a cikkben TÉNYLEGESEN megerősített legmagasabb
fázist add meg. Ha a cikk csak a feljelentés megtételéről szól, "feljelentés"
a helyes érték — ne feltételezz további fejleményt, amit a cikk nem állít.`;

/** See resignation-detect.ts for why this returns the full LlmResult. */
export async function detectCriminalComplaintFromArticle(
  headline: string,
  excerpt: string,
  todayIso: string,
): Promise<LlmResult<ComplaintExtraction>> {
  const userMsg = `Cikk:
Cím: ${headline}
Szöveg: ${excerpt}

Mai dátum: ${todayIso}`;

  return llmExtract<ComplaintExtraction>({
    system: SYSTEM_PROMPT,
    user: userMsg,
    tool: TOOL,
    maxTokens: 1024,
  });
}
