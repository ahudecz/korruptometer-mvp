/**
 * LLM-based political resignation detector.
 * Called from the Inngest detect-resignations function.
 * Uses the switchable LLM layer (LangDock/Gemini/Claude — see ./llm).
 */
import { llmExtract, type LlmResult, type LlmToolSpec } from './llm';

export type ResignationEvent = {
  name: string;
  position: string;
  institution: string;
  resignationType: 'lemondás' | 'kirúgás' | 'felmentés' | 'egyéb';
  resignationDate: string;
  description: string;
  confidence: number;
};

/**
 * 2026-07-14 — an article can (and often does) describe SEVERAL distinct
 * people/organizations leaving positions in the same story (e.g. an MÁV
 * board reshuffle naming 5 people at once). The old single-object schema
 * forced the model to pick just one, silently dropping the rest.
 * `resignations` is empty when the article describes no completed departure.
 */
export type ResignationExtraction = {
  resignations: ResignationEvent[];
};

const TOOL: LlmToolSpec = {
  name: 'extract_resignations',
  description:
    'Extract structured data about EVERY Hungarian political resignation, firing or dismissal described in a news article. An article can name several different people/organizations leaving different positions — extract one entry per person, not just the most prominent one.',
  schema: {
    type: 'object' as const,
    properties: {
      resignations: {
        type: 'array',
        description:
          'One entry per person or organization whose resignation/firing/dismissal is described as an ALREADY-COMPLETED fact. Empty array if the article describes no such completed departure. If several distinct people are named as leaving positions — even packed into a single sentence, e.g. "Barna Zsolt, Bethlen Miklós és Deák Tibor lemondott, Lepsényi Istvánt pedig felmentették" — you MUST include ALL of them as separate array entries. Never pick just the first-mentioned or most prominent one.',
        items: {
          type: 'object' as const,
          properties: {
            name: {
              type: 'string',
              description:
                'Full name of the person WHO IS LEAVING the position (not the person who made the decision to fire them).',
            },
            position: {
              type: 'string',
              description:
                'The role/title of the person LEAVING (e.g. "miniszter", "államtitkár", "polgármester").',
            },
            institution: {
              type: 'string',
              description:
                'Organisation or institution the person is LEAVING (e.g. "Kulturális Minisztérium", "MVM").',
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
                'Maximum 4-6 word Hungarian label for what happened — shown in a chart, must be very short. E.g. "MCC kuratóriumi elnökről lemondott", "Kulturális Minisztériumból kirúgták".',
            },
            confidence: {
              type: 'number',
              description:
                'Confidence score 0–1 that THIS SPECIFIC entry is a real political resignation/firing/dismissal.',
            },
          },
          required: ['name', 'position', 'institution', 'resignationType', 'resignationDate', 'description', 'confidence'],
        },
      },
    },
    required: ['resignations'],
  },
};

const SYSTEM_PROMPT = `Te egy magyar politikai híreket elemző asszisztens vagy.
A feladatod megtalálni egy cikkben MINDEN olyan politikai személyt vagy szervezetet, akinek/aminek a lemondásáról, kirúgásáról, felmentéséről, vagy politikailag kötött médium/intézmény tömeges elbocsátásáról/bezárásáról szól a cikk Magyarországon.

Politikai személynek vagy szervezetnek minősül:
- Miniszterek, államtitkárok, miniszterelnökök
- Országgyűlési képviselők
- Polgármesterek, alpolgármesterek, önkormányzati tisztségviselők
- Állami vállalatok, alapítványok, közintézmények vezetői
- Pártvezetők, politikai tisztségviselők
- NER-közeli médiumok (Pesti Srácok, Világgazdaság, Magyar Nemzet, Origó, KESMA-médiumok) szerkesztői, újságírói — tömeges kirúgás esetén is
- Kulturális, oktatási, tudományos intézmények politikailag kinevezett vezetői

Tömeges elbocsátásnál (pl. "kirúgják az összes Pesti Srácok-munkatársat") a "name" mezőbe a szerkesztőség/outlet neve kerüljön (pl. "Pesti Srácok szerkesztőség"), a "position" mezőbe "újságíró, szerkesztő", az "institution" mezőbe a médium neve.

KRITIKUS — TÖBB SZEMÉLY EGY CIKKBEN: ha a cikk több különböző embert/szervezetet is megnevez, akik/amik elhagyják a pozíciójukat (akár csak felsorolásszerűen, egyetlen mondatban, pl. "X, Y és Z lemondott, W-t pedig felmentették"), MINDEGYIKÜKET vedd fel a resignations tömbbe, külön-külön bejegyzésként. Ne csak az elsőként említettet vagy a legfontosabbat emeld ki — egy tömör felsorolásban szereplő minden név külön esemény.

Csak akkor vegyél fel egy bejegyzést, ha az adott személy eltávolítása/lemondása már MEGTÖRTÉNT (befejezett tény, múlt idejű ige: lemondott, felmentette, kirúgták, leváltotta, visszahívták stb.).

NE vegyél fel bejegyzést, ha:
- Csak terv, szándék, spekuláció, követelés ("intézi el", "le kell váltani", "leváltják majd", "kérték a lemondását", "nem áll távol a lemondás", "belengette")
- Más ország politikusáról van szó
- Az ige jövő idejű vagy feltételes ("el fogja távolítani", "leválthatják")
- Csak egy törvényt/alaptörvény-módosítást/rendeletet SZAVAZTAK MEG vagy FOGADTAK EL, amely majd — további lépés (elnöki/miniszterelnöki aláírás, kihirdetés, meghatározott hatálybalépési határidő) UTÁN — megszünteti a pozíciót. A jogszabály elfogadása MÉG NEM egyenlő a tényleges távozással: ha a cikk azt írja, hogy a mandátum "a hatálybalépést követő napon szűnik meg", vagy aláírásra/kihirdetésre vár, akkor az érintett MÉG hivatalban van — ezt hagyd ki, még akkor is, ha a szavazás/elfogadás múlt idejű.

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
    maxTokens: 1024,
  });
}
