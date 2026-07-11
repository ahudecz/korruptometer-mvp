import 'server-only';
import { llmExtract, type LlmToolSpec } from '@korr/db/llm';

export interface ClassifyResult {
  relevant: boolean;
  excerpt: string;
  tag: string | null;
  inputTokens: number;
  outputTokens: number;
  /** True when the LLM call itself failed (no credit, network, timeout —
   *  see isTransientLlmFailure) rather than the model genuinely judging the
   *  article irrelevant. Callers should fail OPEN on this (keep the
   *  article) for a relevantByDefault source — dropping trusted-source
   *  content because our own API key ran out of credit is worse than
   *  keeping a few borderline items. */
  apiFailed: boolean;
}

const SYSTEM = `Te egy magyar politikai hírszerkesztő asszisztens vagy egy NER/Fidesz-korrupciót figyelő portál számára. Adott egy cikk headline és excerpt szöveg. Feladatod:
1. Eldönteni, hogy a cikk releváns-e. KIZÁRÓLAG akkor releváns, ha konkrétan a NER-hez, a Fideszhez, vagy kormányzati/állami szereplőkhöz/intézményekhez köthető korrupcióról, közpénz-visszaélésről, lemondásról/kirúgásról, vagy médiaügyről szól.
   NEM releváns, még ha első ránézésre kapcsolódónak is tűnik:
   - Külföldi hírek, háborúk, nemzetközi konfliktusok — kivéve, ha konkrétan egy NER-es/Fideszes szereplőről vagy magyar kormányzati ügyről szól.
   - Általános gazdasági/vállalati hírek, ahol nincs NER/Fidesz-kötődés (pl. egy magáncég környezetszennyezése, egy gazda pere egy céggel) — attól, hogy egy állami hivatal a szokásos, rutinszerű hatósági szerepében megjelenik (pl. bírságot szab ki), MÉG NEM közpénz-ügy.
   - Bűnügyi hírek NER/Fidesz-kötődés nélkül.
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
    // LLM call itself failed (credit exhausted, network, timeout — not the
    // model judging the article). relevant:true here is the fail-open
    // default; scrape-news.ts's caller keys off apiFailed, not this value.
    return { relevant: true, excerpt: rawExcerpt, tag: null, inputTokens, outputTokens, apiFailed: true };
  }

  return {
    relevant: Boolean(data.relevant),
    apiFailed: false,
    excerpt: data.excerpt?.slice(0, 500) || rawExcerpt,
    tag: data.tag || null,
    inputTokens,
    outputTokens,
  };
}
