import 'server-only';

/**
 * ChatGPT-alapú "hangszín-átfogalmazás" a Social Post Outbox sablon-alapú
 * (social-caption.ts) szövegei fölé — user kérés, 2026-09-07: a sablonok
 * ("🚨 KICKER / headline / detail") ténybelileg pontosak, de a user szerint
 * "kurva unalmasak", nem néznek ki élő Facebook-posztnak, és nem akarja
 * Telegramon egyesével javítgatni minden jelöltet.
 *
 * SZÁNDÉKOSAN szűk hatókörű: csak a `headline` + `detail` mezőt fogalmazza
 * át (a kép nagy szövege és a poszt-szöveg törzse), a link/CTA/hashtag
 * lábjegyzetet a hívó (check-social-triggers.ts) MINDIG kódból, a polish
 * UTÁN ragasztja hozzá — így egy hallucinált/rossz URL vagy CTA soha nem
 * kerülhet ki, a modell csak a "hangot" írhatja át, a tényeket nem.
 *
 * Kulcs (OPENAI_API_KEY) nélkül vagy hívási hiba esetén NÉMÁN, változatlan
 * bemenettel tér vissza — a sablon-szöveg pontosan úgy megy ki, mint eddig.
 * Ez a fail-open tudatos: egy poszt kimenetel-nélküli szövege rosszabb
 * felhasználói kár, mint egy unalmas, de tényszerűen helyes poszt.
 *
 * Hívásszám: a check-social-triggers.ts óránként legfeljebb egyszer épít
 * egy-egy JELÖLTET trigger-típusonként (nem minden jelöltet fogad el —
 * l. TARGET_PER_DAY —, de a jelölt-építés, ezzel ez a hívás is, minden
 * érintett órában lefut, amíg a jelölt vagy ki nem megy, vagy el nem évül).
 * Nincs itt külön napi-keret-kapu, mint az Anthropic-detektorok llm.ts-
 * ében: még pesszimista (napi több tucat hívásos) forgatókönyv mellett is
 * elhanyagolható a gpt-4o-mini áránál ($0,15/1M input token) — ha ez
 * változik (drágább modell, sokkal nagyobb hívásszám), ide is kell majd
 * egy ceiling.
 */

export type SocialCopyPolishInput = {
  /** A trigger fajtája — a hangszín kalibrálásához (pl. a kvíznél lehet
   *  játékosabb, egy ítéletnél komolyabb). Csak promptba kerül, séma-elágazás
   *  nincs rajta. */
  triggerType: string;
  headline: string;
  /** Sortömbként is jöhet (l. renderBreakingImage) — a modellhez egyetlen
   *  sztringgé fűzzük, a válaszban is egy sztringet várunk vissza. */
  detail?: string | string[] | undefined;
};

export type SocialCopyPolishResult = {
  headline: string;
  detail: string | undefined;
};

const DEFAULT_MODEL = 'gpt-4o-mini';

const TONE_HINTS: Record<string, string> = {
  quiz_highlight: 'Játékos, csábító hangvétel — hívd fel a figyelmet, hogy próbálja ki a kvízt.',
  poll_final_result: 'Lezáró, összefoglaló hangvétel — mondd ki egyértelműen, MIRŐL szólt a szavazás és mi lett a végeredmény.',
  court_verdict: 'Komoly, tényszerű, de ütős hangvétel — ítéletről van szó.',
  resignation: 'Ütős, hír-jellegű hangvétel egy lemondásról/kirúgásról.',
  media_closure: 'Ütős, hír-jellegű hangvétel egy médiumot érintő eseményről.',
  asset_recovery: 'Elégtétel-jellegű, "visszaszerzett közpénz" hangvétel.',
  criminal_complaint: 'Tényszerű, de figyelemfelhívó hangvétel egy feljelentésről.',
  catalog_highlight: 'Felidéző, "emlékszel még erre?" jellegű hangvétel egy régebbi üggyel kapcsolatban.',
  gallery_highlight: 'Felidéző, "emlékszel még erre?" jellegű hangvétel egy régebbi üggyel kapcsolatban.',
};

function flattenDetail(detail: string | string[] | undefined): string | undefined {
  if (detail == null) return undefined;
  const s = Array.isArray(detail) ? detail.join(' ') : detail;
  const trimmed = s.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Átfogalmazza a headline + detail páros szövegét egy élénkebb, Facebook-
 * posztba illő hangra. Ld. fájl-fejléc a garanciákról (tényhű, fail-open).
 */
export async function polishSocialCopy(input: SocialCopyPolishInput): Promise<SocialCopyPolishResult> {
  const flatDetail = flattenDetail(input.detail);
  const fallback: SocialCopyPolishResult = { headline: input.headline, detail: flatDetail };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback;

  const model = process.env.OPENAI_SOCIAL_MODEL ?? DEFAULT_MODEL;
  const toneHint = TONE_HINTS[input.triggerType] ?? 'Ütős, hír-jellegű Facebook-hangvétel.';

  const system = [
    'Te a "Kegyencjárat" nevű magyar korrupció-figyelő Facebook-oldal posztszövegírója vagy.',
    'Egy tényszerű, de sablonos cím + alátámasztó szöveg érkezik — a feladatod ÁTFOGALMAZNI, hogy éljen egy Facebook-posztként: ütős, figyelemfelhívó, emberi hangon, mértékkel emojizva.',
    toneHint,
    '',
    'SZIGORÚ SZABÁLYOK:',
    '- Egyetlen számot, nevet, dátumot vagy tényt SEM szabad megváltoztatni, kitalálni vagy hozzáadni — csak a MEGFOGALMAZÁS változhat.',
    '- Ne találj ki linket, CTA-t vagy hashtaget — azt a hívó kód teszi hozzá külön.',
    '- Magyarul írj. A headline max. kb. 100 karakter, a detail max. kb. 200 karakter.',
    '- Ha a detail mező üres/hiányzik a bemenetben, a válaszban is hagyd üresen (üres string) — ne generálj ki a semmiből tartalmat.',
    '- Válaszolj KIZÁRÓLAG egy JSON objektummal: {"headline": "...", "detail": "..."}.',
  ].join('\n');

  const user = JSON.stringify({ headline: input.headline, detail: flatDetail ?? '' });

  const timeoutMs = Number(process.env.OPENAI_SOCIAL_TIMEOUT_MS ?? 20000);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 300,
        temperature: 0.8,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[social-copy-polish] OpenAI HTTP ${res.status}: ${body.slice(0, 300)}`);
      return fallback;
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return fallback;

    const parsed = JSON.parse(content) as { headline?: unknown; detail?: unknown };
    const headline = typeof parsed.headline === 'string' && parsed.headline.trim().length > 0 ? parsed.headline.trim() : input.headline;
    const detailOut = typeof parsed.detail === 'string' && parsed.detail.trim().length > 0 ? parsed.detail.trim() : flatDetail;
    return { headline, detail: detailOut };
  } catch (err) {
    console.error('[social-copy-polish] OpenAI hívás sikertelen, sablon-szöveg megy ki változatlanul:', err instanceof Error ? err.message : err);
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}
