import { describe, expect, it } from 'vitest';
import {
  IMAGE_SUBLINE_MAX_WORDS,
  imageSubline,
  imageClaimLine,
  claimLine,
  withAttribution,
  complaintHeadline,
  hookFor,
  looksLikeCrimeDescription,
  looksLikeDescriptiveFiler,
  pickBySeed,
  resignationHeadline,
  truncateAtWordBoundary,
} from './social-copy-variety';

describe('pickBySeed', () => {
  it('is deterministic for the same seed', () => {
    const options = ['a', 'b', 'c', 'd'];
    const first = pickBySeed('same-seed', options);
    const second = pickBySeed('same-seed', options);
    expect(first).toBe(second);
  });

  it('always returns one of the given options', () => {
    const options = ['a', 'b', 'c'];
    for (const seed of ['x', 'y', 'z', 'abc-123', '']) {
      expect(options).toContain(pickBySeed(seed, options));
    }
  });
});

describe('hookFor', () => {
  it('returns a deterministic hook for a known trigger type', () => {
    const a = hookFor('resignation', 'record-1');
    const b = hookFor('resignation', 'record-1');
    expect(a).toBe(b);
    expect(typeof a).toBe('string');
  });

  it('returns undefined for a trigger type with no hook pool (e.g. summary_stats)', () => {
    expect(hookFor('summary_stats', 'record-1')).toBeUndefined();
    expect(hookFor('complaint_milestone', 'record-1')).toBeUndefined();
  });
});

describe('resignationHeadline', () => {
  it('maps known resignation types to their verb', () => {
    expect(resignationHeadline('Kovács János', 'lemondás')).toBe('Kovács János: lemondott!');
    expect(resignationHeadline('Kovács János', 'kirúgás')).toBe('Kovács János: kirúgták!');
    expect(resignationHeadline('Kovács János', 'felmentés')).toBe('Kovács János: felmentették!');
    expect(resignationHeadline('Kovács János', 'visszahívás')).toBe('Kovács János: visszahívták!');
  });

  it('falls back to "távozott!" for an unknown resignation type', () => {
    expect(resignationHeadline('Kovács János', 'egyéb')).toBe('Kovács János: távozott!');
  });
});

describe('looksLikeCrimeDescription', () => {
  it('flags crime/procedure descriptions, not entity names', () => {
    expect(looksLikeCrimeDescription('hűtlen kezelés gyanúja')).toBe(true);
    expect(looksLikeCrimeDescription('költségvetési csalás gyanúja miatt')).toBe(true);
    expect(looksLikeCrimeDescription('sikkasztás ügyében')).toBe(true);
  });

  it('does not flag a real institution/person name', () => {
    expect(looksLikeCrimeDescription("Waberer's")).toBe(false);
    expect(looksLikeCrimeDescription('Magyar Nemzeti Bank')).toBe(false);
    expect(looksLikeCrimeDescription('Tiborcz István')).toBe(false);
  });
});

describe('complaintHeadline', () => {
  it('uses the "ellen" form when targetEntity is a real name', () => {
    expect(complaintHeadline('Hadházy Ákos', "Waberer's", 'MFB 77 milliárdos kötvényvásárlása a Waberer\'s-től'))
      .toBe("Hadházy Ákos feljelentést tett Waberer's ellen");
  });

  it('falls back to the colon form when targetEntity is a crime description, not a name', () => {
    // 2026-09-08 user report — this exact case shipped ungrammatically.
    expect(complaintHeadline('X.Y.', 'hűtlen kezelés gyanúja', 'Az önkormányzat vezetése elleni feljelentés'))
      .toBe('X.Y. feljelentést tett: Az önkormányzat vezetése elleni feljelentés');
  });

  it('falls back to the colon form when targetEntity is missing', () => {
    expect(complaintHeadline('X.Y.', null, 'Ismeretlen tettes elleni feljelentés'))
      .toBe('X.Y. feljelentést tett: Ismeretlen tettes elleni feljelentés');
    expect(complaintHeadline('X.Y.', undefined, 'Ismeretlen tettes elleni feljelentés'))
      .toBe('X.Y. feljelentést tett: Ismeretlen tettes elleni feljelentés');
    expect(complaintHeadline('X.Y.', '', 'Ismeretlen tettes elleni feljelentés'))
      .toBe('X.Y. feljelentést tett: Ismeretlen tettes elleni feljelentés');
  });
});

describe('truncateAtWordBoundary', () => {
  it('returns the original text unchanged when it already fits', () => {
    expect(truncateAtWordBoundary('Rövid mondat.', 200)).toBe('Rövid mondat.');
  });

  it('never cuts in the middle of a word — 2026-09-08 live bug ("...rejtélyes befekte…")', () => {
    const intro =
      'Nézzük, mennyit tudsz az MNB-alapítványi botrányról — a Matolcsy-kör körüli ügyről, amiben eddig kiderült sztorik szerint milliárdok tűntek el nyomtalanul, rejtélyes befektetésekben és külföldi kitérőkön. 10 kérdés — nagy meglepetések, kezdjük!';
    const result = truncateAtWordBoundary(intro, 197)!;
    // The old `.slice(0, 197) + '…'` produced "...rejtélyes befekte…" — a
    // word cut in half. The fix must always end on a whole word.
    expect(result.endsWith('…')).toBe(true);
    const withoutEllipsis = result.slice(0, -1);
    const lastWord = withoutEllipsis.trim().split(/\s+/).pop()!;
    expect(intro).toContain(lastWord);
    expect(result).not.toContain('befekte…');
  });

  it('returns undefined for empty/whitespace/missing input', () => {
    expect(truncateAtWordBoundary('', 50)).toBeUndefined();
    expect(truncateAtWordBoundary('   ', 50)).toBeUndefined();
    expect(truncateAtWordBoundary(null, 50)).toBeUndefined();
    expect(truncateAtWordBoundary(undefined, 50)).toBeUndefined();
  });

  it('never exceeds maxChars (plus the ellipsis)', () => {
    const long = 'a'.repeat(50) + ' ' + 'b'.repeat(50) + ' ' + 'c'.repeat(50);
    const result = truncateAtWordBoundary(long, 60)!;
    expect(result.length).toBeLessThanOrEqual(61);
  });
});

// 2026-09-22 user report: „a pórul járt cég feljelentést tett: Rendőrség
// nyomkövetős okosóra-beszerzés" — kisbetűs mondatkezdés + körülírt bejelentő.
describe('complaintHeadline — mondatkezdés és körülírt bejelentő', () => {
  it('nagybetűvel kezdi a mondatot a kisbetűs mezőértékek esetén is', () => {
    expect(complaintHeadline('kormány', null, 'M6 koncesszió')).toBe(
      'Kormány feljelentést tett: M6 koncesszió',
    );
    expect(complaintHeadline('a jegybank', null, 'Matolcsy-kör')).toBe(
      'A jegybank feljelentést tett: Matolcsy-kör',
    );
  });

  it('a név belsejét nem írja át', () => {
    expect(complaintHeadline('veglegestorles.hu üzemeltetője', null, 'X')).toBe(
      'Veglegestorles.hu üzemeltetője feljelentést tett: X',
    );
  });

  it('felismeri a körülírt (névtelen) bejelentőt', () => {
    expect(looksLikeDescriptiveFiler('a pórul járt cég')).toBe(true);
    expect(looksLikeDescriptiveFiler('Az érintett vállalkozás')).toBe(true);
    expect(looksLikeDescriptiveFiler('a panaszos')).toBe(true);
  });

  it('a valódi bejelentőneveket nem jelöli meg', () => {
    expect(looksLikeDescriptiveFiler('Transparency International Magyarország')).toBe(false);
    expect(looksLikeDescriptiveFiler('Hadházy Ákos')).toBe(false);
    expect(looksLikeDescriptiveFiler('kormány')).toBe(false);
    expect(looksLikeDescriptiveFiler('Közlekedési és Beruházási Minisztérium')).toBe(false);
  });
});

describe('imageSubline — a képre kerülő kiegészítő sor', () => {
  // 2026-09-24 REGRESSZIÓ: pontosan ez a szöveg ment ki Facebookra, befejezett
  // mondatnak látszó csonkként. A `fitCompleteSentences` helyesen dolgozott,
  // az `imageSubline` vágta szét utána a 7. szónál.
  const ELES_HIBA = 'Mikucza Tamást, Seszták Miklós volt fejlesztési miniszter feltételezett strómanjának nevezik…';

  it('a záró „…"-t csonknak tekinti, és nem adja vissza egészben', () => {
    // 12 szó alatt van, tehát a szó-korlát átengedné — de a „…" elárulja,
    // hogy egy korábbi lépés már elvágta.
    const out = imageSubline('Galgóczy Ferenc bejegyzése szerint őrizetbe vették Mikucza Tamás kisvárdai…');
    expect(out).not.toMatch(/…$/);
  });

  it('SOSE ad vissza mondat közepén elvágott csonkot', () => {
    const out = imageSubline(ELES_HIBA);
    expect(out).not.toBe('Mikucza Tamást, Seszták Miklós volt fejlesztési miniszter');
    // Amit visszaad, az vagy üres, vagy önmagában értelmes tagmondat.
    if (out) expect(out.split(' ').length).toBeLessThanOrEqual(IMAGE_SUBLINE_MAX_WORDS);
  });

  it('a korláton belüli szöveget érintetlenül hagyja', () => {
    expect(imageSubline('Érintett összeg: 1,01 milliárd Ft')).toBe('Érintett összeg: 1,01 milliárd Ft');
  });

  it('hosszú szövegből az első beférő, önmagában megálló tagmondatot adja', () => {
    const out = imageSubline(
      'A hatóságok tegnap este őrizetbe vették a vállalkozót, a gyanúsítás pontos tartalmáról '
      + 'azonban egyelőre semmilyen hivatalos tájékoztatás nem érkezett egyetlen szervtől sem.',
    );
    expect(out).toBe('A hatóságok tegnap este őrizetbe vették a vállalkozót');
  });

  it('SOSE emel ki későbbi tagmondatot — az elveszti az alanyát', () => {
    // 2026-09-24: az első tagmondat itt 2 szó („Mikucza Tamást"), a második
    // viszont beférne — de önmagában úgy olvasódna, mintha SESZTÁK lenne a
    // stróman. Inkább essen vissza a tartalékra, mint hogy hamisat állítson.
    const out = imageSubline(
      'Mikucza Tamást, a Seszták Miklós volt fejlesztési miniszterhez köthető kisvárdai '
      + 'üzleti kör ismert szereplőjét a hatóságok szerda este őrizetbe vették.',
      'őrizetbe vétel',
    );
    expect(out).toBe('őrizetbe vétel');
  });

  it('ha semmi nem fér be, inkább ÜRES, mint csonk', () => {
    // Egyetlen tagmondat, 12 szónál hosszabb, vessző és mondathatár nélkül —
    // nincs mit levágni belőle úgy, hogy értelmes maradjon.
    const egybefuggo = 'Rendkívül hosszú összetett szavakból álló megnevezhetetlen intézményi elnevezés amely '
      + 'sehogyan sem rövidíthető értelmes módon rövidebb formára';
    expect(imageSubline(egybefuggo)).toBe('');
  });

  it('üres értéknél a fallbackre esik vissza', () => {
    expect(imageSubline('', 'Mészáros Lőrinc')).toBe('Mészáros Lőrinc');
  });

  it('a fallbackot is ugyanúgy védi — abból sem lesz csonk', () => {
    const out = imageSubline('', ELES_HIBA);
    expect(out).not.toBe('Mikucza Tamást, Seszták Miklós volt fejlesztési miniszter');
  });
});

describe('withAttribution — kötelező „ki szerint" (user, 2026-09-24)', () => {
  it('kiteszi a forrást, ha nincs hatósági megerősítés', () => {
    expect(withAttribution('Őrizetbe vették Mikucza Tamást', 'A Kontroll'))
      .toBe('A Kontroll azt írja: Őrizetbe vették Mikucza Tamást');
  });

  it('NEM kisbetűsíti a mondatkezdő tulajdonnevet', () => {
    // Korábbi hibaosztály: „A Kontroll szerint mikucza Tamást…"
    expect(withAttribution('Mikucza Tamást elvitték', 'A Kontroll'))
      .toBe('A Kontroll azt írja: Mikucza Tamást elvitték');
  });

  it('nem teszi ki kétszer, ha már van „szerint" a mondatban', () => {
    const s = 'Galgóczy szerint őrizetben Seszták embere';
    expect(withAttribution(s, 'A Kontroll')).toBe(s);
  });

  it('nem ismétli a forrást, ha az már szerepel a szövegben', () => {
    const s = 'A Kontroll birtokába került dokumentum';
    expect(withAttribution(s, 'A Kontroll')).toBe(s);
  });

  it('hatósági közlésnél (nincs átadott forrás) érintetlenül hagyja', () => {
    expect(withAttribution('Jogerősen elítélték a volt államtitkárt'))
      .toBe('Jogerősen elítélték a volt államtitkárt');
  });

  it('üres sorból nem csinál forrás-mondatot', () => {
    expect(withAttribution('', 'A Kontroll')).toBe('');
  });
});

describe('imageClaimLine — strukturált mezőkből épített képsor', () => {
  const alap = { personName: 'Mikucza Tamás', position: 'kisvárdai vállalkozó', verdictType: 'előzetesben', sentenceLabel: 'előzetes letartóztatás', seed: 'a' };

  it('NEM ismétli a nevet — az a kickerben és a headline-ban már szerepel', () => {
    // Ez a sor lényege: a képen a név és az esemény már kétszer ott van,
    // harmadszor unalmas. Ide a beosztás és a megerősítettség jön.
    expect(imageClaimLine(alap)).not.toContain('Mikucza Tamás');
    expect(imageClaimLine(alap)).toContain('kisvárdai vállalkozó');
  });

  it('nincs hatósági megerősítés → forrás-előtag + kimondja, hogy nincs megerősítés', () => {
    const out = imageClaimLine({ ...alap, attribution: 'A Kontroll' });
    expect(out.startsWith('A Kontroll azt írja —')).toBe(true);
    expect(out).toContain('hatósági megerősítés nélkül');
    expect(out).not.toMatch(/:.*:/); // sose dupla kettőspont
  });

  it('hatósági közlésnél feszültség-nyitány jön, forrás és mentegetőzés nélkül', () => {
    const out = imageClaimLine(alap);
    expect(out).not.toContain('azt írja');
    expect(out).not.toContain('hatósági megerősítés nélkül');
  });

  it('nem ismétli a büntetés-címkét, ha az ugyanazt mondja, mint a kicker', () => {
    // verdictType 'előzetesben' + sentenceLabel 'előzetes letartóztatás' —
    // a kicker már kiírta, ne álljon ott megint.
    expect(imageClaimLine(alap)).not.toContain('előzetes letartóztatás');
  });

  it('a büntetés MÉRTÉKÉT viszont kiírja, mert az új információ', () => {
    const out = imageClaimLine({ personName: 'Völner Pál', position: 'volt államtitkár', verdictType: 'jogerős', sentenceLabel: '5 év fegyház', seed: 'b' });
    expect(out).toContain('5 év fegyház');
    expect(out).toContain('volt államtitkár');
  });

  it('SOSE használ igés+tárgyesetes szerkezetet (névragozás-csapda)', () => {
    for (const t of ['előzetesben', 'jogerős', 'vádemelés', 'szabadlábra helyezve']) {
      expect(imageClaimLine({ ...alap, verdictType: t })).not.toContain('Tamást');
    }
  });

  it('a képre szánt szó-korlátba fér', () => {
    const out = imageClaimLine({ ...alap, attribution: 'A Kontroll' });
    expect(out.split(' ').length).toBeLessThanOrEqual(IMAGE_SUBLINE_MAX_WORDS);
  });

  it('név nélkül nem gyárt sort', () => {
    expect(imageClaimLine({ ...alap, personName: '  ' })).toBe('');
  });
});

describe('claimLine — a képsor közös építője', () => {
  it('SOSE gyárt tautológiát: ha nincs új tény, üres a sor', () => {
    // A korábbi „A feljelentés státusza: feljelentés" pont ez volt.
    expect(claimLine({ parts: [null, '', undefined], seed: 'x' })).toBe('');
  });

  it('a megadott tényeket fűzi össze, nagybetűvel kezdve', () => {
    expect(claimLine({ parts: ['főigazgató', 'Terror Háza Múzeum'], seed: 'x' }))
      .toBe('Főigazgató, Terror Háza Múzeum');
  });

  it('forrás-előtag esetén nincs feszültség-nyitány', () => {
    const out = claimLine({ parts: ['üzletember'], tension: ['Szorul a hurok'], attribution: 'A Kontroll', seed: 'x' });
    expect(out).toBe('A Kontroll azt írja — üzletember');
    expect(out).not.toContain('Szorul a hurok');
  });

  it('a „hatósági megerősítés nélkül" csak kérésre kerül ki', () => {
    expect(claimLine({ parts: ['üzletember'], attribution: 'A Kontroll', seed: 'x', unconfirmedNote: true }))
      .toContain('hatósági megerősítés nélkül');
    expect(claimLine({ parts: ['üzletember'], attribution: 'A Kontroll', seed: 'x' }))
      .not.toContain('hatósági megerősítés nélkül');
  });

  it('nem teszi ki a nyitányt, ha az ugyanazt mondja, mint a tartalom', () => {
    expect(claimLine({ parts: ['Lehúzta a rolót'], tension: ['Lehúzta a rolót'], seed: 'x' }))
      .toBe('Lehúzta a rolót');
  });
});

describe('claimLine — szó-korlát', () => {
  it('a kevésbé fontos részt hagyja el, ha nem fér be', () => {
    const out = claimLine({
      parts: ['volt államtitkár', 'a bíróság vagyonelkobzást rendelt el a birtokában lévő ingatlanokra és bankszámlákra'],
      seed: 'x',
    });
    expect(out.split(' ').length).toBeLessThanOrEqual(IMAGE_SUBLINE_MAX_WORDS);
    // Az ELSŐ (fontosabb) rész marad meg, a második esik ki.
    expect(out.toLowerCase()).toContain('volt államtitkár');
    expect(out.toLowerCase()).not.toContain('bankszámlákra');
  });

  it('a nyitányt dobja el előbb, mint a tényt', () => {
    const teny = 'a bíróság vagyonelkobzást rendelt el a volt államtitkár ingatlanjaira';
    const out = claimLine({ parts: [teny], tension: ['Visszakerült a kasszába'], seed: 'x' });
    expect(out).not.toContain('Visszakerült a kasszába');
    expect(out.toLowerCase()).toContain('vagyonelkobzást');
  });

  it('ha egyetlen tény sem fér be, üres', () => {
    expect(claimLine({ parts: ['egy kifejezetten hosszú mondat amely semmiképpen sem fér bele a képre szánt tizenkét szavas korlátba sehogy'], seed: 'x' })).toBe('');
  });
});
