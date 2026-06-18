/**
 * LLM-based political resignation detector.
 * Called from the Inngest detect-resignations function.
 * Uses @anthropic-ai/sdk which is already a dependency of @korr/db.
 */
import Anthropic from '@anthropic-ai/sdk';

const MODEL = process.env.RESIGNATION_LLM_MODEL ?? 'claude-haiku-4-5-20251001';

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

const TOOL: Anthropic.Tool = {
  name: 'extract_resignation',
  description:
    'Extract structured data about a Hungarian political resignation, firing or dismissal from a news article.',
  input_schema: {
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
          'One or two sentence summary of what happened, in Hungarian. Empty if not a resignation.',
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

Csak akkor jelöld isResignation=true-val, ha egyértelmű, hogy valaki/valakik elhagyják a pozíciójukat, vagy médium szűnik meg/bocsát el tömegesen.
Ne jelöld, ha csak spekuláció, bejelentett tervek (nem befejezett tény), vagy ha más ország politikusáról van szó.

FONTOS: A "name" mezőbe mindig AZT a személyt/szervzetet írd, aki elhagyja a pozícióját — NEM azt, aki a döntést hozta.`;

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export async function detectResignationFromArticle(
  headline: string,
  excerpt: string,
  todayIso: string,
): Promise<ResignationExtraction | null> {
  const userMsg = `Cikk:
Cím: ${headline}
Szöveg: ${excerpt}

Mai dátum: ${todayIso}`;

  try {
    const response = await getClient().messages.create({
      model: MODEL,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      tools: [TOOL],
      tool_choice: { type: 'any' },
      messages: [{ role: 'user', content: userMsg }],
    });

    const toolUse = response.content.find(
      (b: Anthropic.ContentBlock) => b.type === 'tool_use',
    );
    if (!toolUse || toolUse.type !== 'tool_use') return null;
    return toolUse.input as ResignationExtraction;
  } catch {
    return null;
  }
}
