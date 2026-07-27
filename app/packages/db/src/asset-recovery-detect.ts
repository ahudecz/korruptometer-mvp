/**
 * LLM-based asset recovery detector.
 * Called from the Inngest detect-asset-recoveries function.
 */
import { llmExtract, type LlmResult, type LlmToolSpec } from './llm';

export type AssetRecoveryEvent = {
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

/**
 * 2026-07-27 — az EDDA/NKA-cikk egyszerre jelentett két KÜLÖNÁLLÓ, névvel
 * elkülönített összeget (100M az Edda zenekar saját támogatása, 150M az
 * EDDA Művek – Aréna 2026 koncertre ítélt támogatás) — a korábbi egy-objektumos
 * séma kényszerítette a modellt, hogy csak az egyiket vegye fel, a másik
 * csendben elveszett. Ugyanaz a hibaosztály, mint a resignation-detect.ts
 * 2026-07-14-i multi-person fixe — l. ott a részletes indoklást.
 */
export type AssetRecoveryExtraction = {
  recoveries: AssetRecoveryEvent[];
};

const TOOL: LlmToolSpec = {
  name: 'extract_asset_recoveries',
  description: 'Extract structured data about EVERY distinct Hungarian public asset recovery (visszaszerzett közvagyon) described in a news article. An article can report several separate, differently-labelled amounts (e.g. two different grants revoked in the same ministerial action) — extract one entry per distinct amount, not just the first-mentioned or largest.',
  schema: {
    type: 'object' as const,
    properties: {
      recoveries: {
        type: 'array',
        description:
          'One entry per DISTINCT reported recovery/repayment/confiscation amount. Empty array if the article reports no such event. If the article names several separate amounts — even for the same overarching case (e.g. "a 100 milliós Edda-támogatást és a 150 milliós Aréna 2026-os támogatást is visszavonta") — you MUST include ALL of them as separate array entries, each with its own caseLabel/description/amountFt. Never collapse them into one entry or pick just the first/largest.',
        items: {
          type: 'object' as const,
          properties: {
            caseLabel: {
              type: 'string',
              description: 'Short label for this specific asset recovery case/amount in Hungarian (e.g. "NKA visszafizetés", "Elios-ügy kártérítés"). Two entries from the same article must have DIFFERENT labels if they refer to different grants/amounts.',
            },
            description: {
              type: 'string',
              description: 'One or two sentence description in Hungarian of what was recovered and how, specific to THIS entry\'s amount.',
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
              description: 'Confidence 0–1 that THIS SPECIFIC entry is a genuinely recovered public asset in a NER-connected case.',
            },
          },
          required: ['caseLabel', 'description', 'amountFt', 'amountIsCumulativeTotal', 'recoveredAt', 'confidence'],
        },
      },
    },
    required: ['recoveries'],
  },
};

const SYSTEM_PROMPT = `Te egy magyar korrupcióellenes híreket elemző asszisztens vagy.
A feladatod megtalálni egy cikkben MINDEN olyan esetet, amikor közpénz vagy közjavak visszaszerzéséről, visszafizetéséről, elkobzásáról van szó Magyarországon — NER-közeli esetekben.

Ide tartozik:
- Bírósági vagyonelkobzás NER-hez kötött ügyekben
- Kötelezett kártérítés visszafizetése (pl. NKA-botrány visszafizetés)
- Lefoglalt és elkobzott vagyon (pl. legyőzött ügyekben állami szervek által lefoglalt összegek)
- Bírságok, visszatérítések, amelyek az állami kasszába kerülnek

Csak akkor vegyél fel egy bejegyzést, ha:
- Ténylegesen visszakerül/visszakerült valami a közpénzbe
- NER-hez kötött ügy (nem általános magánjogi vita)
- Egyértelmű összeg vagy visszaszerzési esemény

Ne vegyél fel bejegyzést, ha csak ígéret, nyomozás, vagy civil per folyik visszatérítés nélkül.

KRITIKUS — TÖBB KÜLÖNÁLLÓ ÖSSZEG EGY CIKKBEN: ha a cikk több, egymástól elkülönülő összeget is megnevez (akár ugyanahhoz az átfogó ügyhöz kötődve is, pl. "a 100 milliós Edda-támogatást ÉS a 150 milliós Aréna 2026-os támogatást is visszavonta"), MINDEGYIKET vedd fel a recoveries tömbbe, külön-külön bejegyzésként, külön caseLabellel. Ne vonj össze két elkülönített összeget egybe, és ne válaszd csak az elsőként említettet vagy a legnagyobbat.

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
    maxTokens: 1024,
  });
}
