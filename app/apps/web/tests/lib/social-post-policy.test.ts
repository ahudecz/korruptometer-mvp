import { describe, it, expect } from 'vitest';
import {
  MAX_PER_RUN,
  MIN_CASE_DAMAGE_FT,
  checkPostGate,
  fallbackKindsForRun,
  isPlaceholderSummary,
  parseHungarianFtAmount,
  selectQueueBatch,
} from '@/lib/social-post-policy';
import { GAP_HOURS, scheduleBatch } from '@/lib/social-schedule';
import { fitCompleteSentences, IMAGE_DETAIL_MAX_CHARS } from '@/lib/social-copy-variety';
import { UGYEK } from '@app/_home/ugyek-config';

const okCandidate = {
  triggerType: 'criminal_complaint',
  headline: 'Feljelentés: Volánbusz-ügy',
  caption: '🚨 FELJELENTÉS\n\nFeljelentés: Volánbusz-ügy\n\nRészletek: kegyencjarat.hu/birosagi-iteletek',
  imageText: 'Feljelentő: Kormányzati Ellenőrzési Hivatal',
};

describe('checkPostGate', () => {
  it('lets a well-formed real-event post through', () => {
    expect(checkPostGate(okCandidate)).toEqual({ ok: true });
  });

  // ═══ 2026-09-10 user report: "sikerült a másodiknál megint levágni a
  // szöveget a képen, egy dolog amiről azt mondtad már fixálva van" ═══
  it('rejects a post whose image text is a truncated fragment', () => {
    const r = checkPostGate({
      ...okCandidate,
      imageText: '8 személyt tartóztattak le 2026. június 4-én — köztük Őrsi Gergely (DK) II. kerületi…',
    });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toMatch(/csonkolt/);
  });

  it('rejects image text longer than the image can hold', () => {
    const r = checkPostGate({ ...okCandidate, imageText: 'a'.repeat(IMAGE_DETAIL_MAX_CHARS + 1) });
    expect(r.ok).toBe(false);
  });

  it('rejects a caption that was cut with an ellipsis', () => {
    const r = checkPostGate({ ...okCandidate, caption: 'Valami fontos szöveg, ami félbe…' });
    expect(r.ok).toBe(false);
  });

  // ═══ user: "nem akarok az adatbázisból fiszem-faszom ügyeket se látni.
  // Minimum 1 milliárdos érintettség legyen az alap" ═══
  it('rejects a database highlight below the 1 billion Ft floor', () => {
    const r = checkPostGate({
      ...okCandidate,
      triggerType: 'gallery_highlight',
      imageText: 'Kis Pista · Valami Kft.',
      provenAmountFt: 500_000_000n,
    });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toMatch(/érintettség/);
  });

  it('rejects a database highlight whose amount cannot be established at all', () => {
    const r = checkPostGate({ ...okCandidate, triggerType: 'catalog_highlight', provenAmountFt: null });
    expect(r.ok).toBe(false);
  });

  it('accepts a database highlight exactly at the floor', () => {
    const r = checkPostGate({
      ...okCandidate,
      triggerType: 'gallery_highlight',
      imageText: 'Mészáros Lőrinc · MBH Bank Nyrt.',
      provenAmountFt: MIN_CASE_DAMAGE_FT,
    });
    expect(r).toEqual({ ok: true });
  });

  it('rejects generated catalog stubs even above the money floor', () => {
    const r = checkPostGate({
      triggerType: 'gallery_highlight',
      headline: 'Elios Innovatív sportcsarnokok',
      caption: '🔎 Elios Innovatív sportcsarnokok\n\nFodor János — besorolatlan (1 cikk)',
      imageText: 'Fodor János · Elios Innovatív Zrt.',
      provenAmountFt: 5_000_000_000n,
    });
    expect(r.ok).toBe(false);
  });

  it('does not apply sentence rules to the summary post, whose image text is JSON', () => {
    const r = checkPostGate({
      triggerType: 'summary_stats',
      headline: 'Eddig a Kegyencjáraton',
      caption: '📊 EDDIG A KEGYENCJÁRATON\n\n• 266 lemondás',
      imageText: JSON.stringify([{ label: 'lemondás', value: '266' }]),
    });
    expect(r).toEqual({ ok: true });
  });
});

describe('isPlaceholderSummary', () => {
  it('flags the auto-generated catalog stubs (673 of 947 rows in prod, 2026-09-10)', () => {
    expect(isPlaceholderSummary('Fodor János — besorolatlan (1 cikk)')).toBe(true);
    expect(isPlaceholderSummary('Matolcsy Ádám — Sikkasztás, Hűtlen kezelés (1 cikk)')).toBe(true);
    expect(isPlaceholderSummary('')).toBe(true);
  });

  it('accepts a real, written-out case summary', () => {
    expect(
      isPlaceholderSummary(
        'Szijjártó Péter, a külgazdasági és külügyminiszter lett a Budapest Honvéd FC elnöke, és közvetlenül ezt követően a kormány körülbelül 17 milliárdos szubvenciót nyújtott az egyesületnek. A gyanú szerint a támogatás összefügg a kinevezéssel.',
      ),
    ).toBe(false);
  });
});

describe('parseHungarianFtAmount', () => {
  // Valódi ugyek-config.ts értékek.
  it.each([
    ['~300 milliárd Ft — EU legdrágább lélegeztetőgép-vásárlása', 300_000_000_000n],
    ['2+ milliárd Ft kenőpénz', 2_000_000_000n],
    ['266+ milliárd Ft — közpénz MNB alapítványokon átfolyva', 266_000_000_000n],
    ['~20 milliárd Ft becsült ingatlanérték — ismeretlen forrásból', 20_000_000_000n],
    ['Több tízmilliárd Ft — tiltott pártfinanszírozásra kiosztott közpénz', 10_000_000_000n],
    ['~700 millió Ft közkár — 3,5 Mrd Ft helyett 2,8 Mrd lett volna a piaci ár', 700_000_000n],
  ])('parses %s', (label, expected) => {
    expect(parseHungarianFtAmount(label)).toBe(expected);
  });

  it('returns null when the label carries no amount at all', () => {
    // Valódi eset: a "zsolt-bacsi" ügy estimatedDamage-e bűncselekmény-lista.
    expect(parseHungarianFtAmount('Jogellenes fogva tartás · Állami kényszerítés · Testi sértés')).toBeNull();
    expect(parseHungarianFtAmount(undefined)).toBeNull();
  });

  it('keeps a sub-billion case below the floor', () => {
    expect(parseHungarianFtAmount('~700 millió Ft közkár')! < MIN_CASE_DAMAGE_FT).toBe(true);
  });
});

describe('fallbackKindsForRun', () => {
  const now = new Date('2026-09-10T20:39:00Z');

  it('never offers the summary post when one went out within the last week', () => {
    const kinds = fallbackKindsForRun({ now, lastSummaryAt: new Date('2026-09-09T20:48:00Z') });
    expect(kinds).not.toContain('summary_stats');
  });

  it('offers the summary again once the week has passed — but never first', () => {
    const kinds = fallbackKindsForRun({ now, lastSummaryAt: new Date('2026-09-01T20:48:00Z') });
    expect(kinds).toContain('summary_stats');
    expect(kinds[0]).not.toBe('summary_stats');
  });

  it('offers it when there has never been one', () => {
    expect(fallbackKindsForRun({ now, lastSummaryAt: null })).toContain('summary_stats');
  });
});

describe('selectQueueBatch', () => {
  const now = new Date('2026-09-10T20:39:00Z');

  // ═══ 2026-09-11, user kérés: „egyben jönnek telegramra, hogy ne kelljen
  // velük baszakodnom külön" — a jelöltek MEHETNEK egyszerre jóváhagyásra;
  // a 09-10-i panasz („nem egy perc alatt akarok hármat posztolni") ellen
  // már a KIKÜLDÉS oldalán véd a scheduleBatch() 3 órás szünete. ═══
  it('lets a whole batch reach Telegram in one run', () => {
    const { selected } = selectQueueBatch(['a', 'b', 'c'], { now, remainingToday: 3 });
    expect(selected).toEqual(['a', 'b', 'c']);
    expect(selected.length).toBeLessThanOrEqual(MAX_PER_RUN);
  });

  it('respects the daily cap', () => {
    const { selected, skippedReason } = selectQueueBatch(['a'], { now, remainingToday: 0 });
    expect(selected).toEqual([]);
    expect(skippedReason).toMatch(/napi keret/);
  });

  it('never exceeds what is left for the day', () => {
    const { selected } = selectQueueBatch(['a', 'b', 'c'], { now, remainingToday: 1 });
    expect(selected).toEqual(['a']);
  });
});

describe('the 1 billion floor still leaves something to post', () => {
  it('keeps a usable pool of curated cases, and every survivor really is >= 1 Mrd', () => {
    const survivors = UGYEK.filter((u) => {
      const amount = parseHungarianFtAmount(u.estimatedDamage);
      return u.summary && amount !== null && amount >= MIN_CASE_DAMAGE_FT;
    });
    // Ha egy jövőbeli szigorítás kiürítené a készletet, ez a teszt bukik,
    // nem az élesben elnémuló poszt-folyam árulja el.
    expect(survivors.length).toBeGreaterThanOrEqual(5);
    for (const u of survivors) {
      expect(parseHungarianFtAmount(u.estimatedDamage)! >= MIN_CASE_DAMAGE_FT).toBe(true);
    }
  });
});

// ═══ Regressziós teszt a 2026-09-10-i konkrét esetre ═══
describe('the 2026-09-10 incident cannot repeat', () => {
  it('the three posts sent at 20:39:36 would go out 3 hours apart, not in one minute', () => {
    // A jelöltek egyszerre mehetnek Telegramra (ez a kényelem), de a
    // Facebookra kiküldés idejét a scheduleBatch() osztja szét — ez az,
    // ami a 09-10-i „egy perc alatt három poszt" esetet kizárja.
    const trio = ['summary_stats', 'catalog_highlight', 'gallery_highlight'];
    const { selected } = selectQueueBatch(trio, { now: new Date(), remainingToday: 3 });
    expect(selected).toHaveLength(3);

    const slots = scheduleBatch(new Date('2026-09-10T08:39:00Z'), null, selected.length);
    for (let i = 1; i < slots.length; i++) {
      const gapHours = (slots[i]!.getTime() - slots[i - 1]!.getTime()) / 3_600_000;
      expect(gapHours).toBeGreaterThanOrEqual(GAP_HOURS);
    }
  });

  it('the gallery post that went out is now rejected by the gate', () => {
    const r = checkPostGate({
      triggerType: 'gallery_highlight',
      headline: 'Elios Innovatív sportcsarnokok',
      caption: '🔎 Elios Innovatív sportcsarnokok\nVissza a gyökerekhez 📚\n\nFodor János — besorolatlan (1 cikk) — Érintett összeg: 5 milliárd Ft',
      imageText: 'Fodor János — besorolatlan (1 cikk) — Érintett összeg: 5 milliárd Ft',
      provenAmountFt: 5_000_000_000n,
    });
    expect(r.ok).toBe(false);
  });

  it('the catalog post image line is now a short complete phrase, not a cut sentence', () => {
    const eyebrow = 'Aktív · 7 személy előzetesben';
    const line = fitCompleteSentences(eyebrow, IMAGE_DETAIL_MAX_CHARS);
    expect(line).toBe(eyebrow);
    expect(checkPostGate({
      triggerType: 'catalog_highlight',
      headline: 'Parkfenntartási kenőpénzbotrány',
      caption: '🔎 Parkfenntartási kenőpénzbotrány\n\n8 személyt tartóztattak le 2026. június 4-én — köztük Őrsi Gergely (DK) II. kerületi polgármestert és további politikusokat. Z. Zsolt cégei közel 2 milliárd forint kenőpénzt fizethettek.',
      imageText: line!,
      provenAmountFt: 2_000_000_000n,
    })).toEqual({ ok: true });
  });
});
