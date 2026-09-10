/**
 * A nyitóoldali BREAKING csík szövegének tömörítése.
 *
 * 2026-09-10, user jelzés: a csík ~77 szót írt ki (Volánbusz/Kontroll), ami
 * mobilon a képernyő felét kitakarta. A `NewsArticle.headline` ugyanis nem
 * mindig cím — több forrásnál (főleg Kontroll: 30 napos átlag 18 szó, max 64)
 * a lead-bekezdés kerül bele, több mondattal.
 *
 * Kemény korlát: MAX_WORDS szó. A tömörítés viszont NEM nyers vágás — a
 * kimenet mindig nyelvtanilag záródó mondat, ebben a sorrendben:
 *
 *   1. első mondat (a lead többi mondata háttér, nem a lényeg),
 *   2. forrás-hivatkozó előtag levágása ("A Kontroll információi szerint",
 *      "Úgy tudjuk," …) — ez a csíkban amúgy is redundáns, a link a forrásra
 *      mutat,
 *   3. hátravetett határozói bővítmény ("… a beszerzés ügyében"),
 *   4. hátulról az alárendelt tagmondatok (", ami …", ", hogy …"),
 *   5. végül egyéb vesszős tagmondatok, 8 szavas alsóhatárral, hogy ne
 *      maradjon csonk.
 *
 * Ha mindezek után SEM fér bele, a `needsRewrite` igaz — ilyenkor emberi
 * (vagy LLM-es) átfogalmazás kell; a hívó dönti el, mit kezd vele. Vágni
 * ilyenkor sem vágunk szó közepén.
 */

export const MAX_BREAKING_WORDS = 20;

const ATTRIBUTION_RE = new RegExp(
  '^(?:' +
    [
      '(?:a|az)\\s+\\S+\\s+(?:információi|értesülései|értesülése)\\s+szerint',
      '(?:a|az)\\s+\\S+\\s+úgy\\s+tudja',
      'úgy\\s+tudjuk',
      'értesüléseink\\s+szerint',
      'információink\\s+szerint',
      'lapunk\\s+(?:információi|értesülései)\\s+szerint',
    ].join('|') +
    ')\\s*,?\\s*',
  'iu',
);

/** Vonatkozói/alárendelő kötőszóval kezdődő tagmondat: önmagában nem áll meg,
 *  ÉS az előtte lévő főmondat nélküle is teljes — ezért mindig dobható. */
const SUBORDINATE_RE =
  /^(?:ami|amely|amit|amelyet|amelynek|aki|akit|akinek|amiért|ahol|ahonnan|hogy|miközben|miután|mielőtt|mert)\b/iu;

/** Hátravetett határozói bővítmény. A `^(.*\S)` mohó előtag szándékos: az
 *  UTOLSÓ ilyen bővítményt vágjuk le, nem a legelsőt — különben a mondat
 *  cselekvője veszne oda ("… tartott házkutatást [a Nyomozó Iroda a …
 *  beszerzése ügyében]"). */
const TRAILING_MODIFIER_RE =
  /^(.*\S)\s+(?:a|az)\s+[^,]{2,120}?\s(?:ügyében|kapcsán|nyomán|során|miatt|érdekében|okán)\s*$/iu;

const words = (s: string): string[] => s.trim().split(/\s+/).filter(Boolean);
const wordCount = (s: string): number => words(s).length;

/** Első mondat. A mondathatárt "írásjel + szóköz + NAGYBETŰ" adja, így a
 *  rövidítések ("Zrt. volt vezérigazgatója") nem törik ketté a mondatot. */
function firstSentence(text: string): string {
  const m = text.match(/^[\s\S]*?[.!?](?=\s+[A-ZÁÉÍÓÖŐÚÜŰ])/u);
  return (m ? m[0] : text).trim();
}

function stripAttribution(s: string): string {
  const out = s.replace(ATTRIBUTION_RE, '');
  if (!out.trim()) return s;
  // Nagybetűsíteni CSAK akkor kell, ha tényleg levágtunk egy előtagot (a
  // maradék ilyenkor kisbetűs névelővel indul). Érintetlen mondatot nem
  // írunk át — az a forrás szövegének néma módosítása lenne.
  if (out === s) return s;
  return out.charAt(0).toUpperCase() + out.slice(1);
}

function dropTrailingModifier(s: string): string {
  const shorter = s.replace(TRAILING_MODIFIER_RE, '$1');
  return wordCount(shorter) >= 8 ? shorter : s;
}

function trimClauses(s: string): string {
  let out = wordCount(s) > MAX_BREAKING_WORDS ? dropTrailingModifier(s) : s;

  const parts = out.split(/,\s*/);
  while (parts.length > 1 && SUBORDINATE_RE.test(parts[parts.length - 1] ?? '')) {
    if (wordCount(parts.slice(0, -1).join(', ')) < 4) break;
    parts.pop();
  }
  while (parts.length > 1 && wordCount(parts.join(', ')) > MAX_BREAKING_WORDS) {
    if (wordCount(parts.slice(0, -1).join(', ')) < 8) break;
    parts.pop();
  }
  out = parts.join(', ');

  if (wordCount(out) > MAX_BREAKING_WORDS) out = dropTrailingModifier(out);
  return out;
}

export type CondensedBreaking = {
  /** A csíkba kiírandó szöveg. */
  text: string;
  /** Igaz, ha a szabályalapú tömörítés sem fért be MAX_BREAKING_WORDS szóba —
   *  ilyenkor valódi átfogalmazás kell, a szöveg TÚL HOSSZÚ maradt. */
  needsRewrite: boolean;
};

export function condenseBreakingHeadline(headline: string): CondensedBreaking {
  const raw = (headline ?? '').replace(/\s+/g, ' ').trim();
  if (!raw) return { text: '', needsRewrite: false };
  if (wordCount(raw) <= MAX_BREAKING_WORDS) return { text: raw, needsRewrite: false };

  const sentence = stripAttribution(firstSentence(raw)).replace(/\.$/, '');
  if (wordCount(sentence) <= MAX_BREAKING_WORDS) return { text: sentence, needsRewrite: false };

  const trimmed = trimClauses(sentence).replace(/[,;:]$/, '');
  return { text: trimmed, needsRewrite: wordCount(trimmed) > MAX_BREAKING_WORDS };
}
