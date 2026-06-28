import 'server-only';
import { llmExtract, type LlmToolSpec } from '@korr/db/llm';

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
3. Ha releváns: rendelj hozzá egyet ezek közül a tagek közül: korrupció | lemondás | médiaügy | közpénz | NER-vagyon | jogállamiság | egyéb`;

const TOOL: LlmToolSpec = {
  name: 'classify_article',
  description: 'Classify a Hungarian news article for a corruption-watch portal.',
  schema: {
    type: 'object',
    properties: {
      relevant: {
        type: 'boolean',
        description: 'True if relevant to NER/Fidesz/corruption/public-money/resignations/media topics.',
      },
      excerpt: {
        type: 'string',
        description: 'Max 2-sentence concise Hungarian summary. Empty if not relevant.',
      },
      tag: {
        type: 'string',
        description: 'One of: korrupció | lemondás | médiaügy | közpénz | NER-vagyon | jogállamiság | egyéb. Empty if not relevant.',
      },
    },
    required: ['relevant', 'excerpt', 'tag'],
  },
};

export async function classifyArticle(
  headline: string,
  rawExcerpt: string,
): Promise<ClassifyResult> {
  const userMsg = `Headline: ${headline}\nExcerpt: ${rawExcerpt}`;

  const { data, inputTokens, outputTokens } = await llmExtract<{
    relevant: boolean;
    excerpt: string;
    tag: string | null;
  }>({
    system: SYSTEM,
    user: userMsg,
    tool: TOOL,
    maxTokens: 300,
  });

  if (!data) {
    return { relevant: false, excerpt: rawExcerpt, tag: null, inputTokens, outputTokens };
  }

  return {
    relevant: Boolean(data.relevant),
    excerpt: data.excerpt?.slice(0, 500) || rawExcerpt,
    tag: data.tag || null,
    inputTokens,
    outputTokens,
  };
}
