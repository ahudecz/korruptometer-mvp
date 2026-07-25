/**
 * LLM-based asset recovery detector.
 * Called from the Inngest detect-asset-recoveries function.
 */
import { llmExtract, type LlmResult, type LlmToolSpec } from './llm';

export type AssetRecoveryExtraction = {
  isRecovery: boolean;
  caseLabel: string;
  description: string;
  amountFt: number;
  // 2026-07-25 — NKA-eset: egy cikk "eddig összesen 2,5 milliárd forintot
  // fizettek vissza" jellegű FUTÓ ÖSSZESÍTŐT közölt (nem azt, hogy mennyi
  // jött vissza ÚJONNAN e cikk kapcsán), a detektor mégis ezt vette fel friss
  // amountFt-ként — mivel a korábbi bejegyzésekből már 2,29 milliárd az NKA-s
  // rész, ez majdnem duplikálta a valós, kb. 210 milliós növekményt. Ez a
  // mező kényszeríti a modellt explicit eldönteni: a fenti amountFt egy
  // FUTÓ ÖSSZESÍTŐ-e (true), vagy a cikk EGYÉRTELMŰEN külön nevesíti, mennyi
  // az ÚJ, e cikk kapcsán történt növekmény (false). true esetén a detektor
  // NEM inzertál automatikusan (emberi ellenőrzésre megy), nehogy duplikáljon.
  amountIsCumulativeTotal: boolean;
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
      amountIsCumulativeTotal: {
        type: 'boolean',
        description: 'True if amountFt is a RUNNING/CUMULATIVE total the article cites for an ongoing case (e.g. "eddig összesen 2,5 milliárd forintot fizettek vissza", "a 17 milliárdos keretből X milliárd térült meg mostanáig") — i.e. the grand total to date, not specifically how much came back as a NEW result of what THIS article reports. False only if the article clearly states the NEW incremental amount from this specific report (e.g. "most további 220 millió forintot fizettek vissza", a standalone one-off recovery/fine with no earlier reports on the same case, or the article explicitly breaks out "ebből X az új"). When in doubt, prefer true — treating a cumulative figure as a fresh amount causes double-counting against earlier entries for the same case.',
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
    required: ['isRecovery', 'caseLabel', 'description', 'amountFt', 'amountIsCumulativeTotal', 'recoveredAt', 'confidence'],
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

Ne jelöld, ha csak ígéret, nyomozás, vagy civil per folyik visszatérítés nélkül.

KRITIKUS — futó összesítő vs. új növekmény: egy elhúzódó ügyben (pl. NKA-
botrány) a cikkek gyakran egy FUTÓ ÖSSZESÍTŐT idéznek ("eddig összesen X
milliárd forintot fizettek vissza", "a 17 milliárdos keretből Y milliárd
térült meg mostanáig") — ez NEM ugyanaz, mint amennyi ÚJONNAN, E CIKK
kapcsán jött vissza. Ha az összesítőt vennéd fel amountFt-ként, az
DUPLIKÁLNÁ a korábban már rögzített részleteket ugyanabból az ügyből.
Ezért:
- Ha a cikk csak egy futó összesítőt közöl (nem bontja külön, mennyi az új
  rész), amountIsCumulativeTotal=true, és amountFt-be MAGÁT az összesítőt
  tedd (ez a szám kerül emberi ellenőrzésre, nem automatikus közzétételre).
- Ha a cikk EGYÉRTELMŰEN elválasztja, mennyi az új (pl. "most további 220
  millió forintot fizettek vissza, így összesen 2,6 milliárd"), akkor
  amountIsCumulativeTotal=false, és amountFt=220 millió (CSAK az új rész,
  ne az összesítő).
- Egyszeri, önálló ügynél (nincs korábbi jelentés ugyanarról az esetről),
  amountIsCumulativeTotal=false.`;

/** See resignation-detect.ts for why this returns the full LlmResult. */
export async function detectAssetRecoveryFromArticle(
  headline: string,
  excerpt: string,
  todayIso: string,
): Promise<LlmResult<AssetRecoveryExtraction>> {
  const userMsg = `Cikk:
Cím: ${headline}
Szöveg: ${excerpt}

Mai dátum: ${todayIso}`;

  return llmExtract<AssetRecoveryExtraction>({
    system: SYSTEM_PROMPT,
    user: userMsg,
    tool: TOOL,
    maxTokens: 512,
  });
}
