/**
 * LLM-based media closure / mass layoff detector.
 * Called from the Inngest detect-media-closures function.
 */
import Anthropic from '@anthropic-ai/sdk';

const MODEL = process.env.RESIGNATION_LLM_MODEL ?? 'claude-haiku-4-5-20251001';

export type MediaClosureExtraction = {
  isClosure: boolean;
  name: string;
  eventType: 'megszűnés' | 'leépítés' | 'elmaradt esemény' | 'egyéb';
  description: string;
  eventDate: string;
  confidence: number;
};

const TOOL: Anthropic.Tool = {
  name: 'extract_media_closure',
  description: 'Extract structured data about a Hungarian NER-aligned media closure, mass layoff, or cancelled event from a news article.',
  input_schema: {
    type: 'object' as const,
    properties: {
      isClosure: {
        type: 'boolean',
        description: 'True if the article is about a NER-connected medium shutting down, mass layoffs at a media outlet, or a NER-linked event being cancelled.',
      },
      name: {
        type: 'string',
        description: 'Name of the medium, show, or event. E.g. "Pesti Srácok", "Magyar Nemzet", "Tűzfalcsoport konferencia". Empty string if isClosure is false.',
      },
      eventType: {
        type: 'string',
        enum: ['megszűnés', 'leépítés', 'elmaradt esemény', 'egyéb'],
        description: 'megszűnés = complete shutdown; leépítés = mass layoffs but outlet continues; elmaradt esemény = cancelled event/show; egyéb = other.',
      },
      description: {
        type: 'string',
        description: 'One or two sentence summary in Hungarian. Empty if isClosure is false.',
      },
      eventDate: {
        type: 'string',
        description: "Date of the event (ISO 8601, YYYY-MM-DD). Use today's date if only 'today' or 'recently' is mentioned.",
      },
      confidence: {
        type: 'number',
        description: 'Confidence 0–1 that this is a real media closure/layoff/cancellation.',
      },
    },
    required: ['isClosure', 'name', 'eventType', 'description', 'eventDate', 'confidence'],
  },
};

const SYSTEM_PROMPT = `Te egy magyar politikai médiát elemző asszisztens vagy.
A feladatod megállapítani, hogy egy cikk NER-közeli médium megszűnéséről, tömeges leépítéséről, vagy NER-hez kötött rendezvény/műsor elmaradásáról szól-e.

NER-közeli médiumnak minősül:
- KESMA-csoport tagjai: Magyar Nemzet, Ripost, Lokál, Bors, Figyelő, Világgazdaság stb.
- Origó.hu, Pesti Srácok, Mandiner, 888.hu, Origo.hu, TV2, Hír TV, Echo TV, M1
- ATV (csak ha NER-tartalmakról van szó), állami médiumok (MTVA, M1, M2, M4)
- Kormányközeli alapítványok rendezvényei (Tűzfalcsoport, Alapjogokért, XXI. Század Intézet)

Csak akkor jelöld isClosure=true-val, ha:
- Egyértelmű, hogy egy NER-közeli médium ténylegesen megszűnik vagy bezár
- Tömeges elbocsátás/leépítés történt egy NER-médiumban (nem 1-2 fő)
- Egy bejelentett NER-rendezvény, konferencia, műsor elmarad vagy lemondják

Ne jelöld, ha csak személycsere/főszerkesztő-váltás, vagy ha nem NER-közeli médiumról van szó.`;

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export async function detectMediaClosureFromArticle(
  headline: string,
  excerpt: string,
  todayIso: string,
): Promise<MediaClosureExtraction | null> {
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
    return toolUse.input as MediaClosureExtraction;
  } catch {
    return null;
  }
}
