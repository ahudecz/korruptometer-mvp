/**
 * LLM-based political resignation detector.
 * Called from the Inngest detect-resignations function.
 * Uses the switchable LLM layer (LangDock/Gemini/Claude — see ./llm).
 */
import { llmExtract, type LlmResult, type LlmToolSpec } from './llm';

export type ResignationExtraction = {
  isResignation: boolean;
  name: string;
  position: string;
  institution: string;
  resignationType: 'lemondás' | 'kirúgás' | 'felmentés' | 'egyéb';
  resignationDate: string;
  description: string;
  confidence: number;
};

const TOOL: LlmToolSpec = {
  name: 'extract_resignation',
  description:
    'Extract structured data about a Hungarian political resignation, firing or dismissal from a news article.',
  schema: {
    type: 'object' as const,
    properties: {
      isResignation: {
        type: 'boolean',
        description:
          'True if this article is about a political figure resigning, being fired, or being dismissed in Hungary.',
      },
      name: {
        type: 'string',
        description: 'Full name of the person WHO IS LEAVING the position (not the person who made the decision to fire them). Empty string if isResignation is false.',
      },
      position: {
        type: 'string',
        description:
          'The role/title of the person LEAVING (e.g. "miniszter", "államtitkár", "polgármester"). Empty if not a resignation.',
      },
      institution: {
        type: 'string',
        description:
          'Organisation or institution the person is LEAVING (e.g. "Kulturális Minisztérium", "MVM"). Empty if not applicable.',
      },
      resignationType: {
        type: 'string',
        enum: ['lemondás', 'kirúgás', 'felmentés', 'egyéb'],
        description:
          'lemondás = voluntary resignation; kirúgás = fired/dismissed; felmentés = formally relieved of duties; egyéb = other.',
      },
      resignationDate: {
        type: 'string',
        description:
          "Date of the event as ISO 8601 (YYYY-MM-DD). Use today's date if only 'today' or 'recently' is mentioned.",
      },
      description: {
        type: 'string',
        description:
          'Maximum 4-6 word Hungarian label for what happened — shown in a chart, must be very short. E.g. "MCC kuratóriumi elnökről lemondott", "Kulturális Minisztériumból kirúgták". Empty if not a resignation.',
      },
      confidence: {
        type: 'number',
        description:
          'Confidence score 0–1 that this is a real political resignation/firing/dismissal.',
      },
    },
    required: [
      'isResignation',
      'name',
      'position',
      'institution',
      'resignationType',
      'resignationDate',
      'description',
      'confidence',
    ],
  },
};

const SYSTEM_PROMPT = `Te egy magyar politikai híreket elemző asszisztens vagy.
A feladatod eldönteni, hogy egy cikk politikai személyek lemondásáról, kirúgásáról, felmentéséről, vagy politikailag kötött médium/intézmény tömeges elbocsátásáról/bezárásáról szól-e Magyarországon.

Politikai személynek vagy szervezetnek minősül:
- Miniszterek, államtitkárok, miniszterelnökök
- Országgyűlési képviselők
- Polgármesterek, alpolgármesterek, önkormányzati tisztségviselők
- Állami vállalatok, alapítványok, közintézmények vezetői
- Pártvezetők, politikai tisztségviselők
- NER-közeli médiumok (Pesti Srácok, Világgazdaság, Magyar Nemzet, Origó, KESMA-médiumok) szerkesztői, újságírói — tömeges kirúgás esetén is
- Kulturális, oktatási, tudományos intézmények politikailag kinevezett vezetői

Tömeges elbocsátásnál (pl. "kirúgják az összes Pesti Srácok-munkatársat") a "name" mezőbe a szerkesztőség/outlet neve kerüljön (pl. "Pesti Srácok szerkesztőség"), a "position" mezőbe "újságíró, szerkesztő", az "institution" mezőbe a médium neve.

Csak akkor jelöld isResignation=true-val, ha az eltávolítás/lemondás már MEGTÖRTÉNT (befejezett tény, múlt idejű ige: lemondott, felmentette, kirúgták, leváltotta, visszahívták stb.).

NE jelöld isResignation=true-val, ha:
- Csak terv, szándék, spekuláció, követelés ("intézi el", "le kell váltani", "leváltják majd", "kérték a lemondását", "nem áll távol a lemondás", "belengette")
- Más ország politikusáról van szó
- Az ige jövő idejű vagy feltételes ("el fogja távolítani", "leválthatják")

KRITIKUS — ki hagyja el a pozíciót vs. ki hozza a döntést:
- A "felmentette X az Y-t" mondatban Y hagyja el a pozícióját (nem X)
- A "Magyar Péter javaslatára Sulyok Tamás felmentette Koltay Andrást" → Koltay András hagyja el a pozíciót (name = Koltay András)
- Az aláíró, a döntéshozó, a javaslatot tevő személy SOHA nem kerülhet a "name" mezőbe

FONTOS: A "name" mezőbe mindig AZT a személyt/szervzetet írd, aki ténylegesen elhagyja a pozícióját — NEM azt, aki a döntést hozta, aláírta, vagy javasolta.`;

/**
 * Returns the full LlmResult (not just `data`) so callers can distinguish a
 * TRANSIENT failure (API/network/credit error — data is null AND zero
 * tokens were counted, because the request never completed) from a genuine
 * "no resignation here" result — see isTransientLlmFailure() in
 * detection-check.ts. This distinction is what lets 006's backlog scan
 * retry an article instead of silently discarding it after an outage.
 */
export async function detectResignationFromArticle(
  headline: string,
  excerpt: string,
  todayIso: string,
): Promise<LlmResult<ResignationExtraction>> {
  const userMsg = `Cikk:
Cím: ${headline}
Szöveg: ${excerpt}

Mai dátum: ${todayIso}`;

  return llmExtract<ResignationExtraction>({
    system: SYSTEM_PROMPT,
    user: userMsg,
    tool: TOOL,
    maxTokens: 512,
  });
}
