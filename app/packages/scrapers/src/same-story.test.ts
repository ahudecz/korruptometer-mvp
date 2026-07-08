import { describe, expect, it } from 'vitest';
import { extractNameCandidates, decideSameStoryTier, stemCandidate, SAME_STORY_LOW, SAME_STORY_HIGH } from './same-story';

describe('extractNameCandidates', () => {
  it('extracts a Hungarian person name from a headline', () => {
    expect(extractNameCandidates('Drónvideón mutatta meg Magyar Péter a közpénzhorgász Áder János villáját')).toEqual([
      'Magyar Péter',
      'Áder János',
    ]);
  });

  it('extracts a person name from the Guller headlines', () => {
    expect(extractNameCandidates('Egy héten belül kétszer is kirúgták Guller Zoltánt')).toEqual(['Guller Zoltánt']);
    expect(
      extractNameCandidates('A Magyar Turisztikai Ügynökség igazgatóságából is visszahívták Guller Zoltánt'),
    ).toEqual(['Magyar Turisztikai', 'Turisztikai Ügynökség', 'Guller Zoltánt']);
  });

  it('does not match a lone sentence-initial capitalised word', () => {
    expect(extractNameCandidates('Bezárt egy médium ma reggel')).toEqual([]);
  });

  it('deduplicates repeated candidates case-insensitively', () => {
    expect(extractNameCandidates('Orbán Viktor és orbán viktor ugyanaz')).toEqual(['Orbán Viktor']);
  });
});

describe('stemCandidate', () => {
  it('truncates a long inflected last word so different noun cases share a stem', () => {
    // "Szakács Istvánt" (accusative) vs. "Szakács István" (nominative) — two
    // outlets reporting the same arrest, one naming him as the grammatical
    // object, the other as the subject.
    expect(stemCandidate('Szakács Istvánt')).toBe('Szakács Istvá');
    expect(stemCandidate('Szakács István')).not.toBe('Szakács Istvánt');
    // The accusative's stem must line up as a substring/prefix of the
    // nominative's full form — that's what makes the ILIKE search work.
    expect('Szakács István'.startsWith(stemCandidate('Szakács Istvánt'))).toBe(true);
  });

  it('leaves short last words untouched to avoid over-truncating into noise', () => {
    expect(stemCandidate('Magyar Péter')).toBe('Magyar Péter');
    expect(stemCandidate('Áder János')).toBe('Áder János');
  });
});

describe('decideSameStoryTier', () => {
  it('treats real same-story pairs as duplicate or at least ambiguous (calibration data)', () => {
    // Actual word_similarity() scores measured against pg_trgm for the
    // 2026-07-03 Áder-villa (3 outlets) and Guller (2 outlets) stories.
    expect(decideSameStoryTier(0.757)).toBe('duplicate'); // hvg vs telex (villa)
    expect(decideSameStoryTier(0.33)).toBe('duplicate'); // hang vs telex (villa)
    expect(decideSameStoryTier(0.291)).toBe('duplicate'); // hang vs hvg (villa)
    expect(decideSameStoryTier(0.347)).toBe('duplicate'); // 444 vs telex (guller)
  });

  it('treats unrelated pairs that merely share a repeated name as distinct or ambiguous, never a silent duplicate skip above the high bar', () => {
    // Two different Áder János stories from different days — highest
    // measured false-positive noise was wsim 0.207.
    expect(decideSameStoryTier(0.207)).not.toBe('duplicate');
    expect(decideSameStoryTier(0.12)).toBe('distinct');
  });

  it('boundaries', () => {
    expect(decideSameStoryTier(SAME_STORY_LOW)).toBe('ambiguous');
    expect(decideSameStoryTier(SAME_STORY_HIGH)).toBe('duplicate');
    expect(decideSameStoryTier(SAME_STORY_LOW - 0.001)).toBe('distinct');
  });
});
