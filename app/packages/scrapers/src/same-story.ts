/**
 * Cross-source "same story" detection — pure, DB-free heuristic half.
 *
 * When several outlets cover the same event (e.g. Telex/HVG/Magyar Hang all
 * reporting on the same Áder-villa drone video, or Telex/444 both reporting
 * Guller Zoltán's double firing), each becomes its own NewsArticle row today
 * because sourceUrlHash dedup only catches literal same-URL re-scrapes, not
 * the same real-world event reported at different URLs.
 *
 * This module extracts likely person/entity name candidates from a headline
 * (a cheap, AI-free regex heuristic — Hungarian journalistic headlines mark
 * proper names with two consecutive capitalised words) so the DB layer can
 * narrow its search to recent articles that plausibly cover the same event,
 * then hands the wsim (pg_trgm word_similarity) score to decideSameStoryTier
 * to pick 'duplicate' (skip, no AI) / 'ambiguous' (worth an AI check) /
 * 'distinct' (unrelated, skip AI).
 */

const TITLE_WORD_RE = /^[A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű]+$/;
const STRIP_PUNCT_RE = /^[„"'(«]+|["'”»),.:;!?]+$/g;

/**
 * Overlapping two-word bigrams from every maximal run of consecutive
 * Title-Case words in a headline, deduplicated case-insensitively.
 * Sentence-initial capitals don't match alone because a lone word never
 * forms a pair, and a 3+ word run (e.g. "Magyar Turisztikai Ügynökség")
 * yields every adjacent pair so a shorter mention elsewhere ("Guller
 * Zoltánt") can still line up with it via substring containment.
 */
export function extractNameCandidates(headline: string): string[] {
  const words = headline.split(/\s+/).map((w) => w.replace(STRIP_PUNCT_RE, ''));
  const candidates: string[] = [];
  const seen = new Set<string>();
  let run: string[] = [];

  const flushRun = () => {
    for (let i = 0; i + 1 < run.length; i++) {
      const pair = `${run[i]} ${run[i + 1]}`;
      const key = pair.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        candidates.push(pair);
      }
    }
    run = [];
  };

  for (const w of words) {
    if (TITLE_WORD_RE.test(w)) {
      run.push(w);
    } else {
      flushRun();
    }
  }
  flushRun();

  return candidates;
}

/**
 * Hungarian is agglutinative — the same name comes out inflected
 * differently depending on the sentence ("Szakács István" nominative vs.
 * "Szakács Istvánt" accusative when he's the grammatical object of
 * "letartóztatták"). Two outlets covering the same event can headline it
 * around the same name in different grammatical cases, which defeats a
 * literal ILIKE substring match entirely (neither string contains the
 * other). Truncate the last word of a candidate before it's used to build
 * a search pattern, so the match lands on the shared stem instead of the
 * exact inflected form — e.g. "Szakács Istvánt" and "Szakács István" both
 * reduce to a "Szakács Istvá" stem, which is a substring/prefix of both.
 * Guarded to only touch names long enough that a 2-char chop still leaves
 * a distinctive stem (short names pass through unchanged, since
 * over-truncating risks matching unrelated people).
 */
export function stemCandidate(candidate: string): string {
  const words = candidate.split(' ');
  const last = words[words.length - 1];
  if (!last || last.length < 6) return candidate;
  words[words.length - 1] = last.slice(0, -2);
  return words.join(' ');
}

/** Below this word_similarity score, two headlines are treated as unrelated — free. */
export const SAME_STORY_LOW = 0.15;
/** At or above this score (with a shared name candidate), auto-flag as the same story — free. */
export const SAME_STORY_HIGH = 0.27;

export type SameStoryTier = 'distinct' | 'ambiguous' | 'duplicate';

/**
 * Routes a pg_trgm word_similarity score into the three-tier decision.
 * Calibrated against real examples (see same-story.test.ts): true same-story
 * pairs scored 0.29–0.76 wsim; unrelated pairs sharing a repeated name
 * (e.g. two different "Áder János" stories on different days) topped out
 * at ~0.21 wsim.
 */
export function decideSameStoryTier(wsim: number): SameStoryTier {
  if (wsim >= SAME_STORY_HIGH) return 'duplicate';
  if (wsim >= SAME_STORY_LOW) return 'ambiguous';
  return 'distinct';
}
