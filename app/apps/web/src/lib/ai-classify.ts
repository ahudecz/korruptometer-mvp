import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ClassifyResult {
  relevant: boolean;
  excerpt: string;
  tag: string | null;
  inputTokens: number;
  outputTokens: number;
}

const SYSTEM = `Te egy magyar politikai hírszerkesztő asszisztens vagy. Adott egy cikk headline és excerpt szöveg. Feladatod:
1. Eldönteni, hogy a cikk releváns-e egy korrupció-figyelő portál számára (NER, Fidesz, korrupció, közpénz-ügyek, lemondások, médiaügy).
2. Ha releváns: írj egy max. 2 mondatos, tömör magyar összefoglalót (excerpt). Legyen konkrét, ne általános.
3. Ha releváns: rendelj hozzá egyet ezek közül a tagek közül: korrupció | lemondás | médiaügy | közpénz | NER-vagyon | jogállamiság | egyéb

Válaszolj CSAK ebben a JSON formátumban, semmi más:
{"relevant":true/false,"excerpt":"szöveg","tag":"tag vagy null"}`;

export async function classifyArticle(
  headline: string,
  rawExcerpt: string,
): Promise<ClassifyResult> {
  const userMsg = `Headline: ${headline}\nExcerpt: ${rawExcerpt}`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: SYSTEM,
    messages: [{ role: 'user', content: userMsg }],
  });

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;

  const text = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';

  let parsed: { relevant: boolean; excerpt: string; tag: string | null };
  try {
    parsed = JSON.parse(text);
  } catch {
    // fallback: ha nem sikerül parse-olni, relevance=false
    return { relevant: false, excerpt: rawExcerpt, tag: null, inputTokens, outputTokens };
  }

  return {
    relevant: Boolean(parsed.relevant),
    excerpt: parsed.excerpt?.slice(0, 500) || rawExcerpt,
    tag: parsed.tag || null,
    inputTokens,
    outputTokens,
  };
}
