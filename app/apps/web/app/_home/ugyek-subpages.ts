import { UGYEK, type BreakingUpdate } from './ugyek-config';
// ─────────────────────────────────────────────────────────────────────────────
// SEO-aloldalak a kiemelt ügyek alá (/ugyek/<ügy>/<téma>)
//
// Miért külön fájl és külön route-szint (2026-09-15, user kérés):
// a kegyencjarat.hu domain rating gyakorlatilag 0, ezért nem tudunk fej-fej
// mellett versenyezni a "nka botrány" típusú, nagy lapok által uralt
// kifejezésekre. A reális út a hosszabb, alacsony nehézségű (KD 14-18)
// kulcsszavak lefedése egy-egy ÖNÁLLÓ, mély aloldallal, amelyek mind a
// szülő ügyoldalra hivatkoznak vissza (hub & spoke belső linkelés).
//
// Semrush (2026-09, HU adatbázis) top NKA-kulcsszavak, ebből a sorrendből
// dolgozunk:
//   nka                 8 100 / KD 32   (brand, esélytelen — az nka.hu uralja)
//   nka pályázatok      1 900 / KD 17   ← EZ AZ ELSŐ ALOLDAL
//   nka belépés         1 000 / KD 18   (navigációs, nem nekünk való)
//   nka botrány         1 000 / KD 31   (a szülő ügyoldal célozza)
//   nka döntések          210 / KD 26   (következő jelölt)
//   nka letartóztatás     170            (következő jelölt)
//   bús balázs nka        170            (következő jelölt)
//
// TARTALMI SZABÁLYOK (user, 2026-09-15):
//  1. MÚLT IDŐ. Ezek a pályázatok lezárultak, a rendszer a nyomozás alatt van
//     — a jelen idő azt sugallná, hogy most is így megy. A GYIK is múlt idő.
//  2. Jogilag érzékeny, folyamatban lévő büntetőügy. Minden állítás forrásolt,
//     a gyanúsított ≠ elítélt különbséget a szöveg maga is kimondja, és NEM
//     nevezünk meg senkit gyanúsítottként, akit a sajtó sem nevezett annak.
//     (L. a 2026-09-08-i Fásy-incidenst: Fásy Ádám maga NEM gyanúsított, a
//     felesége és a lánya cégei érintettek — ezt a szöveg kiírja.)
//  3. A visszafizetői táblázat harmadik oszlopában CSAK olyan kötődés
//     szerepelhet, amit forrás is megnevez — különben gondolatjel. Egy
//     visszautalás önmagában nem jogi felelősségvállalás.
// ─────────────────────────────────────────────────────────────────────────────

/** Egy szövegblokkban inline linkké alakítandó szövegrészlet. A `text`-nek
 *  SZÓ SZERINT elő kell fordulnia a `content`-ben, különben nem lesz link
 *  (a bekezdés attól még hibátlanul megjelenik). */
export type InlineLink = { text: string; href: string; external?: boolean };

/** Táblázatcella: sima szöveg, vagy külső hivatkozás. */
export type TableCell = string | { text: string; href: string };

export type SubpageBlock =
  | { type: 'text'; heading?: string; id?: string; content: string; links?: InlineLink[] }
  | { type: 'callout'; heading: string; content: string }
  | { type: 'steps'; heading: string; id?: string; intro?: string; items: { title: string; body: string }[] }
  | { type: 'checklist'; heading: string; id?: string; intro?: string; items: { title: string; body: string }[] }
  /** „Ki és mit állít a vitában?" — két (vagy több) álláspont egymás mellett,
   *  a Telex-féle kérdezz-felelek formátumhoz. */
  | { type: 'stances'; heading: string; id?: string; intro?: string; sides: { label: string; body: string }[] }
  | {
      type: 'table';
      heading: string;
      id?: string;
      intro?: string;
      columns: string[];
      /** Egy cella sima szöveg, vagy hivatkozás — a forrás-oszlop a
       *  /lemondasok tábla mintáját követi: kattintható link „→" nyíllal. */
      rows: TableCell[][];
      note?: string;
    }
  /** `srcMobile`: külön, álló elrendezésű változat — a fekvő ábrák 400px-en
   *  olvashatatlanra zsugorodnak (user report, 2026-09-15). */
  | { type: 'image'; src: string; srcMobile?: string; alt: string; caption?: string }
  /** A CourtVerdict táblából élőben töltött kényszerintézkedés-táblázat —
   *  l. src/lib/case-detentions.ts. Ugyanabból a forrásból, mint a
   *  /birosagi-iteletek oldal, hogy egy új letartóztatás magától
   *  mindkét helyen megjelenjen. */
  | { type: 'detention-table'; heading: string; id?: string; intro?: string; ugyId: string; acronym?: string; note?: string }
  | { type: 'article-card'; source: string; headline: string; lead: string; url: string; date?: string }
  | { type: 'video'; id: string; label?: string; title: string; summary?: string }
  /** 2026-10-01: ugyanaz a BREAKING doboz, mint az ügyoldal tetején
   *  (BreakingUpdateBox) — l. ugyek-config.ts BreakingUpdate. */
  | { type: 'breaking'; update: BreakingUpdate }
  /** 2026-10-01: kiemelt idézet (az ügyoldal 'quote' blokkjának mintájára,
   *  .ugy-block-quote). A `text` idézőjelek NÉLKÜL, a renderer teszi köré. */
  | { type: 'quote'; text: string; author?: string; note?: string; url?: string };

export type SubpageFaq = { q: string; a: string };

export type UgySubpage = {
  /** URL-szegmens: /ugyek/<parentId>/<id> */
  id: string;
  parentId: string;
  /** <title> — a layout template "— Kegyencjárat"-ot fűz utána, ezért itt ne ismételd */
  seoTitle: string;
  /** meta description, max ~155 karakter */
  seoDescription: string;
  /** H1 — szándékosan eltér a seoTitle-től, de tartalmazza a fő kulcsszót */
  h1: string;
  eyebrow: string;
  /** Rövid, önmagában is válaszoló bevezető (featured snippet cél) */
  lead: string;
  /** Publikálás / utolsó érdemi frissítés — Article strukturált adathoz */
  publishedAt: string;
  updatedAt: string;
  heroImage?: { src: string; alt: string; credit?: string };
  /** A szülő ügyoldalon megjelenő, teljes egészében kattintható keretes promó
   *  (user kérés, 2026-09-15: az aloldal ne legyen árva oldal). A cím
   *  szándékosan megszólító, nem leíró — a lap tetején kell hogy megállítsa
   *  az olvasót. */
  promo: { eyebrow: string; title: string; lead: string; cta: string };
  blocks: SubpageBlock[];
  faq: SubpageFaq[];
  sources: { label: string; url: string }[];
  /** Belső linkek a hub & spoke szerkezethez */
  internalLinks: { label: string; href: string; note: string }[];
  /** Melyik tartalmi blokk UTÁN jelenjen meg a testvér-aloldal keretes
   *  promója (user kérés, 2026-09-15: ne a lap alján legyen, hanem nagyjából
   *  a tartalom felénél). A blokk `id`-ját kell megadni. Ha a megadott blokk
   *  után közvetlenül videó/cikk-kártya jön, a promó azok UTÁN kerül — a
   *  user kifejezett kérése, hogy ne ragadjon közvetlenül videó mellé. */
  crossPromoAfterBlockId?: string;
  /** Vázlat: csak fejlesztői (nem production) buildben létezik. Így egy
   *  formátum-kísérletet ki lehet tenni localhostra anélkül, hogy élesben
   *  megjelenne a promók között, a sitemapben vagy a keresőben. */
  draft?: boolean;
};

// Az ügyoldal tetején ülő BREAKING frissítés, egy az egyben az aloldalon is
// (2026-10-01, user kérés: Hankó letartóztatása az nka-letartoztatas
// aloldalon is) — nem másolat, hogy a kettő sose csússzon szét.
function parentBreaking(ugyId: string): SubpageBlock[] {
  const update = UGYEK.find((u) => u.id === ugyId)?.breakingUpdate;
  return update ? [{ type: 'breaking', update }] : [];
}

export const UGY_SUBPAGES: UgySubpage[] = [
  {
    id: 'nka-palyazatok',
    parentId: 'nka-botrany',
    seoTitle: 'NKA pályázatok — így működtek, és így lehetett visszaélni velük',
    seoDescription:
      'Hogyan zajlott egy NKA-pályázat a beadástól az elszámolásig, mi volt a 447-es és 790-es keret, és ki mennyit fizetett vissza? Konkrét számokkal, forrásokkal.',
    h1: 'NKA pályázatok: így működött a rendszer — és így lehetett kijátszani',
    eyebrow: 'NKA-botrány · háttér',
    lead:
      'Az NKA-pályázatok a Nemzeti Kulturális Alap nyílt, kollégiumi elbírálású támogatásai voltak: regisztráció után elektronikusan kellett beadni őket, a szakmai kollégium 60 napon belül döntött, a döntés ellen pedig nem volt helye fellebbezésnek. A 2026-os botrány nem ezt a nyílt ágat érintette, hanem a mellette futó, egyetlen aláíráson múló 447-es és 790-es keretet — ezen keresztül folyt ki a pénz négy nappal a választás előtt is.',
    publishedAt: '2026-09-15',
    updatedAt: '2026-09-15',
    heroImage: {
      src: '/images/persons/hanko-balazs.webp',
      alt: 'Hankó Balázs volt kulturális miniszter, akinek miniszteri keretéből az NKA-botrány vitatott kifizetései indultak',
      credit: 'Eredeti fotó: kultura.hu',
    },
    promo: {
      eyebrow: 'Háttér · NKA-pályázatok',
      title: 'Nem igazán vagy képben, mik ezek az NKA-pályázatok pontosan?',
      lead:
        'Összeraktuk egy oldalra, hogyan zajlott egy NKA-pályázat a beadástól az elszámolásig — és pontosan hol csúszott el. Kiderül, mi volt a titkos 447-es és 790-es keret, amivel a szakmai bírálatot át lehetett ugrani, hogyan lett egy 172 milliós dokumentumfilmből semmi, és ki mennyi közpénzt fizetett vissza azóta. Néhány perc, és képben leszel.',
      cta: 'Kattints, és kerülj képbe',
    },
    blocks: [
      {
        type: 'text',
        id: 'mi-az-nka',
        heading: 'Mi az NKA, és mire lehetett nála pályázni?',
        content:
          'A Nemzeti Kulturális Alap (NKA) az állam elkülönített pénzalapja, amelyből kulturális célokra — kiadványokra, fesztiválokra, előadó-művészeti produkciókra, közművelődési programokra, filmes és képzőművészeti projektekre — lehetett támogatást igényelni. A pénz elosztásáról szakmai kollégiumok döntöttek (például Közművelődés, Előadó-művészetek, Ismeretterjesztés és Környezetkultúra), a pályáztatás technikai lebonyolítója pedig az NKTK, vagyis a Nemzeti Kulturális Támogatáskezelő volt. Pályázni belföldi és határon túli természetes személyek, jogi személyek és jogi személyiség nélküli szervezetek is tudtak, feltéve hogy átlátható szervezetnek minősültek, köztartozásmentesek voltak és rendezett munkaügyi kapcsolatokkal rendelkeztek. Az alábbi eljárásrend a 2026-os botrány idején érvényes szabályokat írja le — azóta épp ezeknek az átalakítása a tét.',
      },
      {
        type: 'steps',
        id: 'palyazat-menete',
        heading: 'Hogyan zajlott egy NKA-pályázat — lépésről lépésre',
        intro:
          'Az NKA saját pályázati tudnivalói szerint egy nyílt pályázat útja a kiírástól az elszámolásig hét jól elkülönülő lépésből állt. Érdemes végigolvasni, mert a 2026-os botrány pont attól lett botrány, hogy a vitatott pénzek egy része ezt az utat megkerülte.',
        items: [
          {
            title: '1. Pályázati felhívás közzététele',
            body: 'A kollégiumnak a felhívást legkésőbb a benyújtási határidőt megelőző 30. napon közzé kellett tennie az NKA portálján, és legalább egy országos napilapban is közleményt kellett megjelentetnie róla. Meghívásos pályázatnál ez az előzetes közlési idő mindössze 7 nap volt.',
          },
          {
            title: '2. Regisztráció az NKA-portálon',
            body: 'Pályázni csak regisztrált felhasználói fiókból lehetett, és a regisztrációt az NKTK-nak külön meg kellett erősítenie. Amíg ez nem történt meg, a pályázatbenyújtás felülete meg sem nyílt. A regisztráció tartós volt, később módosítható — ezért az egyik leggyakoribb NKA-keresés a mai napig az „NKA belépés”.',
          },
          {
            title: '3. Nevezési díj befizetése',
            body: 'A nevezési díj összegét a kollégium határozta meg, és a felhívás rögzítette; egyedi pályázatnál az igényelt összeg 1%-a + 27% áfa, de legalább 10 000 Ft + 27% áfa. A díjat a pályázat benyújtásáig be kellett fizetni, és a bizonylatot csatolni kellett — befizetés nélkül a pályázat érvénytelen volt.',
          },
          {
            title: '4. Elektronikus benyújtás',
            body: 'A pályázatot kizárólag elektronikusan, az NKTK adatlapján, a benyújtási határnap éjfeléig lehetett beadni, tételes, költség-jogcímek szerint bontott költségvetéssel együtt. Épp ez a költségvetési rész az, amit a botrány egyik szereplőjénél gyakorlatilag üresen hagytak.',
          },
          {
            title: '5. Kollégiumi elbírálás — 60 nap',
            body: 'Az illetékes szakmai kollégiumnak a benyújtási határidőtől számított 60 napon belül kellett elbírálnia a pályázatokat. A kollégium a megítélt összeget és a költség-jogcímeket a kérttől eltérően is megállapíthatta, ezt azonban indokolnia kellett.',
          },
          {
            title: '6. Döntés közlése — és nem volt fellebbezés',
            body: 'A pályázók a döntésről legkésőbb 20 napon belül, a felhasználói fiókjukon keresztül kaptak értesítést. Az NKA saját tájékoztatója szerint „a döntés ellen fellebbezésnek helye nincs” — vagyis a döntési pont volt a rendszer legérzékenyebb szűk keresztmetszete.',
          },
          {
            title: '7. Szerződés, majd pénzügyi és szakmai elszámolás',
            body: 'Támogatási szerződést csak megerősített regisztrációval, köztartozásmentesen, átláthatósági nyilatkozattal lehetett kötni. A végén kettős elszámolás kellett: pénzügyi (bizonylatokkal, a jogcímek szerint) és szakmai beszámoló arról, hogy a program ténylegesen megvalósult. Ha nem valósult meg, az NKTK a támogatást visszakövetelhette.',
          },
        ],
      },
      {
        type: 'callout',
        heading: 'A kiskapu: a titkos 447-es és 790-es miniszteri keret',
        content:
          'A nyílt, kollégiumi pályázatok mellett az NKA-nál egyedi elbírálású keretek is futottak, amelyekből szakmai kollégiumi bírálat nélkül lehetett támogatást odaítélni. A 2026-os ügy iratai szerint az érintett kifizetések jelentős része a 790-es egyedi keretből, illetve Hankó Balázs 447-es miniszteri keretéből ment ki. Ez a szerkezeti különbség a botrány lényege: ugyanaz a közpénz, de az egyik ágon 30 napos nyilvános kiírás, szakmai kollégium és 60 napos bírálat volt, a másikon egyetlen aláírás.',
      },
      {
        type: 'image',
        src: '/images/cases/nka-palyazatok-penzutvonal.svg',
        srcMobile: '/images/cases/nka-palyazatok-penzutvonal-mobil.svg',
        alt: 'Ábra: az NKA pályázati pénz két útja — nyílt kollégiumi pályázat 30 napos kiírással és 60 napos bírálattal, szemben az egyedi 447-es és 790-es kerettel, ahol nem volt kollégiumi bírálat',
        caption:
          'Az NKA-pénz két útja. A nyílt ágon szakmai kollégium döntött; az egyedi, 447-es és 790-es kereten nem volt kollégiumi bírálat — a 2026-os botrány kifizetései innen indultak.',
      },
      {
        type: 'text',
        id: 'valasztas-elott',
        heading: 'Mi történt 2026 tavaszán az NKA-pályázatokkal?',
        content:
          'Hankó Balázs akkori kulturális miniszter négy nappal a 2026-os parlamenti választás előtt, 2026. április 8-án közel 394 millió forintot osztott ki egyedi miniszteri keretből. Az új kulturális miniszter, Tarr Zoltán ezeket a döntéseket visszavonta, majd elrendelte a korábbi kifizetések átvizsgálását, és mintegy 400 millió forintnyi támogatást tartott vissza. Az Index közérdekű adatigénylése nyomán az is kiderült, hogy 49 korábbi nyertes összesen 1,69 milliárd forintot utalt vissza önként az NKA-nak — köztük a Városliget Zrt. és Kis-Grófo énekes, aki elismerte, hogy a kapott összeg aránytalanul magas volt a valódi kulturális értékhez képest. A NAV azóta hűtlen kezelés bűntettének gyanújával nyomoz, az ügy több mint 17 milliárd forintnyi kifizetést érint.',
      },
      {
        type: 'text',
        id: 'fasy-szal',
        heading: 'Fásyék 172 milliós dokumentumfilmje, ami el se készült',
        content:
          'A legrészletesebben dokumentált szál egy négyrészes dokumentumfilmhez kötődik: a Kéz, szív, lélek – magyar kortárs művészek nyomában című sorozat első két részére 82,55 millió forint érkezett az NKA 790-es keretéből, a harmadik és negyedik részre pedig további 89,9 millió forint Hankó Balázs 447-es miniszteri keretéből — összesen 172,45 millió forint. A támogatott Munkácsy Art Kft. a Telex által megismert szerződések szerint több mint 56 millió forintért adott megbízást a Fásy családhoz köthető cégeknek: a Fásy Zsüliett tulajdonában álló Jules Media Kft.-nek 12,25 millió forint + áfa értékben (szerződés: 2026. január 22.), a Fásy Zsüliett és édesanyja tulajdonában lévő MVSZ 2015 Kft.-nek pedig 31,8 millió forint + áfa értékben (szerződés: 2025. december 29.). Az ügyészség gyanúja szerint az elszámolás határidejére, 2026 áprilisára a film nem készült el, az elkészültét viszont fiktív számlákkal igazolták.',
      },
      {
        type: 'text',
        content:
          'A sorozat első két része végül azután került fel a YouTube-ra, hogy a NAV nyomozása elindult: az első rész 2026. július 30-án, a második augusztus 4-én jelent meg a Munkácsy Art stúdió csatornáján. A Telex leírása szerint mindkét rész nagyjából 20 perces, hosszú interjúkból és vágóképekből áll, a felhasznált archív felvételek gyakran rossz képaránnyal jelennek meg, és öt nap alatt a két rész együtt mintegy 6700 megtekintést ért el. A rendező Jankai Béla, a vágók között Fásy Zsüliett szerepel. Nézd meg magad, mi készült el abból, amire 172,45 millió forint közpénz ment el:',
      },
      {
        type: 'video',
        id: '8RlCVWbhXUM',
        label: 'M-Art',
        title: 'Kéz, Szív, Lélek — I. rész',
        summary:
          'A támogatott dokumentumfilm első része, feltöltve 2026. július 30-án — hónapokkal az áprilisi elszámolási határidő után, a NAV-nyomozás megindulását követően.',
      },
      {
        type: 'video',
        id: 'dtfUPuHlAI8',
        label: 'M-Art',
        title: 'Kéz, Szív, Lélek — II. rész',
        summary:
          'A második rész, feltöltve 2026. augusztus 4-én. Az első két részre 82,55 millió forint érkezett az NKA 790-es keretéből.',
      },
      {
        type: 'callout',
        heading: 'Pontosítás: Fásy Ádám maga nem gyanúsított',
        content:
          'A sajtóban „Fásy-ügyként” emlegetett szálban a Kecskeméti Járásbíróság 2026. szeptember 9-én Fásyné Gurzó Máriát, Fásy Ádám feleségét és Szabó Sándort, a megbízó cég tulajdonos-ügyvezetőjét helyezte egy hónapra letartóztatásba, a szökés és az eljárás befolyásolásának veszélyére hivatkozva; mindketten fellebbeztek. A gyanú bűnszövetségben elkövetett költségvetési csalás és hamis magánokirat felhasználása. Fásy Ádám ellen tudomásunk szerint nem folyik eljárás, őt az ATV a lánya cégének kifizetéseiről kérdezte. A gyanúsítás nem ítélet: jogerős bírósági döntésig minden érintett ártatlannak tekintendő.',
      },
      {
        type: 'video',
        id: 'wKZSqY6168E',
        label: 'ATV',
        title: 'Megkérdeztük Fásy Ádámtól, kapott-e 101 millió forintot Fásy Zsüliett az NKA-tól',
        summary:
          'Az ATV riportja arról, hogy a Fásy Zsülietthez köthető cégek összesen mintegy 101 millió forintnyi NKA-támogatáshoz jutottak — ez a szál vezetett a 2026. szeptemberi letartóztatásokhoz.',
      },
      {
        type: 'text',
        id: 'radics-szal',
        heading: 'Húszmilliót visszaadott, tizenötöt megtartott — egy fideszes képviselő alapítványa',
        content:
          'A második, tanulságos szál Radics Béla fideszes országgyűlési képviselőhöz köthető Tradíciókért Alapítvány ügye. Az alapítvány a választás előtti, nem nyilvános pályázaton kapott 20 millió forintot — ezt 2026 szeptemberében visszafizette az NKA-nak. Egy korábban elnyert 15 millió forintos támogatást viszont megtartott, és a Telex, illetve a hvg.hu által megismert pályázati dokumentumban a konkrét programleírás helye üresen maradt: a költségvetésnél mindössze annyi szerepelt, hogy „ekkora összegre van szükségünk a programok megvalósításához”. Radics utóbb az Indexnek azzal indokolta a visszautalást, hogy a parlamenti munkája mellett nem tudná megfelelő minőségben kurátorként irányítani a programot, így felelősebb döntés visszaadni a pénzt; a megtartott 15 millióból elmondása szerint egy nőnapi gálakoncert és egy roma holokauszt-emléknap valósult meg. A négy éve alapított szervezet a sajtóösszesítések szerint összesen több mint 66 millió forintnyi közpénzhez jutott, többek között az Erasmus+ programból és a Bethlen Gábor Alapkezelőtől is.',
      },
      {
        type: 'video',
        id: '0buPrlzXIVc',
        label: 'Molnár Áron',
        title: 'Visszaadta a 20 milliót! Mitől ijedt meg Radics Béla?',
        summary:
          'Molnár Áron összeállítása a Tradíciókért Alapítvány visszafizetéséről — és arról, mi maradt megválaszolatlanul a megtartott 15 millió forint körül.',
      },
      {
        type: 'article-card',
        source: 'Telex',
        headline:
          'Radics Béla alapítványa visszafizetett 20 milliót az NKA-nak, de megtartott 15-öt, amiről nem tudni, mire kapták',
        lead:
          'A Tradíciókért Alapítvány a választás előtti, nem nyilvános pályázaton kapott 20 millió forintot visszautalta, a korábbi 15 milliós támogatást viszont megtartotta — a pályázati dokumentumból hiányzik a konkrét programleírás.',
        url: 'https://telex.hu/belfold/2026/09/12/radics-bela-fidesz-nka-palyazat-tamogatas-20-millio-visszafizetes-tradiciokert-alapitvany',
        date: '2026. szeptember 12.',
      },
      {
        type: 'checklist',
        id: 'arulkodo-jelek',
        heading: 'Öt árulkodó jel egy NKA-pályázaton',
        intro:
          'A két esetből ugyanaz a minta rajzolódik ki. Ezek azok a jelek, amelyek egy nyilvánosan elérhető NKA-pályázati adatlapon is kiszúrhatók voltak — akkor is, ha nem indult mögötte nyomozás.',
        items: [
          {
            title: 'Üres vagy általános programleírás',
            body: 'Ha a pályázatból nem derült ki, pontosan mi valósul meg — hány esemény, hol, kinek —, akkor az elszámolást sem volt mihez mérni. A Tradíciókért Alapítvány 15 milliós pályázatánál épp ez a sor maradt üresen.',
          },
          {
            title: 'Egyedi keret nyílt pályázat helyett',
            body: 'A nyílt kollégiumi ág 30 napos kiírással és 60 napos szakmai bírálattal járt. Ha a támogatás a 447-es vagy a 790-es egyedi keretből érkezett, ezek a fékek kimaradtak.',
          },
          {
            title: 'Választás előtti időzítés',
            body: 'A 2026-os ügy vitatott kifizetéseinek egy része négy nappal a parlamenti választás előtt, 2026. április 8-án született meg. A kulturális programok határidőihez semmi nem indokolta ezt az ütemezést.',
          },
          {
            title: 'Alvállalkozói kör a családon belül',
            body: 'A támogatott szervezet tovább szerződött olyan cégekkel, amelyek a projekt szereplőinek hozzátartozóihoz köthetők — a dokumentumfilmes szálban a 172,45 milliós támogatásból több mint 56 millió forint ment ilyen megbízásokra.',
          },
          {
            title: 'Fantomcím és friss alapítás',
            body: 'Több érintett szervezetnél ismétlődő elem volt a néhány éve bejegyzett alapítvány és a virtuálisiroda-cím, ahol több ezer cég van bejelentve. Az NKA győri szálában a négy vizsgált szervezetnél a bejegyzés dátuma is közös volt.',
          },
        ],
      },
      {
        type: 'table',
        id: 'szamok',
        heading: 'Az NKA-botrány számokban',
        intro: 'A nyilvános hatósági közlemények és sajtóértesülések alapján, 2026. szeptember 15-i állapot.',
        columns: ['Tétel', 'Összeg / adat', 'Forrás'],
        rows: [
          ['Vizsgálat alá vont NKA-kifizetések', '17+ milliárd Ft', { text: 'NAV', href: 'https://nav.gov.hu/sajtoszoba/hirek/Attores_az_NKA-ugyben' }],
          ['Választás előtt, miniszteri keretből kiosztva', '~394 millió Ft', { text: 'Telex', href: 'https://telex.hu/belfold/2026/05/23/nka-palyazati-penzek-visszafizetes-kis-grofo-varosliget-zrt' }],
          ['Önként visszautalt támogatás (49 pályázó)', '1,69 milliárd Ft', { text: 'Telex', href: 'https://telex.hu/belfold/2026/05/23/nka-palyazati-penzek-visszafizetes-kis-grofo-varosliget-zrt' }],
          ['Tarr Zoltán által visszatartott összeg', '~400 millió Ft', { text: '444', href: 'https://444.hu/2026/06/15/tarr-zoltan-kozel-400-millio-forintnyi-nka-tamogatast-von-vissza-amit-hanko-balazs-a-valasztas-elott-osztott-ki' }],
          ['A dokumentumfilm támogatása (790-es + 447-es keret)', '82,55 + 89,9 millió Ft', { text: 'Telex', href: 'https://telex.hu/belfold/2026/09/09/nka-botrany-fasy-dokumentumfilm-letartoztatas-birosag' }],
          ['Ebből a Fásy családhoz köthető cégeknek', '56+ millió Ft', { text: 'Telex', href: 'https://telex.hu/belfold/2026/09/09/nka-botrany-fasy-dokumentumfilm-letartoztatas-birosag' }],
          ['Radics Béla alapítványa: visszafizetve / megtartva', '20 / 15 millió Ft', { text: 'Telex', href: 'https://telex.hu/belfold/2026/09/12/radics-bela-fidesz-nka-palyazat-tamogatas-20-millio-visszafizetes-tradiciokert-alapitvany' }],
          ['Letartóztatásban lévő gyanúsítottak', '7 fő', 'Bács-Kiskun Vármegyei Főügyészség'],
        ],
        note:
          'A gyanúsítás és a kényszerintézkedés nem bűnösség megállapítása. Jogerős ítélet ebben az ügyben eddig nem született.',
      },
      {
        type: 'table',
        id: 'visszafizetok',
        heading: 'Ki mennyit fizetett vissza az NKA-nak?',
        intro:
          'A visszautalók teljes listáját az NKA nem hozta nyilvánosságra — a 49 pályázóból az alábbiakat nevesítette a sajtó. A harmadik oszlopban csak olyan kötődés szerepel, amit forrás is megnevez; ahol a sajtó nem azonosított mögöttes szereplőt, ott gondolatjel áll.',
        columns: ['Visszautaló', 'Összeg', 'Kihez / mihez köthető', 'Forrás'],
        rows: [
          ['Városliget Zrt.', '1,25 milliárd Ft', 'Állami tulajdonú projektcég (Liget Budapest)', { text: 'Telex', href: 'https://telex.hu/belfold/2026/05/23/nka-palyazati-penzek-visszafizetes-kis-grofo-varosliget-zrt' }],
          ['R56 Nonprofit Kft.', 'a kapott 375 millió Ft nagy része', 'A választásra indított Horizont nevű YouTube-csatorna üzemeltetője (Miniszterelnökség + NKA pénzéből)', { text: '444', href: 'https://444.hu/2026/09/13/375-millio-forint-allami-tamogatast-kapott-egy-ceg-ami-fideszes-youtube-csatornat-csinalt-a-valasztokra-a-nagy-reszet-a-penznek-visszautaltak' }],
          ['Cserkelő Természetvédelmi, Rekreációs és Egészségmegőrző Egyesület', '25 millió Ft', '—', { text: 'Telex', href: 'https://telex.hu/belfold/2026/05/23/nka-palyazati-penzek-visszafizetes-kis-grofo-varosliget-zrt' }],
          ['Nyírség Alapítvány', '20 millió Ft', '—', { text: 'Telex', href: 'https://telex.hu/belfold/2026/05/23/nka-palyazati-penzek-visszafizetes-kis-grofo-varosliget-zrt' }],
          ['Tradíciókért Alapítvány', '20 millió Ft', 'Radics Béla fideszes országgyűlési képviselő', { text: 'Telex', href: 'https://telex.hu/belfold/2026/09/12/radics-bela-fidesz-nka-palyazat-tamogatas-20-millio-visszafizetes-tradiciokert-alapitvany' }],
          ['Békés-VILL Kereskedelmi és Szolgáltató Kft.', '19,5 millió Ft', '—', { text: 'Telex', href: 'https://telex.hu/belfold/2026/05/23/nka-palyazati-penzek-visszafizetes-kis-grofo-varosliget-zrt' }],
          ['Isten Szolgálatában Református Missziói Alapítvány', '15 millió Ft', '—', { text: 'Telex', href: 'https://telex.hu/belfold/2026/05/23/nka-palyazati-penzek-visszafizetes-kis-grofo-varosliget-zrt' }],
          ['Aporliget Fénye Természetbarát Egyesület', '10 millió Ft', '—', { text: 'Telex', href: 'https://telex.hu/belfold/2026/05/23/nka-palyazati-penzek-visszafizetes-kis-grofo-varosliget-zrt' }],
          ['Smart System Solutions Kft.', '10 millió Ft', '—', { text: 'Telex', href: 'https://telex.hu/belfold/2026/05/23/nka-palyazati-penzek-visszafizetes-kis-grofo-varosliget-zrt' }],
          ['Kis-Grófo', '5 millió Ft', 'Előadóművész — maga ismerte el, hogy aránytalan volt az összeg', { text: 'Telex', href: 'https://telex.hu/belfold/2026/05/23/nka-palyazati-penzek-visszafizetes-kis-grofo-varosliget-zrt' }],
          ['További, meg nem nevezett pályázók', 'a 49 visszautalóval együtt összesen 1,69 milliárd Ft', '—', { text: 'Telex', href: 'https://telex.hu/belfold/2026/05/23/nka-palyazati-penzek-visszafizetes-kis-grofo-varosliget-zrt' }],
        ],
        note:
          'A visszafizetés önmagában nem jogi felelősségvállalás, és nem jelenti azt, hogy a visszautaló bármit jogszerűtlenül tett volna — több szervezet a nyomozás megindulására hivatkozva, önként utalt vissza. A teljes visszautalt összeg a 17 milliárd forintos vizsgált körnek nagyjából a tizede.',
      },
      {
        type: 'video',
        id: 'L8DWqeZp2l4',
        label: 'Partizán',
        title: 'Újabb 700 millió Orbán Ráhel lieblingjének, milliárdok a csókosoknak | Közpénzszivattyú az NKA-nál',
        summary:
          'A Partizán összeállítása arról, hogyan koncentrálódtak az NKA-támogatások kormányközeli szervezetekhez — jó kiindulópont, ha az egyes pályázati döntések hátterére vagy kíváncsi.',
      },
      {
        type: 'text',
        id: 'hogyan-nezz-utana',
        heading: 'Hogyan nézhetsz utána magad egy NKA-pályázatnak?',
        content:
          'A kollégiumi döntések listái az NKA portálján nyilvánosak: pályázónként, azonosítóval és megítélt összeggel. Ha egy szervezetnek utánanéznél, érdemes három forrást összevetni: az NKA döntési listáját (mennyit kapott, melyik kollégiumtól vagy keretből), a bírósági nyilvántartást vagy a cégjegyzéket (mikor alapították, hol a székhely, kik a képviselők), és a Közbeszerzési Értesítőt vagy az átláthatósági adatbázisokat, ha a szervezet más állami forrásból is részesült. Ugyanezt a három lépést jártuk végig a saját adatbázisunkban is: a Kegyencjárat korrupciós adatbázisa ügyenként gyűjti a dokumentált közpénz-érintettséget és a forrásokat.',
        links: [
          {
            text: 'az NKA portálján',
            href: 'https://nka.hu/kategoria/kiemelt-kategoriak/dontesek/kollegiumi-dontesek/',
            external: true,
          },
          { text: 'a Kegyencjárat korrupciós adatbázisa', href: '/adatbazis' },
        ],
      },
    ],
    faq: [
      {
        q: 'Mikor írták ki az NKA-pályázatokat?',
        a: 'A kollégiumok folyamatosan, szakterületenként írtak ki pályázatokat. A felhívást legkésőbb a benyújtási határidőt megelőző 30. napon közzé kellett tenni az NKA portálján, meghívásos pályázatnál 7 nappal korábban.',
      },
      {
        q: 'Mennyi volt az NKA-pályázat nevezési díja?',
        a: 'A nevezési díjat a kollégium határozta meg, és a pályázati felhívás rögzítette. Egyedi pályázatnál az igényelt támogatás 1%-a + 27% áfa, de legalább 10 000 Ft + 27% áfa. Befizetés nélkül a pályázat érvénytelen volt.',
      },
      {
        q: 'Mennyi idő alatt döntött az NKA kollégiuma?',
        a: 'A benyújtási határidőtől számított 60 napon belül. A döntésről a pályázók legkésőbb 20 napon belül kaptak értesítést a felhasználói fiókjukban, és a döntés ellen nem volt helye fellebbezésnek.',
      },
      {
        q: 'Mi volt a 447-es és a 790-es keret az NKA-nál?',
        a: 'Egyedi elbírálású keretek, amelyekből szakmai kollégiumi bírálat nélkül lehetett támogatást odaítélni. A Fásy családhoz köthető dokumentumfilm első két része a 790-es keretből kapott 82,55 millió forintot, a harmadik és negyedik rész pedig Hankó Balázs 447-es miniszteri keretéből 89,9 milliót.',
      },
      {
        q: 'Mennyi NKA-támogatást fizettek vissza a pályázók?',
        a: 'Az Index közérdekű adatigénylése szerint 49 pályázó összesen 1,69 milliárd forintot utalt vissza önként — a legnagyobb tétel a Városliget Zrt. 1,25 milliárdja. Ehhez jön Tarr Zoltán miniszter mintegy 400 millió forintos visszatartása és a Radics Béla alapítványa által visszafizetett 20 millió forint.',
      },
      {
        q: 'Ki a felelős az NKA-botrányban?',
        a: 'Felelősséget jogerős bírósági ítélet állapíthat meg, ilyen eddig nem született. A NAV hűtlen kezelés bűntettének gyanújával nyomoz, az ügyben tizenegy embert helyeztek letartóztatásba — 2026. október 1-jén Hankó Balázs volt kulturális minisztert is, akinek a keretéből a vitatott kifizetések indultak.',
      },
    ],
    sources: [
      { label: 'NKA: Pályázati tudnivalók (hivatalos eljárásrend)', url: 'https://nka.hu/kiemelt-kategoriak/palyaztatas/kollegiumok-felhivasai/palyazati-tudnivalok/' },
      { label: 'NKA: Kollégiumi döntések', url: 'https://nka.hu/kategoria/kiemelt-kategoriak/dontesek/kollegiumi-dontesek/' },
      { label: 'Telex: Érthetetlen, miért adott Hankó Balázs több mint százmillió forintot erre a filmre (aug. 5.)', url: 'https://telex.hu/belfold/2026/08/05/kez-sziv-lelek-magyar-kortars-muveszek-nyomaban-film-youtube-elso-ket-resz-fasy-zsuliett-cegei-nka-tamogatas' },
      { label: 'Telex: NKA-botrány — letartóztatták Fásy Ádám feleségét (szept. 9.)', url: 'https://telex.hu/belfold/2026/09/09/nka-botrany-fasy-dokumentumfilm-letartoztatas-birosag' },
      { label: 'Telex: Radics Béla alapítványa visszafizetett 20 milliót (szept. 12.)', url: 'https://telex.hu/belfold/2026/09/12/radics-bela-fidesz-nka-palyazat-tamogatas-20-millio-visszafizetes-tradiciokert-alapitvany' },
      { label: 'hvg.hu: Üresen hagyták a sort, ahol le kellett volna írni, mire kérnek 15 milliót (szept. 12.)', url: 'https://hvg.hu/gazdasag/20260912_radics-bela-alapitvany-milliok-visszafizet' },
      { label: 'Index: Radics Béla elárulta, miért utalta vissza a támogatást (szept. 14.)', url: 'https://index.hu/belfold/2026/09/14/radics-bela-alapitvany-nka-tamogatas-fidesz-botrany/' },
      { label: '444: 375 millió állami támogatást kapott a fideszes YouTube-csatornát csináló cég (szept. 13.)', url: 'https://444.hu/2026/09/13/375-millio-forint-allami-tamogatast-kapott-egy-ceg-ami-fideszes-youtube-csatornat-csinalt-a-valasztokra-a-nagy-reszet-a-penznek-visszautaltak' },
      { label: 'NAV.hu: Áttörés az NKA-ügyben — hat személyt vettek őrizetbe (jún. 23.)', url: 'https://nav.gov.hu/sajtoszoba/hirek/Attores_az_NKA-ugyben' },
      { label: 'Telex: 49 pályázó 1,69 milliárdot utalt vissza (máj. 23.)', url: 'https://telex.hu/belfold/2026/05/23/nka-palyazati-penzek-visszafizetes-kis-grofo-varosliget-zrt' },
      { label: 'Portfolio: Dagad az NKA-botrány, már Győrben is nyomoznak (jún. 16.)', url: 'https://www.portfolio.hu/gazdasag/20260616/dagad-az-nka-botrany-mar-gyorben-is-nyomoznak-843584' },
    ],
    crossPromoAfterBlockId: 'radics-szal',
    internalLinks: [
      { label: 'NKA botrány — a teljes ügy idővonala', href: '/ugyek/nka-botrany', note: 'Letartóztatások, hatósági közlemények, videók, napi frissítéssel.' },
      { label: 'Korrupciós adatbázis', href: '/adatbazis', note: 'Ügyenként dokumentált közpénz-érintettség és források.' },
      { label: 'Lemondások és felmentések', href: '/lemondasok', note: 'Bús Balázs, Báán László és Vidnyánszky Attila NKA-s pozíciójának sorsa is itt.' },
      { label: 'Visszaszerzett vagyon', href: '/visszaszerzett-vagyon', note: 'Mennyi közpénz folyt eddig vissza az államhoz — az 1,69 milliárd NKA-s visszautalással együtt.' },
    ],
  },
  {
    id: 'nka-letartoztatas',
    parentId: 'nka-botrany',
    seoTitle: 'NKA letartóztatás — kit tartóztattak le eddig az NKA-botrányban?',
    seoDescription:
      'Az NKA-botrány összes letartóztatottja egy listán, napra kész adatbázisból: ki van még előzetesben, kit engedtek szabadon, és mi a gyanú ellenük.',
    h1: 'NKA letartóztatás: kit tartóztattak le eddig az NKA-botrányban?',
    eyebrow: 'NKA-botrány · letartóztatások',
    lead:
      'Az első NKA letartóztatás 2026. június 23-án történt, amikor a NAV hat embert vett őrizetbe. Azóta az NKA-botrányban tizenegy ember került előzetes letartóztatásba — 2026. október 1-jén Hankó Balázs volt kulturális miniszter és egykori államtitkára, Varga-Bajusz Veronika is —, közülük kettőt már szabadlábra helyeztek. Az alábbi lista az adatbázisunkból frissül: amint egy újabb NKA letartóztatás nyilvánossá válik, automatikusan megjelenik itt is.',
    publishedAt: '2026-09-15',
    updatedAt: '2026-10-01',
    heroImage: {
      src: '/images/persons/hanko-balazs.webp',
      alt: 'Hankó Balázs volt kulturális és innovációs miniszter, akit 2026. október 1-jén letartóztattak az NKA-ügyben',
      credit: 'Eredeti fotó: kultura.hu',
    },
    promo: {
      eyebrow: 'Háttér · NKA-letartóztatások',
      title: 'Ki ül most az NKA-botrány miatt? Nézd meg a teljes listát',
      lead:
        'Napra kész lista arról, kit tartóztattak le eddig az NKA-ügyben, ki van még előzetesben, és kit engedtek szabadon. Mellette az is, mi a gyanú ellenük, melyik bíróság döntött, és honnan tudjuk. Az adatbázisunkból frissül, tehát mindig a friss állapotot látod.',
      cta: 'Megnézem a letartóztatottakat',
    },
    blocks: [
      ...parentBreaking('nka-botrany'),
      {
        type: 'detention-table',
        id: 'lista',
        heading: 'Az NKA-botrány letartóztatottjai — a teljes lista',
        intro:
          'Ez a táblázat ugyanabból az adatbázisból jön, mint a „Börtönben van-e?” oldalunk, ezért nem kézi lista: minden új NKA letartóztatás automatikusan megjelenik itt, amint bekerül a nyilvántartásunkba. A státusz-oszlop a legutóbbi ismert bírósági döntést mutatja.',
        ugyId: 'nka-botrany',
        acronym: 'NKA',
        note:
          'Az előzetes letartóztatás kényszerintézkedés, nem büntetés, és nem jelenti a bűnösség megállapítását. Jogerős ítélet az NKA-ügyben eddig egyetlen érintett esetében sem született, tehát mindannyian ártatlannak tekintendők.',
      },
      {
        type: 'text',
        id: 'elso-hullam',
        heading: 'Az első NKA letartóztatás: a 2026. június 23-i hajnali akció',
        content:
          'Az ügy első kényszerintézkedéseire 2026. június 23-án került sor. A Nemzeti Adó- és Vámhivatal nyomozói ezen a napon hat embert vettek őrizetbe hűtlen kezelés bűntettének megalapozott gyanújával, és ezzel indult el az a sorozat, amit ma NKA letartóztatás néven keres a legtöbb olvasó. A NAV saját közleménye szerint a nyomozás több mint 17 milliárd forintnyi pályázati kifizetést érint. Az őrizetbe vettek között volt a Nemzeti Kulturális Támogatáskezelő (NKTK) főigazgatója, Krucsainé Herter Anikó és kabinetvezetője, Unger Erika, továbbá a Kulturális és Innovációs Minisztérium két korábbi kabinetfőnök-helyettese, Burom Gábor és Zámbó Nóra. A hatodik őrizetbe vett Ughy Attila, Budapest XVIII. kerületének volt polgármestere volt. A hatóság mind a hat esetben indítványozta a letartóztatást az ügyészségnél.',
      },
      {
        type: 'video',
        id: 'Siut6OuE0rU',
        label: 'ATV',
        title: 'NKA-botrány: újabb gyanúsítások, újabb letartóztatások',
        summary:
          'Az ATV összefoglalója a bővülő gyanúsítotti körről — jól mutatja, hogyan gyűrűzött tovább az ügy az első hullám után.',
      },
      {
        type: 'text',
        id: 'bus-balazs',
        heading: 'Bús Balázs: a legismertebb név az NKA letartóztatottjai között',
        content:
          'A leggyakrabban keresett NKA letartóztatás Bús Balázsé, az NKA korábbi alelnökéé, aki 2010 és 2019 között Óbuda–Békásmegyer fideszes polgármestere volt. Őt szintén a júniusi akcióban vették őrizetbe, és a sajtóértesülések szerint részletes vallomást tett. Az ő ügyében látszik a legjobban, hogy az előzetes letartóztatás nem egyszeri döntés, hanem ismételten felülvizsgált állapot: a Kecskeméti Járásbíróság 2026 júliusában három hónappal meghosszabbította Bús Balázs és további három gyanúsított letartóztatását. A bíróság indoklása szerint fennállt a szökés, az elrejtőzés és az eljárás befolyásolásának veszélye — ugyanaz a három klasszikus indok, amivel a bíróságok az NKA-ügy többi letartóztatását is elrendelték.',
      },
      {
        type: 'video',
        id: 'PASyBX6xh6c',
        label: 'ATV',
        title: 'NKA-botrány: őrizetbe vették és gyanúsítottként hallgatták ki Bús Balázst',
        summary:
          'A tudósítás Bús Balázs őrizetbe vételéről — ő az NKA korábbi alelnöke, és az ügy legismertebb letartóztatottja.',
      },
      {
        type: 'text',
        id: 'hetedik',
        heading: 'A hetedik gyanúsított és az első szabadlábra helyezés',
        content:
          'A következő NKA letartóztatás 2026 júliusában történt: a Fidesz frakciójának egyik, kormánytisztviselőként is dolgozó munkatársát vitték el hajnalban otthonából. A párt először nem volt hajlandó megnevezni az érintettet, és politikailag motiváltnak nevezte az eljárásokat. Néhány nappal később derült ki, hogy Konczos Nóráról, Hankó Balázs volt kulturális miniszter egykori kabinetfőnökéről van szó; a gyanú szerint ő kérte egy e-mailben, hogy biztosítsák a pénzt Mága Zoltán pályázatára, amelyben 500 millió forintot szántak a cigány szavazók, az idősek és a politikailag bizonytalan választók megszólítására. Az ő esete lett az első, ahol a kényszerintézkedés enyhült: 2026. augusztus 19-én a bíróság megszüntette az előzetes letartóztatását, és bűnügyi felügyelet alá helyezte. Egy héttel később egy másik, a sajtó által soha nem nevesített gyanúsított is kikerült az előzetesből. Ez a két eset jól mutatja, hogy egy NKA letartóztatás nem végleges állapot — a bíróság bármikor enyhítheti vagy szigoríthatja.',
      },
      {
        type: 'text',
        id: 'fasy-szal',
        heading: 'A Fásy-szál: a szeptemberi NKA letartóztatás egy dokumentumfilm miatt',
        content:
          'A 2026. szeptemberi NKA letartóztatás már nem hivatalnokokat, hanem a pénz végső felhasználóit érte el. A NAV szeptember 7-én vett őrizetbe két embert egy négyrészes dokumentumfilm támogatása miatt, majd a Kecskeméti Járásbíróság szeptember 9-én egy hónapra letartóztatta Fásyné Gurzó Máriát, Fásy Ádám feleségét, és Szabó Sándort, a megbízó Munkácsy Art Kft. tulajdonos-ügyvezetőjét. A gyanú bűnszövetségben elkövetett költségvetési csalás és hamis magánokirat felhasználása: a film első két részére 82,55 millió forint érkezett az NKA 790-es keretéből, a harmadik és negyedik részre pedig 89,9 millió forint Hankó Balázs 447-es miniszteri keretéből, az elszámolás határidejére viszont a film nem készült el, az elkészültét pedig fiktív számlákkal igazolták volna. Fontos pontosítás, mert sokan keverik: Fásy Ádám ellen tudomásunk szerint nem folyik eljárás, ő nem szerepel az NKA letartóztatottjai között.',
      },
      {
        type: 'video',
        id: 'OfMzRRIJ9WQ',
        label: 'Telex',
        title: 'Segélyszervezetnek tűnt, aztán rájöttünk, hogy ez a Fidesz – az NKA-botrány mélyére mentünk',
        summary:
          'A Telex oknyomozó videója arról a szervezeti hálóról, amelyből a pénz egy része kifolyt — ez a háttér vezetett a gyanúsításokhoz és a letartóztatásokhoz.',
      },
      {
        type: 'text',
        id: 'mit-jelent',
        heading: 'Mit jelent pontosan az előzetes letartóztatás?',
        content:
          'Egy NKA letartóztatás hírének olvasásakor érdemes tudni, mit jelentenek a jogi fokozatok, mert a sajtó gyakran felcseréli őket. Az őrizetbe vétel legfeljebb 72 órás intézkedés; ezalatt az ügyészségnek indítványoznia kell a letartóztatást, különben az érintettet el kell engedni. A letartóztatásról már bíróság dönt, jellemzően egy hónapra, és ezt meghosszabbíthatja — Bús Balázs esetében három hónappal. A törvényi indokok kötöttek: a szökés vagy elrejtőzés veszélye, az eljárás befolyásolásának, például a tanúk megfélemlítésének veszélye, illetve a bűnismétlés veszélye. Enyhébb eszköz a bűnügyi felügyelet, ami lakhelyelhagyási tilalommal jár, de nem fogva tartás — Konczos Nóra ezt kapta. Egyik fokozat sem ítélet: a gyanúsított mindaddig ártatlannak tekintendő, amíg a bíróság jogerősen mást nem mond, és az NKA-ügyben ez eddig egyetlen esetben sem történt meg.',
      },
      {
        type: 'video',
        id: 'msRqbs0R_-c',
        label: 'Molnár Áron',
        title: 'Újabb NKA-botrány: 45 millió közpénz, mégis 0 Ft bevétel?!',
        summary:
          'Molnár Áron összeállítása egy újabb gyanús NKA-támogatásról — az ő bejelentései nyomán indult el az ügy jelentős része, a NAV őt tanúként hallgatta ki.',
      },
      {
        type: 'text',
        id: 'hol-tart',
        heading: 'Hol tart most az ügy, és várható-e újabb NKA letartóztatás?',
        content:
          'A nyomozás 2026 őszén is zajlik, és földrajzilag is terjed: Budapest mellett Győrben is eljárás indult, ahol négy helyi kulturális szervezet kapott aránytalanul nagy összegeket úgy, hogy érdemi tevékenységet nem folytattak, és a bejegyzési dátumuk is közös volt. A gyanúsítotti kör kilenc fő fölé bővült, a vizsgált kifizetések összege pedig meghaladja a 17 milliárd forintot. Mivel az ügy a támogatások végső felhasználói felé halad — ezt mutatja a szeptemberi, dokumentumfilmes szál —, további NKA letartóztatás reálisan várható. Az eljárás a politikai vezetést is elérte: a parlament felfüggesztette Hankó Balázs volt kulturális miniszter mentelmi jogát, akinek miniszteri keretéből a vitatott kifizetések indultak; 2026. szeptember 28-án őrizetbe vették, október 1-jén a Kecskeméti Járásbíróság letartóztatta, ugyanaznap egykori államtitkárát, Varga-Bajusz Veronikát is. Ez az oldal a hatósági közleményeket és a dokumentált sajtóértesüléseket követi, és minden újabb kényszerintézkedéssel frissül.',
      },
      {
        type: 'video',
        id: 'KnzfHvXsZKg',
        label: 'HETI NAPLÓ',
        title: 'NKA-botrány: Molnár Áron miatt nem kapott állami támogatást Duda Éva táncművész',
        summary:
          'A Heti Napló riportja arról, hogy az NKA-nál a támogatás megvonása is politikai döntés lehetett — a botrány másik, ritkábban tárgyalt oldala.',
      },
    ],
    faq: [
      {
        q: 'Hány embert tartóztattak le az NKA-botrányban?',
        a: 'Eddig tizenegy embert helyeztek előzetes letartóztatásba: hatot a 2026. június 23-i NAV-akció után, egyet júliusban, kettőt szeptemberben (Fásyné Gurzó Máriát és Szabó Sándort), kettőt pedig október 1-jén (Hankó Balázst és Varga-Bajusz Veronikát). Közülük kettő már szabadlábon van, a többiek ellen az eljárás folyamatban van. A fenti lista mindig a friss állapotot mutatja.',
      },
      {
        q: 'Ki volt az első letartóztatott az NKA-ügyben?',
        a: 'Az első NKA letartóztatás a 2026. június 23-i NAV-akcióhoz köthető, amikor hat embert vettek őrizetbe egyszerre — köztük az NKTK főigazgatóját, Krucsainé Herter Anikót, az NKA korábbi alelnökét, Bús Balázst, és Ughy Attilát, Budapest XVIII. kerületének volt polgármesterét.',
      },
      {
        q: 'Letartóztatták Fásy Ádámot?',
        a: 'Nem. Fásy Ádám ellen tudomásunk szerint nem folyik eljárás. A feleségét, Fásyné Gurzó Máriát helyezte letartóztatásba a Kecskeméti Járásbíróság 2026. szeptember 9-én, Szabó Sándorral, a megbízó cég tulajdonos-ügyvezetőjével együtt.',
      },
      {
        q: 'Meddig tarthat az előzetes letartóztatás?',
        a: 'A bíróság jellemzően egy hónapra rendeli el, és ezt meghosszabbíthatja — Bús Balázs esetében három hónappal. Az őrizetbe vétel ettől külön intézkedés, az legfeljebb 72 óráig tarthat, azalatt kell az ügyészségnek a letartóztatást indítványoznia.',
      },
      {
        q: 'Kit engedtek szabadon az NKA-ügyben?',
        a: 'Konczos Nórát, Hankó Balázs egykori kabinetfőnökét 2026. augusztus 19-én bűnügyi felügyelet alá helyezték, megszüntetve az előzetes letartóztatását. Egy héttel később egy másik, a sajtó által nem nevesített gyanúsított is kikerült az előzetesből.',
      },
      {
        q: 'Letartóztatták Hankó Balázst?',
        a: 'Igen. A parlament felfüggesztette a mentelmi jogát, 2026. szeptember 28-án őrizetbe vették, október 1-jén pedig a Kecskeméti Járásbíróság letartóztatta. A gyanú különösen jelentős vagyoni hátrányt okozó, bűnszövetségben elkövetett hűtlen kezelés; a vitatott kifizetések jelentős része az ő 447-es miniszteri keretéből indult.',
      },
    ],
    sources: [
      { label: 'NAV.hu: Áttörés az NKA-ügyben — hat személyt vett őrizetbe a NAV (jún. 23.)', url: 'https://nav.gov.hu/sajtoszoba/hirek/Attores_az_NKA-ugyben' },
      { label: 'Telex: NKA-botrány — hat személyt vett őrizetbe a NAV (jún. 23.)', url: 'https://telex.hu/belfold/2026/06/23/nka-botrany-hat-szemelyt-orizetbe-vett-a-nav-hanko-balazs-tarr-zoltan' },
      { label: '444: Újabb fideszes gyanúsított és letartóztatás az NKA-ügyben (júl. 22.)', url: 'https://444.hu/2026/07/22/ujabb-fideszes-gyanusitott-es-letartoztatas-az-nka-ugyben' },
      { label: 'Telex: Letartóztatták Hankó Balázs egykori kabinetfőnökét, Konczos Nórát (júl. 23.)', url: 'https://telex.hu/belfold/2026/07/23/nka-letartoztatas-hanko-kabinetfonok' },
      { label: 'HVG: Bűnügyi felügyelet — kikerült az előzetesből az NKA-ügy egyik gyanúsítottja (aug. 26.)', url: 'https://hvg.hu/itthon/20260826_nka-botrany-gyanusitott-letartoztatas-bunugyi-felugyelet' },
      { label: '444: Őrizetbe vettek két embert egy, a Fásy családhoz köthető dokumentumfilm miatt (szept. 8.)', url: 'https://444.hu/2026/09/08/orizetbe-vettek-ket-embert-egy-fasy-csaladhoz-kotheto-dokumentumfilm-miatt' },
      { label: 'Telex: NKA-botrány — letartóztatták Fásy Ádám feleségét (szept. 9.)', url: 'https://telex.hu/belfold/2026/09/09/nka-botrany-fasy-dokumentumfilm-letartoztatas-birosag' },
      { label: 'Portfolio: Dagad az NKA-botrány, már Győrben is nyomoznak (jún. 16.)', url: 'https://www.portfolio.hu/gazdasag/20260616/dagad-az-nka-botrany-mar-gyorben-is-nyomoznak-843584' },
    ],
    crossPromoAfterBlockId: 'hetedik',
    internalLinks: [
      { label: 'Börtönben van-e már?', href: '/birosagi-iteletek', note: 'Az összes NER-hez kapcsolható eljárás — nem csak az NKA-ügy — ugyanebből az adatbázisból.' },
      { label: 'NKA botrány — a teljes ügy idővonala', href: '/ugyek/nka-botrany', note: 'Hatósági közlemények, videók, napi frissítéssel.' },
      { label: 'Lemondások és felmentések', href: '/lemondasok', note: 'Bús Balázs, Báán László és Vidnyánszky Attila NKA-s pozíciójának sorsa.' },
    ],
  },
  // ── CSAK LOKÁLIS ELŐNÉZET (2026-09-15) ────────────────────────────────
  // A user egy Telex-féle „kérdezz-felelek" formátumú változatot kért
  // ugyanabból a tartalomból, összehasonlításra. Ez a bejegyzés NINCS
  // élesítve — ha bármikor kimegy a main-re, akkor a /ugyek/nka-botrany
  // oldalon HÁROM promó jelenne meg, és a sitemapbe is bekerülne egy
  // duplikált tartalmú oldal (kannibalizáció ugyanarra a kulcsszóra).
  // Vagy ez, vagy a hagyományos /nka-palyazatok maradjon — ne mindkettő.
  {
    id: 'nka-palyazatok-2',
    parentId: 'nka-botrany',
    draft: true,
    seoTitle: 'Mi ez a nagy felhajtás az NKA-pályázatok körül? – Kérdezz-felelek',
    seoDescription:
      'Mi történt pontosan az NKA-pályázatokkal, kik a főszereplők, és miért fontos ez neked? A legfontosabb tudnivalók kérdés-válasz formában, számokkal.',
    h1: 'Mi ez a nagy felhajtás az NKA-pályázatok körül? – Kérdezz-felelek',
    eyebrow: 'Kérdezz-felelek · NKA-pályázatok',
    lead:
      'A nyár óta szinte minden híroldalt elleptek az NKA-pályázatokkal kapcsolatos hírek: letartóztatások, visszautalt milliárdok, egy dokumentumfilm, ami el sem készült. De mi történt pontosan, kik a főszereplők, és hogyan érinti ez a mindennapi életünket? Összefoglaltuk a legfontosabb tudnivalókat.',
    publishedAt: '2026-09-15',
    updatedAt: '2026-09-15',
    heroImage: {
      src: '/images/persons/hanko-balazs.webp',
      alt: 'Hankó Balázs volt kulturális miniszter, akinek miniszteri keretéből az NKA-pályázatok vitatott kifizetései indultak',
      credit: 'Eredeti fotó: kultura.hu',
    },
    promo: {
      eyebrow: 'Kérdezz-felelek · NKA-pályázatok',
      title: 'Mi ez a nagy felhajtás az NKA-pályázatok körül?',
      lead:
        'Mi történt pontosan, mi vezetett idáig, ki mit állít, és miért fontos ez neked? A teljes NKA-ügy kérdés-válasz formában, öt perc alatt átlátható módon.',
      cta: 'Elolvasom a kérdezz-feleleket',
    },
    blocks: [
      {
        type: 'text',
        id: 'mi-tortent',
        heading: 'Mi történt pontosan?',
        content:
          'A NAV 2026. június 23-án hat embert vett őrizetbe hűtlen kezelés gyanújával a Nemzeti Kulturális Alapnál kiosztott pénzek miatt. Azóta heten kerültek előzetes letartóztatásba, köztük az NKA korábbi alelnöke, Bús Balázs és a támogatáskezelő NKTK főigazgatója; szeptemberben már a pénz végső felhasználóit is elérte az ügy. A nyomozás több mint 17 milliárd forintnyi NKA-pályázati kifizetést érint, és 49 korábbi nyertes önként visszautalt összesen 1,69 milliárd forintot.',
      },
      {
        type: 'text',
        id: 'mi-vezetett',
        heading: 'Mi vezetett idáig?',
        content:
          'Az ügy kirobbanásának pontos időzítése nem véletlen. Hankó Balázs akkori kulturális miniszter négy nappal a 2026-os parlamenti választás előtt, április 8-án közel 394 millió forintot osztott ki egyedi miniszteri keretből. A kormányváltás után az új kulturális miniszter, Tarr Zoltán visszavonta ezeket a döntéseket, elrendelte a korábbi kifizetések átvizsgálását, és mintegy 400 millió forintot vissza is tartott. Az átvizsgálás nyomán derült ki, milyen szervezetek jutottak nagy összegekhez az NKA-pályázatokon úgy, hogy érdemi kulturális tevékenységet nem folytattak — és innen már egyenes út vezetett a NAV nyomozásáig.',
      },
      {
        type: 'text',
        id: 'hogyan-mukodtek',
        heading: 'Hogyan működtek egyáltalán az NKA-pályázatok?',
        content:
          'Két, egymástól nagyon eltérő úton lehetett NKA-pénzhez jutni. A nyílt pályázatokat legkésőbb 30 nappal a határidő előtt közzé kellett tenni, a beadás elektronikusan ment, nevezési díjjal, tételes költségvetéssel, és egy szakmai kollégium bírálta el őket 60 napon belül. A másik út az egyedi, 447-es és 790-es keret volt: itt nem volt nyilvános kiírás és nem volt kollégiumi bírálat sem — a támogatás egyetlen aláíráson múlt. A botrány kifizetései szinte kivétel nélkül erről a második útról indultak.',
      },
      {
        type: 'image',
        src: '/images/cases/nka-palyazatok-penzutvonal.svg',
        srcMobile: '/images/cases/nka-palyazatok-penzutvonal-mobil.svg',
        alt: 'Ábra: az NKA pályázati pénz két útja — nyílt kollégiumi pályázat, szemben az egyedi 447-es és 790-es kerettel',
        caption: 'Ugyanaz a közpénz, két teljesen más út — a botrány a jobb oldali ágon történt.',
      },
      {
        type: 'stances',
        id: 'ki-mit-allit',
        heading: 'Ki és mit állít a vitában?',
        sides: [
          {
            label: 'A korábbi döntéshozók szerint',
            body:
              'A Fidesz politikailag motiváltnak és koncepciósnak nevezte az eljárásokat, a letartóztatottakra pedig „politikai fogvatartottakként" hivatkozott, akiknek a szabadon engedését követeli. Hankó Balázs volt kulturális miniszter szerint a kifizetések szabályosak voltak. Radics Béla fideszes képviselő, akinek alapítványa visszafizetett 20 millió forintot, azzal indokolta a döntést, hogy a parlamenti munkája mellett nem tudná megfelelő minőségben irányítani a programot — tehát nem hibát ismert el.',
          },
          {
            label: 'A kritikusok szerint',
            body:
              'Az NKA egy korábbi kuratóriumi tagja nyilvánosan úgy fogalmazott: „érdemtelenek kaptak érdemtelenül sok pénzt többnyire értelmezhetetlen projektekre". Molnár Áron, akinek bejelentései nyomán az ügy jelentős része elindult, tiltott kampányfinanszírozás gyanúját is felvetette, és Hankó Balázs, valamint Radics Béla mentelmi jogának kikérését sürgeti. A visszautalások időzítése — a nyomozás megindulása után — szerintük önmagában is beszédes.',
          },
        ],
      },
      {
        type: 'text',
        id: 'foszereplok',
        heading: 'Kik a főszereplők?',
        content:
          'A hivatali oldalon Hankó Balázs volt kulturális miniszter áll, akinek keretéből a vitatott pénzek indultak; 2026. október 1-jén őt is letartóztatták. Az ügy legismertebb letartóztatottja korábban Bús Balázs volt, az NKA korábbi alelnöke, Óbuda volt fideszes polgármestere. A pénz felhasználói oldalán a legtöbbet emlegetett szál a Fásy családhoz köthető dokumentumfilm: a Kéz, szív, lélek című sorozatra 172,45 millió forint ment el, az elszámolás határidejére mégsem készült el, az elkészültét pedig a gyanú szerint fiktív számlákkal igazolták. Itt fontos pontosítani, mert sokan félreértik: Fásy Ádám ellen nem folyik eljárás, a feleségét és egy vele szerződő cég vezetőjét helyezte letartóztatásba a bíróság.',
      },
      {
        type: 'video',
        id: 'wKZSqY6168E',
        label: 'ATV',
        title: 'Megkérdeztük Fásy Ádámtól, kapott-e 101 millió forintot Fásy Zsüliett az NKA-tól',
        summary: 'Az ATV riportja a Fásy Zsülietthez köthető cégek NKA-támogatásairól.',
      },
      {
        type: 'text',
        id: 'miert-fontos',
        heading: 'Miért fontos ez nekem, átlagemberként?',
        content:
          'Azért, mert az NKA pénze a te pénzed: az alap bevétele részben az ötöslottó szerencsejáték-adójából és a kulturális járulékból származik, vagyis közpénz. A vizsgált 17 milliárd forint nagyjából annyi, mint amiből több vidéki színház vagy könyvtár egy teljes évet működne. Ha ez az összeg érdemi kulturális teljesítmény nélküli szervezetekhez folyt, akkor nem elvont politikai kérdésről van szó: konkrét előadások, kiállítások, könyvkiadások maradtak el helyette. A másik, közvetlenebb hatás, hogy a valódi kulturális szereplők — a Heti Napló riportja szerint például Duda Éva táncművész — épp emiatt estek el a támogatástól.',
      },
      {
        type: 'video',
        id: 'KnzfHvXsZKg',
        label: 'HETI NAPLÓ',
        title: 'NKA-botrány: Molnár Áron miatt nem kapott állami támogatást Duda Éva táncművész',
        summary: 'Amikor a támogatás megvonása is politikai döntés lett — a botrány ritkábban tárgyalt oldala.',
      },
      {
        type: 'table',
        id: 'visszafizetok',
        heading: 'Ki mennyit fizetett vissza?',
        intro:
          'A visszautalók teljes listáját az NKA nem hozta nyilvánosságra — a 49 pályázóból az alábbiakat nevesítette a sajtó.',
        columns: ['Visszautaló', 'Összeg', 'Kihez / mihez köthető', 'Forrás'],
        rows: [
          ['Városliget Zrt.', '1,25 milliárd Ft', 'Állami tulajdonú projektcég (Liget Budapest)', { text: 'Telex', href: 'https://telex.hu/belfold/2026/05/23/nka-palyazati-penzek-visszafizetes-kis-grofo-varosliget-zrt' }],
          ['R56 Nonprofit Kft.', 'a kapott 375 millió Ft nagy része', 'A Horizont nevű YouTube-csatorna üzemeltetője', { text: '444', href: 'https://444.hu/2026/09/13/375-millio-forint-allami-tamogatast-kapott-egy-ceg-ami-fideszes-youtube-csatornat-csinalt-a-valasztokra-a-nagy-reszet-a-penznek-visszautaltak' }],
          ['Tradíciókért Alapítvány', '20 millió Ft', 'Radics Béla fideszes országgyűlési képviselő', { text: 'Telex', href: 'https://telex.hu/belfold/2026/09/12/radics-bela-fidesz-nka-palyazat-tamogatas-20-millio-visszafizetes-tradiciokert-alapitvany' }],
          ['Kis-Grófo', '5 millió Ft', 'Előadóművész — maga ismerte el, hogy aránytalan volt az összeg', { text: 'Telex', href: 'https://telex.hu/belfold/2026/05/23/nka-palyazati-penzek-visszafizetes-kis-grofo-varosliget-zrt' }],
          ['További, meg nem nevezett pályázók', 'a 49 visszautalóval együtt összesen 1,69 milliárd Ft', '—', { text: 'Telex', href: 'https://telex.hu/belfold/2026/05/23/nka-palyazati-penzek-visszafizetes-kis-grofo-varosliget-zrt' }],
        ],
        note: 'A visszafizetés önmagában nem jogi felelősségvállalás — több szervezet a nyomozás megindulására hivatkozva, önként utalt vissza.',
      },
      {
        type: 'text',
        id: 'mi-varhato',
        heading: 'Mi várható a következőkben?',
        content:
          'A nyomozás 2026 őszén is zajlik, és terjed: Budapest mellett Győrben is eljárás indult négy helyi szervezet miatt. Mivel az ügy a támogatások végső felhasználói felé halad, további gyanúsítások és letartóztatások reálisan várhatók. A letartóztatottak ügyében a bíróságnak rendszeresen felül kell vizsgálnia a kényszerintézkedést — Bús Balázsét például három hónappal hosszabbították meg, Konczos Nóráét viszont augusztusban bűnügyi felügyeletre enyhítették. Vádemelésről és jogerős ítéletről egyelőre nincs szó: az NKA-pályázatok ügyében eddig egyetlen érintett bűnössége sem került megállapításra.',
      },
    ],
    faq: [
      {
        q: 'Mennyi pénzről szól az NKA-botrány?',
        a: 'A NAV szerint a vizsgált NKA-pályázati kifizetések összege meghaladja a 17 milliárd forintot. Ebből 49 pályázó önként visszautalt 1,69 milliárd forintot, Tarr Zoltán miniszter pedig mintegy 400 millió forintot tartott vissza.',
      },
      {
        q: 'Mi volt a baj az NKA-pályázatokkal?',
        a: 'A vitatott támogatások nem a nyílt, szakmai kollégium által elbírált úton mentek ki, hanem egyedi, 447-es és 790-es kereten — ahol nem volt nyilvános kiírás és kollégiumi bírálat sem. Több nyertesnél hiányzott a konkrét programleírás, és érdemi kulturális tevékenység sem társult a pénzhez.',
      },
      {
        q: 'Hány embert tartóztattak le?',
        a: 'Eddig tizenegy embert helyeztek előzetes letartóztatásba, köztük 2026. október 1-jén Hankó Balázs volt kulturális minisztert; közülük kettő már szabadlábon van. A friss listát az NKA-letartóztatásokról szóló oldalunkon vezetjük.',
      },
      {
        q: 'Letartóztatták Fásy Ádámot?',
        a: 'Nem. Fásy Ádám ellen tudomásunk szerint nem folyik eljárás — a feleségét, Fásyné Gurzó Máriát és egy vele szerződő cég vezetőjét helyezte letartóztatásba a Kecskeméti Járásbíróság 2026. szeptember 9-én.',
      },
      {
        q: 'Honnan van az NKA pénze?',
        a: 'A Nemzeti Kulturális Alap az állam elkülönített pénzalapja: bevétele részben szerencsejáték-adóból és kulturális járulékból származik. Vagyis közpénz, amelyből kulturális programokat, kiadványokat és produkciókat támogatnak.',
      },
    ],
    sources: [
      { label: 'NKA: Pályázati tudnivalók (hivatalos eljárásrend)', url: 'https://nka.hu/kiemelt-kategoriak/palyaztatas/kollegiumok-felhivasai/palyazati-tudnivalok/' },
      { label: 'NAV.hu: Áttörés az NKA-ügyben — hat személyt vettek őrizetbe (jún. 23.)', url: 'https://nav.gov.hu/sajtoszoba/hirek/Attores_az_NKA-ugyben' },
      { label: 'Telex: 49 pályázó 1,69 milliárdot utalt vissza (máj. 23.)', url: 'https://telex.hu/belfold/2026/05/23/nka-palyazati-penzek-visszafizetes-kis-grofo-varosliget-zrt' },
      { label: 'Telex: NKA-botrány — letartóztatták Fásy Ádám feleségét (szept. 9.)', url: 'https://telex.hu/belfold/2026/09/09/nka-botrany-fasy-dokumentumfilm-letartoztatas-birosag' },
      { label: 'Telex: Radics Béla alapítványa visszafizetett 20 milliót (szept. 12.)', url: 'https://telex.hu/belfold/2026/09/12/radics-bela-fidesz-nka-palyazat-tamogatas-20-millio-visszafizetes-tradiciokert-alapitvany' },
      { label: '24.hu: Molnár Áron tiltott kampányfinanszírozásról beszélt (szept. 14.)', url: 'https://24.hu/belfold/2026/09/14/molnar-aron-tiltott-kampanyfinanszirozas-radics-bela/' },
      { label: 'Portfolio: Dagad az NKA-botrány, már Győrben is nyomoznak (jún. 16.)', url: 'https://www.portfolio.hu/gazdasag/20260616/dagad-az-nka-botrany-mar-gyorben-is-nyomoznak-843584' },
    ],
    internalLinks: [
      { label: 'NKA botrány — a teljes ügy idővonala', href: '/ugyek/nka-botrany', note: 'Hatósági közlemények, videók, napi frissítéssel.' },
      { label: 'Korrupciós adatbázis', href: '/adatbazis', note: 'Ügyenként dokumentált közpénz-érintettség és források.' },
      { label: 'Börtönben van-e már?', href: '/birosagi-iteletek', note: 'Minden NER-hez kapcsolható eljárás egy helyen.' },
    ],
  },
  {
    id: 'orban-aron-ausztria',
    parentId: 'aranykonvoj',
    seoTitle: 'Orbán Áron és az aranykonvoj: „El tudjátok kapni?” — az osztrák szál',
    seoDescription:
      'Orbán Áron márciusban azt kérdezte egy grazi üzletembertől, Ausztriában is el lehetne-e kapni egy ukrán pénzszállítmányt. Az aranykonvoj osztrák szála.',
    h1: 'Orbán Áron és az osztrák aranykonvoj: újabb ukrán pénzszállítmányt próbálhatott feltartóztatni Ausztriában',
    eyebrow: 'Aranykonvoj-ügy · osztrák szál',
    lead:
      'A 444 2026. október 1-jén arról számolt be, hogy Orbán Áron, Orbán Viktor öccse március 26-án egy Grazban élő magyar üzletembert keresett meg azzal, hogy Ausztriában is fel lehetne-e tartóztatni egy ukrán pénzszállítmányt. Az üzenetváltás néhány héttel azután történt, hogy a TEK március 5-én az M0-son megállított egy Ausztriából Ukrajna felé tartó szállítmányt, amely az ukrán Oschadbank mintegy 27 milliárd forint értékű aranyát és valutáját vitte.',
    publishedAt: '2026-10-01',
    updatedAt: '2026-10-01',
    promo: {
      eyebrow: 'Új fejlemény · osztrák szál',
      title: 'Orbán Áron Ausztriában is megkérdezte: el lehetne-e kapni egy ukrán szállítmányt?',
      lead:
        'A 444 megszerezte Orbán Áron márciusi üzenetváltását egy grazi üzletemberrel. Mit kérdezett, mit válaszolt a megkeresett üzletember, és mi köze mindennek a március 5-i TEK-akcióhoz.',
      cta: 'Elolvasom az osztrák szálat',
    },
    blocks: [
      {
        type: 'text',
        id: 'mit-ir-a-444',
        heading: 'Mit ír a 444 Orbán Áron márciusi üzenetváltásáról?',
        content:
          'A történet kulcsszereplője Lászlóvári-Thoma Csongor, Grazban élő, főleg vagyonkezeléssel foglalkozó magyar üzletember, akit Orbán Áron 2026. március 26-án, bő két héttel a magyarországi választások előtt keresett meg üzenetben. A 444 által ismertetett beszélgetés szerint Orbán Áron először arról érdeklődött, foglalkozik-e még politikával, majd azt kérdezte, mekkora befolyása van Ausztriában. Lászlóvári-Thoma 2021-ben az Osztrák Néppárt (ÖVP) listáján indult a grazi önkormányzati választáson, de mandátumot nem szerzett, és azt válaszolta, hogy az idei választáson már lemondott a jelölésről. Orbán Áron ezután egy, a magyarországi aranykonvoj-ügyről szóló ATV-videó linkjét küldte el, majd egy újabb ukrán szállítmányra utalt.',
      },
      {
        type: 'quote',
        text: 'Rajtatok keresztül megy egy szállitmány. El tudjatok kapni?',
        author: 'Orbán Áron üzenete Lászlóvári-Thoma Csongornak, 2026. március 26.',
        note: 'Az üzenet szövege a 444 közlése szerint, eredeti helyesírással.',
        url: 'https://444.hu/2026/10/01/rajtatok-keresztul-megy-egy-szallitmany-el-tudjatok-kapni-orban-aron-megprobalta-megszervezni-hogy-ausztriaban-is-kapjanak-el-egy-ukran-aranykonvojt',
      },
      {
        type: 'text',
        content:
          'A Telex összefoglalója szerint Orbán Áron azt is állította, hogy információi vannak arról, mikor érkezik az újabb szállítmány. A megkeresett üzletember hárította a felvetést, a beszélgetés egy ponton megszakadt. A 444 forrásai szerint kizárt, hogy Orbán Áronnak valós információi lehettek az ukrán pénzszállítások menetrendjéről.',
      },
      {
        type: 'article-card',
        source: '444',
        date: '2026. október 1.',
        headline: '„Rajtatok keresztül megy egy szállitmány. El tudjatok kapni?” – Orbán Áron megpróbálta megszervezni, hogy Ausztriában is kapjanak el egy ukrán aranykonvojt',
        lead: 'Március 26-án, bő két héttel a választások előtt Lászlóvári-Thoma Csongor grazi üzletember nem várt üzenetet kapott a miniszterelnök öccsétől. A 444 lépésről lépésre közli a beszélgetést.',
        url: 'https://444.hu/2026/10/01/rajtatok-keresztul-megy-egy-szallitmany-el-tudjatok-kapni-orban-aron-megprobalta-megszervezni-hogy-ausztriaban-is-kapjanak-el-egy-ukran-aranykonvojt',
      },
      {
        type: 'text',
        id: 'ki-az-uzletember',
        heading: 'Ki az a grazi üzletember, akit Orbán Áron megkeresett?',
        content:
          'A 444 szerint Lászlóvári-Thoma Csongort hat évvel korábban egy közös ismerős mutatta be Orbán Áronnak, amikor az üzletember új projektbe kezdett, Orbán Áron pedig érdeklődött az általa forgalmazott termékek iránt. Üzlet végül sem akkor, sem később nem lett belőle, a kapcsolatuk pedig évekre megszakadt. A Telex szerint érdemi politikai befolyása nem volt Ausztriában: politikai kapcsolatai a 2021-es, sikertelen grazi ÖVP-s jelöltségben merültek ki. Orbán Áronról a 444-nek azt mondta, hogy „eléggé naiv illető”, aki „egyfajta sétáló névjegyként kerül felhasználásra bizonyos érdekcsoportok által”. A megkeresést jelezte az osztrák titkosszolgálatoknak és a koalíciós kormányt vezető Néppártnak is — a pártnak azért, mert Orbán Áron a politikai kapcsolataira hivatkozva kereste meg.',
      },
      {
        type: 'article-card',
        source: 'Telex',
        date: '2026. október 1.',
        headline: 'Orbán öccse ráírt egy Ausztriában élő magyar üzletemberre, hogy el tudnának-e fogni egy újabb ukrán szállítmányt',
        lead: 'Az üzletember hárította a felvetést, majd az osztrák titkosszolgálatoknak és a Néppártnak is jelezte a megkeresést.',
        url: 'https://telex.hu/belfold/2026/10/01/orban-aron-aranykonvoj-ugy-ausztria',
      },
      {
        type: 'article-card',
        source: 'Portfolio',
        date: '2026. október 1.',
        headline: '„El tudjatok kapni?” – Orbán Áron állítólag Ausztriában is feltartóztatott volna egy ukrán konvojt',
        lead: 'A Portfolio összefoglalója a 444 által közölt üzenetváltásról.',
        url: 'https://www.portfolio.hu/gazdasag/20261001/el-tudjatok-kapni-orban-aron-allitolag-ausztriaban-is-feltartoztatott-volna-egy-ukran-konvojt-866562',
      },
      {
        type: 'text',
        id: 'marcius-5',
        heading: 'Mi köze ennek a március 5-i aranykonvoj-akcióhoz?',
        content:
          'Az előzmény a 2026. március 5-i rajtaütés: a TEK az M0-son megállított két pénzszállító autót, amelyek Bécsből Magyarországon át Ukrajnába vitték az ukrán Oschadbank mintegy 27 milliárd forint értékű aranyát és készpénzét. A hét ukrán pénzszállítót a TEK épületében kihallgatták, másnap kiutasították az országból, a vagyont lefoglalták. A hatóságok pénzmosás gyanújára hivatkoztak. Az ukrán felet képviselő jogászok mindvégig azt állították, hogy a szállítmány törvényes volt, minden szükséges dokumentummal rendelkezett, és Ausztriából, a Raiffeisen Banktól indult. A lefoglalt arany és készpénz két hónappal később, 2026. május 6-án Záhonyon át elhagyta az országot, a vagyont visszakapta az ukrán fél.',
      },
      {
        type: 'text',
        content:
          'A 444 később megszerezte a pénzszállítók tanúvallomásait is: ezekben részletesen leírták, mi történt velük, mit kérdeztek tőlük, és hogyan bántak velük a magyar hatóságok.',
      },
      {
        type: 'article-card',
        source: 'Telex',
        date: '2026. július 22.',
        headline: '„Leguggolt mellém valaki, és a fejemre térdelt” – a 444 megszerezte az aranykonvoj-ügy ukrán tanúvallomásait',
        lead: 'Az elfogott ukrán pénzszállítók vallomásai a március 5-i akcióról és a velük szembeni bánásmódról.',
        url: 'https://telex.hu/belfold/2026/07/22/aranykonvoj-ugy-ukran-penzszallito-kihallgatas-jegyzokonyv-orban-kormany-tek',
      },
      {
        type: 'text',
        id: 'most-derult-ki',
        heading: 'Két nappal korábban Fürcht Pál levele is nyilvánosságra került',
        content:
          'Az osztrák szál nem az egyetlen friss fejlemény: két nappal korábban, 2026. szeptember 29-én nyilvánosságra került Fürcht Pál volt főügyész nyílt levele, amely szerint a nyomozás akkori állása alapján 2026. március 3-án Orbán Viktor adta ki a feladatot a titkosszolgálatnak az ukrán pénzszállítók elfogására.',
        links: [{ text: 'Fürcht Pál volt főügyész nyílt levele', href: '/ugyek/aranykonvoj/furcht-pal' }],
      },
      {
        type: 'text',
        id: 'nyomozas',
        heading: 'Mit tudunk az aranykonvoj-ügy nyomozásáról?',
        content:
          'Fürcht Pál, a Központi Nyomozó Főügyészség júniusban lemondott vezetője az ügyvédje által nyilvánosságra hozott levelében azt írja: a nyomozás akkori állása szerint 2026. március 3-án maga Orbán Viktor miniszterelnök adta ki a feladatot a titkosszolgálatnak, hogy március 5-én fogják el az ukrán pénzszállítókat, és erről 2026 májusában a nyomozó ügyészektől értesült. Ez Fürcht Pál állítása, nem bírósági ténymegállapítás. Az állításai nyomán született feljelentések a Szegedi Regionális Nyomozó Ügyészséghez kerültek. Júniusban a 444 egy állítólagos ügyészségi dokumentumról is beszámolt, amely Orbán Viktort a lényegi döntéseket és utasításokat hozó személyek között nevezi meg; az ügyészség a nyomozásra hivatkozva érdemben nem válaszolt, de azt sem állította, hogy a dokumentum nem valódi.',
      },
      {
        type: 'video',
        id: 'O2KXCQMDqr0',
        label: 'Juhász Péter | Juhi · 2026. jún. 4.',
        title: 'ORBÁN rendelte meg az ARANYKONVOJ lerohanását?',
        summary:
          'Juhász Péter a Telex júniusi cikke alapján veszi végig, ki adhatott utasítást a konvoj lerohanására, miért a TEK vett részt az akcióban, és lehetett-e személyes szerepe Orbán Viktornak az elrendelésében. A videót eddig több mint 71 ezren nézték meg.',
      },
      {
        type: 'callout',
        heading: 'Mi dokumentált, és mi állítás?',
        content:
          'A március 5-i magyarországi akció megtörtént, dokumentált esemény. Az osztrák szál ezzel szemben egy újabb szállítmány feltartóztatásának felvetéséről szól, amelyet a 444 által bemutatott üzenetváltásból és Lászlóvári-Thoma Csongor beszámolójából ismerünk. Ausztriában végrehajtott hatósági akcióról nincs információ, a megkeresett üzletember nem vállalta a közreműködést.',
      },
      {
        type: 'text',
        id: 'vizumbiznisz',
        heading: 'Orbán Áron neve más ügyben is előkerült',
        content:
          'A Telex szerint Orbán Áronnak valószínűleg semmi szerepe nem volt az aranykonvoj-ügyben, egy másik ügyben viszont igen. A Nemzeti Vagyonvisszaszerzési és Vagyonvédelmi Hivatal (NVVH) 2026. szeptember 28-án jelentette be, hogy az ügyészségtől magához vonja az Orbán Áronék vízumbizniszével kapcsolatos nyomozást, amelyet a Telex 2025 májusában tárt fel. Az NVVH összefoglalója szerint a gyanú az, hogy „vezető politikai szereplőkhöz szorosan köthető csoport anyagi ellenszolgáltatásért cserében azt vállalta, hogy akik rajtuk keresztül intézik a munkavállalási célú tartózkodási engedélyek kiváltását, mindenképp megkapják a szükséges vízumokat”. Az ügyben a Fidesz bukása után letartóztattak két férfit, Orbán Áron üzleti társait; Orbán Áront a Telex szerint az eljárás eddig nem érintette.',
      },
      {
        type: 'article-card',
        source: 'Telex',
        date: '2026. szeptember 28.',
        headline: 'Orbán Áronék vízumbiznisze az első, amit az NVVH az ügyészségtől magához rendelt',
        lead: 'Az új vagyonvisszaszerzési hivatal első ügyei között szerepel a munkavállalási vízumok közvetítése, amelyet a Telex tárt fel 2025-ben.',
        url: 'https://telex.hu/belfold/2026/09/28/orban-aronek-vizumbizniszne-az-elso-amit-az-nvvh-az-ugyeszsegtol-magahoz-rendelt',
      },
      {
        type: 'text',
        id: 'nyitott-kerdesek',
        heading: 'Mire nem ad választ az üzenetváltás?',
        content:
          'Hogy Orbán Áron pontosan milyen információ alapján kereste meg Lászlóvári-Thoma Csongort, honnan származhatott az állítólagos újabb szállítmányról szóló értesülése, és volt-e bármilyen valós lehetőség az osztrák hatóságok befolyásolására, arra a nyilvánosságra került üzenetek önmagukban nem válaszolnak. Dokumentált viszont, hogy az üzenetváltás megtörtént, és hogy a megkeresett üzletember később az osztrák titkosszolgálatoknak is jelezte a történteket.',
      },
    ],
    faq: [
      {
        q: 'Mit kérdezett Orbán Áron az osztrák üzletembertől?',
        a: 'A 444 szerint 2026. március 26-án először azt, mekkora befolyása van Ausztriában, majd ezt írta: „Rajtatok keresztül megy egy szállitmány. El tudjatok kapni?” — vagyis hogy Ausztriában is fel lehetne-e tartóztatni egy újabb ukrán pénzszállítmányt.',
      },
      {
        q: 'Ki az a Lászlóvári-Thoma Csongor?',
        a: 'Grazban élő, főleg vagyonkezeléssel foglalkozó magyar üzletember, aki 2021-ben az Osztrák Néppárt listáján indult a grazi önkormányzati választáson, de mandátumot nem szerzett. Orbán Áronnak hat évvel korábban egy közös ismerős mutatta be.',
      },
      {
        q: 'Feltartóztattak Ausztriában ukrán pénzszállítmányt?',
        a: 'Erről nincs információ. A megkeresett üzletember nem vállalta a közreműködést, a beszélgetés megszakadt, a megkeresést pedig jelezte az osztrák titkosszolgálatoknak és az Osztrák Néppártnak.',
      },
      {
        q: 'Mi lett a március 5-én lefoglalt 27 milliárdos szállítmánnyal?',
        a: 'A lefoglalt arany és készpénz 2026. május 6-án Záhonyon át elhagyta az országot, a vagyont visszakapta az ukrán fél.',
      },
      {
        q: 'Ki adta ki az utasítást az aranykonvoj elfogására?',
        a: 'Fürcht Pál volt főügyész levele szerint a nyomozás akkori állása alapján Orbán Viktor adta ki a feladatot a titkosszolgálatnak 2026. március 3-án. Ez állítás, nem bírósági ténymegállapítás; a nyomán született feljelentések a Szegedi Regionális Nyomozó Ügyészséghez kerültek.',
      },
    ],
    sources: [
      { label: '444: „Rajtatok keresztül megy egy szállitmány. El tudjatok kapni?” (okt. 1.)', url: 'https://444.hu/2026/10/01/rajtatok-keresztul-megy-egy-szallitmany-el-tudjatok-kapni-orban-aron-megprobalta-megszervezni-hogy-ausztriaban-is-kapjanak-el-egy-ukran-aranykonvojt' },
      { label: 'Telex: Orbán öccse ráírt egy Ausztriában élő magyar üzletemberre (okt. 1.)', url: 'https://telex.hu/belfold/2026/10/01/orban-aron-aranykonvoj-ugy-ausztria' },
      { label: 'Portfolio: Orbán Áron állítólag Ausztriában is feltartóztatott volna egy ukrán konvojt (okt. 1.)', url: 'https://www.portfolio.hu/gazdasag/20261001/el-tudjatok-kapni-orban-aron-allitolag-ausztriaban-is-feltartoztatott-volna-egy-ukran-konvojt-866562' },
      { label: '444: Videón, ahogy 27 milliárd forintnyi arany és bankjegyek elhagyják az országot (máj. 6.)', url: 'https://444.hu/2026/05/06/videon-ahogy-27-milliard-forintnyi-arany-es-bankjegyek-elhagyjak-az-orszagot' },
      { label: 'Telex: A 444 megszerezte az aranykonvoj-ügy ukrán tanúvallomásait (júl. 22.)', url: 'https://telex.hu/belfold/2026/07/22/aranykonvoj-ugy-ukran-penzszallito-kihallgatas-jegyzokonyv-orban-kormany-tek' },
      { label: 'Telex: Döntéshozóként nevezi meg Orbán Viktort egy állítólagos ügyészségi dokumentum (jún. 25.)', url: 'https://telex.hu/belfold/2026/06/25/aranykonvoj-444-orban-viktor-ugyeszsegi-dokumentum' },
      { label: '444: A Fürcht Pál állításai alapján született feljelentések Szegedre kerültek (szept. 28.)', url: 'https://444.hu/2026/09/28/a-furcht-pal-volt-fougyesz-allitasai-alapjan-szuletett-feljelentesek-a-szegedi-regionalis-nyomozo-ugyeszseghez-kerultek' },
      { label: 'Telex: Fürcht Pál szerint Orbán Viktor adta ki az utasítást az ukrán pénzszállítók elfogására (szept. 29.)', url: 'https://telex.hu/belfold/2026/09/29/furcht-pal-aranykonvoj-ugy-orban-viktor-utasitas-fidesz-reakcio' },
      { label: 'Telex: Orbán Áronék vízumbiznisze az első, amit az NVVH magához rendelt (szept. 28.)', url: 'https://telex.hu/belfold/2026/09/28/orban-aronek-vizumbizniszne-az-elso-amit-az-nvvh-az-ugyeszsegtol-magahoz-rendelt' },
    ],
    crossPromoAfterBlockId: 'most-derult-ki',
    internalLinks: [
      { label: 'Aranykonvoj-ügy — a teljes ügy', href: '/ugyek/aranykonvoj', note: 'A március 5-i akció, a nyomozás és a hatósági közlemények egy helyen.' },
      { label: 'Fürcht Pál levele: Orbán Viktor rendelte el az elfogást', href: '/ugyek/aranykonvoj/furcht-pal', note: 'Két nappal korábban derült ki: a volt főügyész név szerint nevezte meg a volt miniszterelnököt.' },
      { label: 'Juhász Péter a Dicsőségfalon', href: '/rendszervaltas/juhasz-peter', note: 'A NER100 sorozat készítője, akinek a videója fent is szerepel.' },
      { label: 'Kiemelt ügyek', href: '/ugyek', note: 'A Kegyencjárat összes kiemelt ügye.' },
    ],
  },
  {
    id: 'furcht-pal',
    parentId: 'aranykonvoj',
    seoTitle: 'Fürcht Pál: Orbán Viktor rendelte el az aranykonvoj elfogását',
    seoDescription:
      'Fürcht Pál volt főügyész nyílt levele szerint 2026. március 3-án Orbán Viktor adta ki a feladatot a titkosszolgálatnak az ukrán pénzszállítók elfogására.',
    h1: 'Fürcht Pál szerint Orbán Viktor rendelte el az aranykonvoj elfogását',
    eyebrow: 'Aranykonvoj-ügy · Fürcht Pál levele',
    lead:
      'Fürcht Pál, a Központi Nyomozó Főügyészség júniusban lemondott vezetője 2026. szeptember 29-én nyilvánosságra hozott nyílt levelében azt írta: a nyomozás akkori állása szerint március 3-án Orbán Viktor miniszterelnök adta ki a feladatot a titkosszolgálatnak, hogy két nappal később fogják el az Ukrajnába tartó ukrán pénzszállítókat. Ez Fürcht Pál állítása, nem bírósági ténymegállapítás; a nyomán született feljelentések a Szegedi Regionális Nyomozó Ügyészséghez kerültek.',
    publishedAt: '2026-10-01',
    updatedAt: '2026-10-01',
    heroImage: {
      src: '/images/persons/orban.webp',
      alt: 'Orbán Viktor volt miniszterelnök, akit Fürcht Pál volt főügyész nyílt levele az aranykonvoj elfogásának elrendelőjeként nevez meg',
      credit: 'Eredeti fotó: Orbán Viktor Facebook oldala',
    },
    promo: {
      eyebrow: 'Új fejlemény · Fürcht Pál levele',
      title: 'Fürcht Pál: március 3-án Orbán Viktor adta ki a feladatot az aranykonvoj elfogására',
      lead:
        'A Központi Nyomozó Főügyészség volt vezetője nyílt levelében név szerint nevezte meg a volt miniszterelnököt. Mit állít pontosan, mi dokumentált belőle, és hol tart a feljelentések sorsa.',
      cta: 'Elolvasom Fürcht Pál állításait',
    },
    blocks: [
      {
        type: 'text',
        id: 'mit-allit',
        heading: 'Mit írt Fürcht Pál a nyílt levelében?',
        content:
          'A levelet Fürcht Pál ügyvédje, Horváth Lóránt hozta nyilvánosságra 2026. szeptember 29-én; Horváth az ukrán pénzszállítókat is képviseli, és Fürchtöt a vele szemben szeptember elején indult fegyelmi eljárásban. A levél szerint a Fővárosi Nyomozó Ügyészség tapasztalt ügyészei 2026 májusában az addig beszerzett bizonyítékok alapján arra a következtetésre jutottak, hogy az aranykonvoj-ügy „egy politika által kreált ügy”. Fürcht ezt főügyészként jelentette az akkori legfőbb ügyésznek, a legfőbb ügyész helyettesének és két legfőbb ügyészségi főosztályvezetőnek. A levél a nyomozás akkori állására hivatkozik, a mögötte lévő bizonyítékokat nem közli.',
      },
      {
        type: 'quote',
        text: 'A nyomozás akkori állása szerint látható volt, hogy 2026. március 3. napján maga Orbán Viktor miniszterelnök adta ki a feladatot a titkosszolgálatnak, hogy 2026. március 5. napján az ukrán pénzszállítókat fogják el.',
        author: 'Fürcht Pál, a Központi Nyomozó Főügyészség volt vezetője, nyílt levél, 2026. szeptember 29.',
        url: 'https://telex.hu/belfold/2026/09/29/furcht-pal-aranykonvoj-ugy-orban-viktor-utasitas-fidesz-reakcio',
      },
      {
        type: 'text',
        id: 'dontesi-lanc',
        heading: 'Március 3., 4., 5. — Fürcht szerint így követte egymást a döntési lánc',
        content:
          'Fürcht levele szerint március 3-án Orbán Viktor kiadta a feladatot a titkosszolgálatnak. Március 4-én a titkosszolgálat „a politika által meghatározott feladatot végezve” egyeztetett egy legfőbb ügyészségi főosztályvezetővel és magával a legfőbb ügyésszel is. Március 5-én a titkosszolgálat feljelentése — a legfőbb ügyész, a helyettese és egy másik főosztályvezető ügyész közreműködésével — a törvényben biztosított három nap helyett mintegy négy-öt órán belül ott volt a nyomozó hatóságnál, azzal az ügyészi utasítással, hogy a nyomozást el kell rendelni. Fürcht szerint az átirat még így is majdnem elkésett, mert az akció akkor már javában zajlott: ha a Legfőbb Ügyészség vezetése csak fél nappal később küldi meg az utasítást, az ukrán pénzszállítók hazaérhettek volna.',
      },
      {
        type: 'article-card',
        source: 'Telex',
        date: '2026. szeptember 29.',
        headline: 'Fürcht Pál szerint májusban értesült a nyomozóktól, hogy Orbán Viktor adta ki az utasítást az ukrán pénzszállítók elfogására, a Fidesz is reagált az ügyre',
        lead: 'A volt főügyész nyílt levele a márciusi döntési láncról, a májusi következtetésről és a legfőbbügyész-jelölésről.',
        url: 'https://telex.hu/belfold/2026/09/29/furcht-pal-aranykonvoj-ugy-orban-viktor-utasitas-fidesz-reakcio',
      },
      {
        type: 'video',
        id: 'l5bYqtM7WyE',
        label: 'ATV Magyarország · 2026. szept. 30.',
        title: 'Fürcht: Orbán adott utasítást | Rogán szerint ártatlanok az exminiszterek | PROVOKATŐR',
        summary:
          'Az ATV Provokatőr című műsorában Boros Tamás, Dévényi István és Fekete-Győr András beszél Fürcht Pál nyílt leveléről, amely név szerint nevezi meg Orbán Viktort az akció elrendelőjeként.',
      },
      {
        type: 'text',
        id: 'reakciok',
        heading: 'Mit mondanak az érintettek?',
        content:
          'A Fidesz közleményben reagált a levélre: szerintük „az ukrán maffia gátlástalanul és óriási mennyiségben szállította a pénzeit Magyarországon keresztül”, és a hatóságok az Orbán-kormány idején ennek vetettek véget, ezért „elismerést érdemelnek, és nem vádaskodást”. A Legfőbb Ügyészség Fürcht korábbi, a lemondásában tett állításairól azt közölte, hogy azok tényszerűen valótlanok, és a volt főügyész saját, a tényektől független meggyőződését próbálta érvényesíteni. Fürcht az ATV-ben azt mondta, ezt akkor tudná elfogadni, ha az általa jelzett körülményeket előzőleg kivizsgálták volna. Azt is hangsúlyozta, hogy közvetlen politikai nyomásgyakorlást nem állított: megfogalmazása szerint „a politikának volt egy elvárása”, amelyet egy szervezet közvetített az ügyészség felé.',
      },
      {
        type: 'text',
        id: 'marcius-5',
        heading: 'Mi történt az aranykonvojjal március 5-én?',
        content:
          'Március 5-én egy rendőrautó az M0-s autóút alacskai pihenőhelyénél félreállította az ukrán Oschadbank két, Ausztriából, a Raiffeisen Banktól Ukrajna felé tartó pénzszállító furgonját, ahol már a TEK kommandósai várták őket. A furgonokban talált, több mint 27 milliárd forintnyi készpénzt és befektetési aranyat a NAV lefoglalta, a hét ukrán pénzszállítót órákkal később elengedték és kiutasították az országból. A Telex júniusi feltárása szerint a rajtaütés előtti napon az Alkotmányvédelmi Hivatal tett feljelentést, ezt az AH a lap megkeresésére el is ismerte, és azt is megerősítette, hogy a feljelentést az Információs Hivatal által gyűjtött adatokra alapozta. Az ukrán fél, az Oschadbank és a pénzt küldő Raiffeisen szerint a szállítmány a megfelelő engedélyek birtokában tartott Ausztriából Ukrajnába. Augusztusban a NAV bűncselekmény hiányában megszüntette az ukrán pénzszállítók elleni nyomozást.',
      },
      {
        type: 'text',
        id: 'telex-junius',
        heading: 'Nem ez volt az első forrás, amely Orbán Viktor döntéséről írt',
        content:
          'A Telex már 2026. június 3-án arról számolt be, hogy a kormányzat, azon belül is Orbán Viktor döntött arról, hogy március 5-én le kell csapni az ukrán pénzszállítókra, és még a rajtaütés időpontja is a kormányzattól jött. A lap ezt az ügyre rálátó vagy abban érintett forrásokkal folytatott háttérbeszélgetésekre alapozta. A szeptember 29-i levélben ehhez képest egy volt vezető ügyész nevezi meg név szerint Orbán Viktort, a nyomozás akkori állására hivatkozva.',
      },
      {
        type: 'article-card',
        source: 'Telex',
        date: '2026. június 3.',
        headline: 'Orbán döntött arról, hogy le kell csapni az ukrán „aranykonvojra”, még a rajtaütés időpontja is a kormányzattól jött',
        lead: 'Háttérbeszélgetések alapján: a rajtaütést szakmailag semmi sem indokolta, a feljelentést az Alkotmányvédelmi Hivatal tette az Információs Hivatal adataira építve.',
        url: 'https://telex.hu/belfold/2026/06/03/aranykonvoj-ukrajna-nav-titkosszolgalat-orban-kormany-tek',
      },
      {
        type: 'text',
        id: 'most-derult-ki',
        heading: 'Ugyanezen a héten az osztrák szál is kiderült',
        content:
          'Két nappal Fürcht levele után, október 1-jén egy másik új részlet is nyilvánosságra került: a 444 szerint Orbán Áron, Orbán Viktor öccse 2026. március 26-án egy grazi üzletembert kérdezett meg arról, Ausztriában is el lehetne-e kapni egy újabb ukrán pénzszállítmányt.',
        links: [{ text: 'Orbán Áron, Orbán Viktor öccse 2026. március 26-án egy grazi üzletembert kérdezett meg', href: '/ugyek/aranykonvoj/orban-aron-ausztria' }],
      },
      {
        type: 'text',
        id: 'majus-8',
        heading: 'Fürcht szerint már májusban felmerült, hogy kreált ügyről lehet szó',
        content:
          'Fürcht Pál szeptember 21-én az ATV Egyenes beszéd című műsorában beszélt arról, hogy május 8-án egyik kollégája egy közérdeklődésre számot tartó ügyben olyan körülményeket észlelt, amelyek alapján felmerült, hogy „kreált ügyről” lehet szó. Fürcht nem a nyilvánossághoz fordult, hanem a szolgálati utat követve jelentést tett a Legfőbb Ügyészség vezetésének. Elmondása szerint ezután felrendelték, és egy vezető ügyész közölte vele, „ki ellen lehet nyomozni”, kiket nem lehet kihallgatni, és milyen irányban kell folytatni a nyomozást; az érintett vezetőt nem nevezte meg. Azt is elmondta, hogy egy legfőbb ügyészségi vezető írásos nyom nélküli „instrukciókat” adott — ezt az állítását, saját bevallása szerint, nem tudja bizonyítani. Az interjúban még nem nevezte meg Orbán Viktort; ezt a szeptember 29-i levélben tette meg.',
      },
      {
        type: 'article-card',
        source: 'ATV',
        date: '2026. szeptember 21.',
        headline: '„Egy vezető ügyész megmondta, ki ellen lehet nyomozni és kit nem lehet kihallgatni” – Megszólalt Fürcht Pál az Egyenes beszédben',
        lead: 'A lemondott főügyész távozásának körülményeiről, a május 8-i jelzésről és a vele szemben indult fegyelmi eljárásról.',
        url: 'https://www.atv.hu/belfold/20260921/vezeto-ugyesz-megmondta/',
      },
      {
        type: 'text',
        id: 'lemondas',
        heading: 'Fürcht Pál júniusban lemondott a KNYF vezetéséről',
        content:
          'Fürcht Pál 2026. június 8-án mondott le a Központi Nyomozó Főügyészség vezetéséről. Hétoldalas lemondó levelében azt állította, hogy a Legfőbb Ügyészség több politikailag érzékeny ügy — köztük az aranykonvoj- és a Gundalf-ügy — nyomozását befolyásolta, a lemondását pedig elsősorban az aranykonvoj-ügyben a felügyeletet ellátó legfőbb ügyészségi szakfőosztállyal kialakult szakmai nézetkülönbségekkel indokolta. Szeptember elején fegyelmi eljárás indult ellene.',
      },
      {
        type: 'text',
        id: 'feljelentesek',
        heading: 'Feljelentések is születtek Fürcht állításai nyomán',
        content:
          'Szeptemberben az ukrán pénzszállítókat képviselő Horváth Lóránt ügyvédi irodája ismeretlen tettes ellen feljelentést tett hatóság félrevezetése, hamis vád és bűnpártolás minősített esete miatt. A feljelentés alapja Fürcht ATV-nyilatkozata és a fegyelmi eljárásban tett írásos vallomása volt; az iroda Fürcht tanúkénti meghallgatását is indítványozta. Szeptember 28-án derült ki, hogy az aranykonvoj- és a Gundalf-ügyben tett, illetve a Fürcht állításaira alapított feljelentések a Szegedi Regionális Nyomozó Ügyészséghez kerültek.',
      },
      {
        type: 'article-card',
        source: '444',
        date: '2026. szeptember 28.',
        headline: 'A Fürcht Pál volt főügyész állításai alapján született feljelentések a Szegedi Regionális Nyomozó Ügyészséghez kerültek',
        lead: 'Az aranykonvoj- és a Gundalf-ügyben tett, valamint a Fürcht állításaira alapított feljelentéseket Szegeden bírálják el.',
        url: 'https://444.hu/2026/09/28/a-furcht-pal-volt-fougyesz-allitasai-alapjan-szuletett-feljelentesek-a-szegedi-regionalis-nyomozo-ugyeszseghez-kerultek',
      },
      {
        type: 'text',
        id: 'majusi-bizonyitekok',
        heading: 'Mit állít Fürcht a májusi bizonyítékokról?',
        content:
          'Fürcht levele szerint a Fővárosi Nyomozó Ügyészség munkatársai májusra annyi bizonyítékot gyűjtöttek össze, hogy arra jutottak: az aranykonvoj-ügyet politikai célból hozták létre. Fürcht ezt jelentette a Legfőbb Ügyészség vezetőinek. Az ATV-ben azt is elmondta, hogy az ügyben tanúként akarták kihallgatni, de ezt szerinte nem engedélyezték a Fővárosi Nyomozó Ügyészség számára. A konkrét bizonyítékok jelentős része nem nyilvános.',
      },
      {
        type: 'video',
        id: 'LB6ULRRg86Q',
        label: 'ATV Magyarország · 2026. szept. 29.',
        title: 'Súlyos állítások Aranykonvoj-ügyben: „Az ügyészség már májusba látta, hogy Orbán Viktor érintett”',
        summary:
          'Az Egyenes Beszédben Rónai Egon Fürcht Pál védőjét, Horváth Lóránt ügyvédet kérdezi arról, mire jutottak a Fővárosi Nyomozó Ügyészség munkatársai 2026 májusában. A videót eddig közel 140 ezren nézték meg.',
      },
      {
        type: 'callout',
        heading: 'Mi dokumentált, és mi állítás?',
        content:
          'Dokumentált esemény, hogy március 5-én a magyar hatóságok feltartóztatták az ukrán pénzszállítókat, és lefoglalták a szállítmányt. Arról, hogy ki döntött az akcióról, Fürcht Pál azt állítja, hogy Orbán Viktor adott utasítást március 3-án; korábban a Telex is arról írt, hogy a döntés kormányzati szintről érkezett. Orbán Viktor büntetőjogi felelősségéről nincs bírósági döntés, és Fürcht állításának bizonyítékai nem kerültek teljes körűen nyilvánosságra.',
      },
      {
        type: 'text',
        id: 'hol-tart',
        heading: 'Hol tart most az ügy?',
        content:
          'A Fürcht Pál állításai alapján tett feljelentéseket a Szegedi Regionális Nyomozó Ügyészség bírálja el. A következő lényeges kérdés, hogy a volt főügyész által hivatkozott bizonyítékok és információk megismerhetők, ellenőrizhetők és büntetőeljárásban is felhasználhatók-e — ehhez kapcsolódik Fürcht tanúkénti meghallgatásának indítványa is.',
      },
    ],
    faq: [
      {
        q: 'Mit állít Fürcht Pál az aranykonvoj-ügyről?',
        a: 'A 2026. szeptember 29-én nyilvánosságra hozott levele szerint a nyomozás akkori állása alapján 2026. március 3-án Orbán Viktor adta ki a feladatot a titkosszolgálatnak, hogy március 5-én fogják el az ukrán pénzszállítókat. Ez az ő állítása, nem bírósági ténymegállapítás.',
      },
      {
        q: 'Ki az a Fürcht Pál?',
        a: 'A Központi Nyomozó Főügyészség vezetője volt 2026. június 8-i lemondásáig. Lemondását elsősorban az aranykonvoj-ügyben a Legfőbb Ügyészséggel kialakult szakmai nézetkülönbségekkel indokolta; szeptember elején fegyelmi eljárás indult ellene.',
      },
      {
        q: 'Mit válaszolt a Legfőbb Ügyészség?',
        a: 'Fürcht lemondásban tett állításairól azt közölte, hogy azok tényszerűen valótlanok. A Fidesz a szeptember 29-i levélre közleményben reagált, szerintük a hatóságok az akcióért „elismerést érdemelnek, és nem vádaskodást”.',
      },
      {
        q: 'Hol tartanak a Fürcht állításai alapján tett feljelentések?',
        a: '2026. szeptember 28-án derült ki, hogy a Szegedi Regionális Nyomozó Ügyészséghez kerültek. Az ukrán pénzszállítók ügyvédje Fürcht tanúkénti meghallgatását is indítványozta.',
      },
      {
        q: 'Mi történt március 5-én?',
        a: 'Az M0-s alacskai pihenőhelyénél a TEK feltartóztatta az ukrán Oschadbank két, Ausztriából Ukrajnába tartó pénzszállító furgonját, és a hatóságok lefoglalták a bennük lévő, több mint 27 milliárd forintnyi készpénzt és aranyat. A vagyon 2026. május 6-án hagyta el az országot.',
      },
    ],
    sources: [
      { label: 'Telex: Fürcht Pál szerint Orbán Viktor adta ki az utasítást az ukrán pénzszállítók elfogására (szept. 29.)', url: 'https://telex.hu/belfold/2026/09/29/furcht-pal-aranykonvoj-ugy-orban-viktor-utasitas-fidesz-reakcio' },
      { label: 'ATV: Megszólalt Fürcht Pál az Egyenes beszédben (szept. 21.)', url: 'https://www.atv.hu/belfold/20260921/vezeto-ugyesz-megmondta/' },
      { label: '444: A Fürcht Pál állításai alapján született feljelentések Szegedre kerültek (szept. 28.)', url: 'https://444.hu/2026/09/28/a-furcht-pal-volt-fougyesz-allitasai-alapjan-szuletett-feljelentesek-a-szegedi-regionalis-nyomozo-ugyeszseghez-kerultek' },
      { label: 'Telex: Orbán döntött arról, hogy le kell csapni az ukrán „aranykonvojra” (jún. 3.)', url: 'https://telex.hu/belfold/2026/06/03/aranykonvoj-ukrajna-nav-titkosszolgalat-orban-kormany-tek' },
      { label: 'Telex: Döntéshozóként nevezi meg Orbán Viktort egy állítólagos ügyészségi dokumentum (jún. 25.)', url: 'https://telex.hu/belfold/2026/06/25/aranykonvoj-444-orban-viktor-ugyeszsegi-dokumentum' },
    ],
    crossPromoAfterBlockId: 'most-derult-ki',
    internalLinks: [
      { label: 'Aranykonvoj-ügy — a teljes ügy', href: '/ugyek/aranykonvoj', note: 'A március 5-i akció, a nyomozás és a hatósági közlemények egy helyen.' },
      { label: 'Orbán Áron és az osztrák szál', href: '/ugyek/aranykonvoj/orban-aron-ausztria', note: 'Ugyanezen a héten derült ki: Ausztriában is felmerült egy ukrán szállítmány elfogása.' },
      { label: 'Kiemelt ügyek', href: '/ugyek', note: 'A Kegyencjárat összes kiemelt ügye.' },
    ],
  },
];

/** Éles buildben a vázlatok nem léteznek — sem oldalként, sem promóként,
 *  sem a sitemapben. Fejlesztésben (localhost) viszont igen. */
export function visibleSubpages(): UgySubpage[] {
  const showDrafts = process.env.NODE_ENV !== 'production';
  return UGY_SUBPAGES.filter((s) => showDrafts || !s.draft);
}

export function getSubpage(parentId: string, id: string): UgySubpage | undefined {
  return visibleSubpages().find((s) => s.parentId === parentId && s.id === id);
}

export function getSubpagesForUgy(parentId: string): UgySubpage[] {
  return visibleSubpages().filter((s) => s.parentId === parentId);
}
