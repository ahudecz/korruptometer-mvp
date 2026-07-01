/**
 * LLM-based asset recovery detector.
 * Called from the Inngest detect-asset-recoveries function.
 */
import { llmExtract, type LlmToolSpec } from './llm';

export type AssetRecoveryExtraction = {
  isRecovery: boolean;
  caseLabel: string;
  description: string;
  amountFt: number;
  recoveredAt: string;
  confidence: number;
};

const TOOL: LlmToolSpec = {
  name: 'extract_asset_recovery',
  description: 'Extract structured data about a Hungarian public asset recovery (visszaszerzett közvagyon) from a news article.',
  schema: {
    type: 'object' as const,
    properties: {
      isRecovery: {
        type: 'boolean',
        description: 'True if the article reports that public assets were recovered, fines paid, state funds returned, or corrupt officials ordered to repay money in Hungary.',
      },
      caseLabel: {
        type: 'string',
        description: 'Short label for this asset recovery case in Hungarian (e.g. "NKA visszafizetés", "Elios-ügy kártérítés"). Empty if isRecovery is false.',
      },
      description: {
        type: 'string',
        description: 'One or two sentence description in Hungarian of what was recovered and how. Empty if isRecovery is false.',
      },
      amountFt: {
        type: 'number',
        description: 'Amount recovered in Hungarian Forint (integer). 0 if exact amount is unknown. Convert from millions/billions: 1 millió = 1000000, 1 milliárd = 1000000000.',
      },
      recoveredAt: {
        type: 'string',
        description: "Date the recovery was reported or happened as ISO 8601 (YYYY-MM-DD). Use today's date if only 'today' is mentioned.",
      },
      confidence: {
        type: 'number',
        description: 'Confidence 0–1 that public assets were genuinely recovered in a NER-connected case.',
      },
    },
    required: ['isRecovery', 'caseLabel', 'description', 'amountFt', 'recoveredAt', 'confidence'],
  },
};

const SYSTEM_PROMPT = `Te egy magyar korrupcióellenes híreket elemző asszisztens vagy.
A feladatod megállapítani, hogy egy cikk közpénz vagy közjavak visszaszerzéséről, visszafizetéséről, elkobzásáról szól-e Magyarországon — NER-közeli esetekben.

Ide tartozik:
- Bírósági vagyonelkobzás NER-hez kötött ügyekben
- Kötelezett kártérítés visszafizetése (pl. NKA-botrány visszafizetés)
- Lefoglalt és elkobzott vagyon (pl. legyőzött ügyekben állami szervek által lefoglalt összegek)
- Bírságok, visszatérítések, amelyek az állami kasszába kerülnek

Csak akkor jelöld isRecovery=true-val, ha:
- Ténylegesen visszakerül/visszakerült valami a közpénzbe
- NER-hez kötött ügy (nem általános magánjogi vita)
- Egyértelmű összeg vagy visszaszerzési esemény

Ne jelöld, ha csak ígéret, nyomozás, vagy civil per folyik visszatérítés nélkül.`;

export async function detectAssetRecoveryFromArticle(
  headline: string,
  excerpt: string,
  todayIso: string,
): Promise<AssetRecoveryExtraction | null> {
  const userMsg = `Cikk:
Cím: ${headline}
Szöveg: ${excerpt}

Mai dátum: ${todayIso}`;

  const { data } = await llmExtract<AssetRecoveryExtraction>({
    system: SYSTEM_PROMPT,
    user: userMsg,
    tool: TOOL,
    maxTokens: 512,
  });
  return data;
}
