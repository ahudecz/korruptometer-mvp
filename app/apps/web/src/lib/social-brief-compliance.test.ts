import { describe, expect, it } from 'vitest';

import {
  breakingCaption,
  containsPlaceholderText,
  ctaForKicker,
  summaryCaption,
} from './social-caption';
import {
  IMAGE_SUBLINE_MAX_WORDS,
  complaintWhatHappened,
  imageSubline,
  resignationWhatHappened,
  whyItMattersFor,
  type ContextCounts,
} from './social-copy-variety';

/**
 * BRIEF-MEGFELELÉSI LINTER — docs/facebook-content-brief.md
 *
 * 2026-09-16, user report: „volt egy briefem fb poszt írásra, mert most is
 * kalap szar még. elvileg megcsináltad, gyakorlatban ugyanazok a szar posztok
 * mennek."
 *
 * A gyökérok: a brief egy dokumentum volt, a posztokat viszont kód gyártja.
 * Ez a fájl a brief kemény, gépileg ellenőrizhető szabályait teszteli — hogy
 * a „megcsináltam" állítás mérhető legyen, ne hit kérdése.
 *
 * A bemenetek VALÓDI, élesre ment posztok adatai (2026-09-15/16).
 */

const COUNTS: ContextCounts = {
  resignations: 128,
  pretrial: 16,
  verdicts: 34,
  complaints: 57,
  closures: 12,
  recoveredFtLabel: '1,2 milliárd Ft',
};

/** A brief 3. pontja szerinti négy blokk, üres sorral elválasztva. */
function blocksOf(caption: string): string[] {
  return caption.split('\n\n').map((b) => b.trim()).filter(Boolean);
}

describe('brief 3. — négyblokkos szerkezet', () => {
  // A valódi, rossz poszt adatai: Schmidt Mária felmentése, 2026-09-15.
  const caption = breakingCaption(
    'FELMENTÉS',
    'Schmidt Mária: felmentették!',
    resignationWhatHappened('Schmidt Mária', 'főigazgató', 'Terror Háza Múzeum'),
    '/lemondasok',
    undefined,
    whyItMattersFor('resignation', COUNTS, 'FELMENTÉS'),
  );

  it('HOOK: az első sor a headline, egyetlen emojival', () => {
    const first = caption.split('\n')[0]!;
    expect(first).toBe('📄 Schmidt Mária: felmentették!');
  });

  it('MI TÖRTÉNT: teljes mondat, nem mezőtöredék', () => {
    const what = blocksOf(caption)[1]!;
    // A régi poszt törzse ez volt: "főigazgató, Terror Háza Múzeum" —
    // se alany, se állítmány, se mondatvég.
    expect(what).not.toBe('főigazgató, Terror Háza Múzeum');
    expect(what.endsWith('.')).toBe(true);
    expect(what).toContain('Schmidt Mária');
    expect(what).toContain('főigazgató');
    expect(what).toContain('Terror Háza Múzeum');
  });

  it('MIÉRT ÉRDEKES: külön blokk, konkrét számmal', () => {
    const why = blocksOf(caption)[2]!;
    expect(why).toContain('128');
  });

  it('CTA: típusra szabott, nem a generikus „olvasd el a híreket"', () => {
    expect(caption).not.toContain('olvasd el a legfrissebb híreket');
    expect(caption).toContain('👉 Nézd meg, kiket mentettek fel');
  });

  it('mind a négy blokk megvan, üres sorral tagolva (brief 4.)', () => {
    expect(blocksOf(caption)).toHaveLength(4);
    expect(caption).not.toMatch(/\n{3,}/); // nincs dupla üres sor
  });
});

describe('brief 3.4 — minden kickerhez konkrét CTA tartozik', () => {
  const ALL_KICKERS = [
    'LEMONDÁS', 'KIRÚGÁS', 'FELMENTÉS', 'VISSZAHÍVÁS', 'TÁVOZÁS',
    'ELŐZETESBEN', 'ŐRIZETBE VÉVE', 'LETARTÓZTATVA', 'ÍTÉLET',
    'JOGERŐS ÍTÉLET', 'VÁDEMELÉS', 'SZABADLÁBON', 'ELJÁRÁS MEGSZŰNT',
    'FELMENTVE', 'VAGYONVISSZASZERZÉS', 'FELJELENTÉS', 'KVÍZ', 'MEGSZŰNÉS',
    'LEÉPÍTÉS', 'ELMARADT ESEMÉNY', 'MÉDIA-HÍR', 'KIEMELT ÜGY', 'ADATBÁZIS',
    'SZAVAZÁS EREDMÉNYE',
  ];

  it('egyik kicker sem esik a generikus fallbackre', () => {
    const generic = ALL_KICKERS.filter((k) => ctaForKicker(k) === ctaForKicker('EZ_NEM_LÉTEZŐ_KICKER'));
    // A 'KIEMELT ÜGY'/'ADATBÁZIS' szándékosan a brief saját mondatát kapja,
    // ami egybeesik a fallbackkel — minden MÁS kickernek sajátja van.
    expect(generic).toEqual(['KIEMELT ÜGY', 'ADATBÁZIS']);
  });

  it('a CTA rövid (brief 3.4: „a CTA ne legyen hosszú")', () => {
    for (const k of ALL_KICKERS) {
      expect(ctaForKicker(k).split(/\s+/).length, k).toBeLessThanOrEqual(10);
    }
  });
});

describe('brief 11–12. — jogi státusz és távozás-típus nem mosódhat össze', () => {
  it('a felmentés nem kap kirúgás-emojit', () => {
    const felmentes = breakingCaption('FELMENTÉS', 'X Y: felmentették!');
    const kirugas = breakingCaption('KIRÚGÁS', 'X Y: kirúgták!');
    expect(felmentes.split('\n')[0]).not.toEqual(kirugas.split('\n')[0]);
    expect(kirugas.startsWith('❌')).toBe(true);
    expect(felmentes.startsWith('❌')).toBe(false);
  });

  it('az előzetes és az ítélet külön kontextus-mondatot kap', () => {
    const pretrial = whyItMattersFor('court_verdict', COUNTS, 'ELŐZETESBEN');
    const verdict = whyItMattersFor('court_verdict', COUNTS, 'JOGERŐS ÍTÉLET');
    expect(pretrial).toContain('16');
    expect(pretrial).toContain('előzetesben');
    expect(verdict).toContain('34');
    // Nyers eljárás-szám SOSE nevezhető ítéletnek.
    expect(verdict).not.toContain('ítélet');
  });
});

describe('brief 8. — képre kerülő szöveg', () => {
  it('legfeljebb 7 szó', () => {
    const long = 'felügyelőbizottsági elnök, Nemzeti Reorganizációs Nonprofit Kft. (NRN) és még sok minden más';
    expect(imageSubline(long).split(/\s+/).length).toBeLessThanOrEqual(IMAGE_SUBLINE_MAX_WORDS);
  });

  it('sose végződik csonkolás-jelre', () => {
    const out = imageSubline('a b c d e f g h i j k');
    expect(out.endsWith('…')).toBe(false);
    expect(out.endsWith('-')).toBe(false);
  });

  it('üres érték esetén a fallbackre esik (eddig ÜRES képszöveg ment ki)', () => {
    expect(imageSubline('', 'Terror Háza Múzeum')).toBe('Terror Háza Múzeum');
    expect(imageSubline(null, 'A feljelentés státusza: nyomozás')).toBe('A feljelentés státusza: nyomozás');
  });
});

describe('brief 6. — a forrás tartalmát nem csonkolhatjuk', () => {
  it('az összeg akkor is kimegy, ha a leírás nem említi', () => {
    const what = complaintWhatHappened('Hűtlen kezelés gyanúja merült fel.', '250 millió Ft');
    expect(what).toContain('Hűtlen kezelés gyanúja merült fel.');
    expect(what).toContain('250 millió Ft');
  });

  it('leírás nélkül is marad az összeg', () => {
    expect(complaintWhatHappened(null, '250 millió Ft')).toContain('250 millió Ft');
  });

  it('se leírás, se összeg → nincs üres blokk', () => {
    expect(complaintWhatHappened(null, null)).toBeUndefined();
  });
});

describe('placeholder-védőháló a poszt-szövegben', () => {
  // Ez ment ki élesre 2026-09-16-án: „📄 <UNKNOWN> feljelentést tett: …"
  it('elkapja a <UNKNOWN> bejelentőt', () => {
    expect(containsPlaceholderText('<UNKNOWN> feljelentést tett: Pilz Tamás')).toBe(true);
  });

  it('elkapja a JS-szivárgásokat is', () => {
    expect(containsPlaceholderText('undefined', null)).toBe(true);
    expect(containsPlaceholderText('[object Object]')).toBe(true);
  });

  it('a valódi szöveget békén hagyja', () => {
    expect(containsPlaceholderText('Hadházy Ákos feljelentést tett: NKA-botrány')).toBe(false);
  });
});

describe('minden poszt-típus megfelel a kemény szabályoknak', () => {
  const CASES: Array<{ kicker: string; headline: string; what?: string; why?: string; link: string }> = [
    { kicker: 'KIRÚGÁS', headline: 'Ballai Attila: kirúgták!', what: resignationWhatHappened('Ballai Attila', 'főszerkesztő', 'Nemzeti Sportrádió'), why: whyItMattersFor('resignation', COUNTS), link: '/lemondasok' },
    { kicker: 'ELŐZETESBEN', headline: 'Bús Balázs: előzetesben!', what: 'A bíróság három hónappal meghosszabbította a letartóztatását.', why: whyItMattersFor('court_verdict', COUNTS, 'ELŐZETESBEN'), link: '/birosagi-iteletek' },
    { kicker: 'FELJELENTÉS', headline: 'Király József feljelentést tett: Csapó Ágnes', what: complaintWhatHappened('Hűtlen kezelés gyanúja.', '250 millió Ft'), why: whyItMattersFor('criminal_complaint', COUNTS), link: '/birosagi-iteletek' },
    { kicker: 'VAGYONVISSZASZERZÉS', headline: 'Visszakerült 300 millió forint', what: 'Az állam visszakapta az összeget.', why: whyItMattersFor('asset_recovery', COUNTS), link: '/visszaszerzett-vagyon' },
    { kicker: 'MEGSZŰNÉS', headline: 'Megszűnt a lap', what: 'A kiadó bejelentette a megszűnést.', why: whyItMattersFor('media_closure', COUNTS), link: '/megszunt' },
  ];

  for (const c of CASES) {
    it(`${c.kicker}: hook + MI TÖRTÉNT + MIÉRT ÉRDEKES + CTA`, () => {
      const caption = breakingCaption(c.kicker, c.headline, c.what, c.link, undefined, c.why);
      expect(blocksOf(caption)).toHaveLength(4);
      expect(caption).toContain('👉');
      expect(caption).toContain(`kegyencjarat.hu${c.link}`);
      expect(caption).not.toMatch(/\n{3,}/);
      expect(containsPlaceholderText(caption)).toBe(false);
      // Brief 5. — emoji mértékkel: max 4 egy rövid posztban.
      const emojiCount = (caption.match(/\p{Extended_Pictographic}/gu) ?? []).length;
      expect(emojiCount, `emoji: ${emojiCount}`).toBeLessThanOrEqual(4);
    });
  }
});

describe('summary_stats poszt', () => {
  it('a CTA a linksor ELŐTT áll, és konkrét', () => {
    const cap = summaryCaption(['• 128 lemondás'], '/adatbazis');
    const lines = cap.split('\n');
    const ctaIdx = lines.findIndex((l) => l.startsWith('👉'));
    const linkIdx = lines.findIndex((l) => l.includes('kegyencjarat.hu'));
    expect(ctaIdx).toBeGreaterThan(-1);
    expect(ctaIdx).toBeLessThan(linkIdx);
  });
});
