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
  | { type: 'video'; id: string; label?: string; title: string; summary?: string };

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
};

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
        a: 'Felelősséget jogerős bírósági ítélet állapíthat meg, ilyen eddig nem született. A NAV hűtlen kezelés bűntettének gyanújával nyomoz, az ügyben hét embert helyeztek letartóztatásba, a vitatott kifizetések pedig Hankó Balázs volt kulturális miniszter keretéből indultak.',
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
      'Az első NKA letartóztatás 2026. június 23-án történt, amikor a NAV hat embert vett őrizetbe. Azóta az NKA-botrányban hét ember került előzetes letartóztatásba, közülük kettőt már szabadlábra helyeztek. Az alábbi lista az adatbázisunkból frissül: amint egy újabb NKA letartóztatás nyilvánossá válik, automatikusan megjelenik itt is.',
    publishedAt: '2026-09-15',
    updatedAt: '2026-09-15',
    heroImage: {
      src: '/images/persons/bus-balazs.webp',
      alt: 'Bús Balázs, az NKA volt alelnöke, az NKA-botrány egyik letartóztatottja',
      credit: 'Eredeti fotó: obuda.hu',
    },
    promo: {
      eyebrow: 'Háttér · NKA-letartóztatások',
      title: 'Ki ül most az NKA-botrány miatt? Nézd meg a teljes listát',
      lead:
        'Napra kész lista arról, kit tartóztattak le eddig az NKA-ügyben, ki van még előzetesben, és kit engedtek szabadon. Mellette az is, mi a gyanú ellenük, melyik bíróság döntött, és honnan tudjuk. Az adatbázisunkból frissül, tehát mindig a friss állapotot látod.',
      cta: 'Megnézem a letartóztatottakat',
    },
    blocks: [
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
          'A nyomozás 2026 őszén is zajlik, és földrajzilag is terjed: Budapest mellett Győrben is eljárás indult, ahol négy helyi kulturális szervezet kapott aránytalanul nagy összegeket úgy, hogy érdemi tevékenységet nem folytattak, és a bejegyzési dátumuk is közös volt. A gyanúsítotti kör kilenc fő fölé bővült, a vizsgált kifizetések összege pedig meghaladja a 17 milliárd forintot. Mivel az ügy a támogatások végső felhasználói felé halad — ezt mutatja a szeptemberi, dokumentumfilmes szál —, további NKA letartóztatás reálisan várható. A politikai felelősség kérdése külön szálon fut: Hankó Balázs volt kulturális miniszter ellen nem folyik eljárás, miközben a vitatott kifizetések az ő miniszteri keretéből indultak, és a mentelmi jogának kikérését többen is sürgetik. Ez az oldal a hatósági közleményeket és a dokumentált sajtóértesüléseket követi, és minden újabb kényszerintézkedéssel frissül.',
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
        a: 'Eddig hét embert helyeztek előzetes letartóztatásba: hatot a 2026. június 23-i NAV-akció után, egyet júliusban. Közülük kettő már szabadlábon van, a többiek ellen az eljárás folyamatban van. A fenti lista mindig a friss állapotot mutatja.',
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
        q: 'Miért nem tartóztatták le Hankó Balázst?',
        a: 'Hankó Balázs volt kulturális miniszter ellen tudomásunk szerint nem indult eljárás, noha a vitatott kifizetések jelentős része az ő 447-es miniszteri keretéből indult. A mentelmi jogának kikérését többen nyilvánosan is sürgették.',
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
    internalLinks: [
      { label: 'Börtönben van-e már?', href: '/birosagi-iteletek', note: 'Az összes NER-hez kapcsolható eljárás — nem csak az NKA-ügy — ugyanebből az adatbázisból.' },
      { label: 'NKA pályázatok — hogyan működött a rendszer', href: '/ugyek/nka-botrany/nka-palyazatok', note: 'A 447-es és 790-es keret, és hogy min csúszott el az egész.' },
      { label: 'NKA botrány — a teljes ügy idővonala', href: '/ugyek/nka-botrany', note: 'Hatósági közlemények, videók, napi frissítéssel.' },
      { label: 'Lemondások és felmentések', href: '/lemondasok', note: 'Bús Balázs, Báán László és Vidnyánszky Attila NKA-s pozíciójának sorsa.' },
    ],
  },
];

export function getSubpage(parentId: string, id: string): UgySubpage | undefined {
  return UGY_SUBPAGES.find((s) => s.parentId === parentId && s.id === id);
}

export function getSubpagesForUgy(parentId: string): UgySubpage[] {
  return UGY_SUBPAGES.filter((s) => s.parentId === parentId);
}
