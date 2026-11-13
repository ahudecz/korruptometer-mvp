/**
 * „Börtönben van-e?” — személyenkénti aloldalak a letartóztatottaknak
 * (/birosagi-iteletek/<slug>). 2026-11-13, user kérés: a /galeria/<id>
 * profilok mintájára, de az oldal arról szól, MIÉRT tartóztatták le az
 * illetőt, mivel gyanúsítják, és mi történt azóta.
 *
 * Szabályok:
 *  - Minden állítás a mellette lévő keretes cikkekből jön (forrásban nem
 *    igazolt adat nem kerülhet be, l. feedback-no-invented-data).
 *  - Eljárási szakaszok szigorúan külön: gyanúsítás ≠ vádemelés ≠ ítélet;
 *    őrizet (max. 72 óra) ≠ letartóztatás (l. feedback-interrogation-not-detention).
 *  - Nincs szerkesztőségi álláspont, csak leíró megfogalmazás
 *    (l. feedback-no-editorial-stance).
 *  - Videó-`label` mindig „Csatorna · dátum”, mérve (feedback-youtube-embed-rules).
 *  - A státusz-sor (`verdictPersonName`) a CourtVerdict táblából jön, nem
 *    kézzel írt — így a „Börtönben van-e?” lista és az aloldal nem csúszhat szét.
 */

export type DetaineeArticle = { source: string; date: string; headline: string; lead?: string; url: string };
export type DetaineeVideo = { id: string; label: string; title: string; summary: string };

export type DetaineeBlock =
  | { type: 'text'; heading?: string; paragraphs: string[] }
  | { type: 'articles'; items: DetaineeArticle[] }
  | { type: 'video'; video: DetaineeVideo }
  | { type: 'quote'; text: string; attribution: string; url: string }
  | { type: 'related-ugy' };

export type DetaineeSection = { id: string; title: string; blocks: DetaineeBlock[] };

export interface DetaineeProfile {
  slug: string;
  name: string;
  /** A CourtVerdict.personName pontos alakja — innen jön a „Börtönben van-e?”
   *  listából ide mutató link. */
  verdictPersonName: string;
  subtitle: string;
  photo: string;
  photoAlt: string;
  photoCredit?: string;
  statusLabel: string;
  amountLabel: string;
  amount: string;
  intro: string;
  /** Egymondatos kártya-szöveg a promó-dobozokhoz (ügyoldal, Börtönben van-e? lista). */
  teaser: string;
  crimes: string[];
  seoDescription: string;
  /** A kapcsolódó kiemelt ügy (UGYEK id) — keretes kártya + az ügy aktuális
   *  BREAKING frissítése a lap tetején, ha `showUgyBreaking`. */
  relatedUgyId?: string;
  showUgyBreaking?: boolean;
  /** /adatbazis/szemely/<slug> rollup oldal, ha van (person-rollup-config). */
  rollupSlug?: string;
  featuredVideo?: DetaineeVideo;
  statusItems: { icon: string; label: string; value: string }[];
  sections: DetaineeSection[];
  /** Hírfolyam: a cím tartalmazza valamelyiket, és `newsSince` utáni. */
  newsKeywords: string[];
  newsExcludeKeywords?: string[];
  newsSince: string;
}

export const LETARTOZTATOTTAK: DetaineeProfile[] = [
  {
    slug: 'sesztak-miklos',
    name: 'Seszták Miklós',
    verdictPersonName: 'Seszták Miklós',
    subtitle: 'Volt nemzeti fejlesztési miniszter (2014–2018) · KDNP-s országgyűlési képviselő',
    photo: '/images/persons/sesztak-miklos.webp',
    photoAlt: 'Seszták Miklós',
    photoCredit: 'Seszták Miklós — eredeti fotó: kdnp.hu',
    statusLabel: 'Letartóztatásban',
    amountLabel: 'A gyanú szerint átvett kenőpénz',
    amount: '12,6 milliárd Ft',
    intro:
      'Az Orbán-kormány volt nemzeti fejlesztési miniszterét 2026. szeptember 28-án vették őrizetbe, miután az Országgyűlés felfüggesztette a mentelmi jogát. A gyanú szerint minisztersége idején összesen 12,6 milliárd forint kenőpénzt vett át, többek között a Volánbusz szerződéseivel és buszbeszerzéseivel összefüggésben. 2026. november 12–13-án a nyomozók több mint 6 milliárd forintnyi elrejtett készpénzt találtak. Seszták Miklós tagadja a bűncselekmények elkövetését; jogerős ítélet nincs, az ártatlanság vélelme megilleti.',
    teaser: 'A gyanú szerint 12,6 milliárd forint kenőpénzt vett át; a nyomozók több mint 6 milliárd forintnyi elrejtett készpénzt találtak.',
    crimes: ['Hivatali vesztegetés elfogadása', 'Volánbusz-ügy'],
    seoDescription:
      'Miért tartóztatták le Seszták Miklóst? 12,6 milliárd forintos kenőpénz-gyanú, a Volánbusz-ügy, és a megtalált, több mint 6 milliárd forintnyi készpénz.',
    relatedUgyId: 'volanbusz-ugy',
    showUgyBreaking: true,
    featuredVideo: {
      id: 'zO5cAMoCO2U',
      label: 'Magyar Péter Hivatalos · 2026. nov. 13.',
      title: 'Íme az NVVH felvételei Seszták Miklós földből kiásott milliárdjairól',
      summary:
        'A Nemzeti Vagyonvisszaszerzési és Vagyonvédelmi Hivatal felvételei a Seszták Miklóshoz köthető, elrejtett készpénz megtalálásáról. A pénzt átvételkor a Magyar Államkincstár 12 munkatársa 8 órán át, 5 gépi számlálóval számolta meg.',
    },
    statusItems: [
      { icon: '🔴', label: 'Őrizetbe vétel', value: '2026. szeptember 28. — a mentelmi joga felfüggesztésének napján' },
      { icon: '🔒', label: 'Letartóztatás', value: '2026. szeptember 30-tól; a bíróság 2027. január 30-ig meghosszabbította' },
      { icon: '⚖️', label: 'Gyanú', value: 'Hivatali vesztegetés elfogadása — a gyanú szerint összesen 12,6 milliárd Ft (2014–2018)' },
      { icon: '💵', label: 'Megtalált készpénz', value: 'Több mint 6 milliárd Ft (2026. nov. 12–13.), befizetve a Magyar Államkincstárba' },
      { icon: '📋', label: 'Eljárási szakasz', value: 'Nyomozás — vádemelés még nem történt' },
    ],
    sections: [
      {
        id: 'miert',
        title: 'Miért tartóztatták le?',
        blocks: [
          {
            type: 'text',
            paragraphs: [
              'A Legfőbb Ügyészség 2026. szeptember 22-én kezdeményezte Seszták Miklós mentelmi jogának felfüggesztését milliárdos korrupció gyanúja miatt. Az Országgyűlés szeptember 28-án reggel 139 igen szavazattal, ellenszavazat és tartózkodás nélkül felfüggesztette a mentelmi jogát; a Fidesz és a KDNP képviselői nem vettek részt a szavazáson.',
              'Seszták Miklós még aznap délelőtt maga ment be a Központi Nyomozó Főügyészségre, ahol gyanúsítottként kihallgatták, majd őrizetbe vették. Ügyvédje később azt kifogásolta, hogy ügyfelét 10:54-kor vették őrizetbe, a mentelmi jog felfüggesztése pedig csak 11:46-kor jelent meg a Magyar Közlönyben.',
              'Szeptember 30-án a Budai Központi Kerületi Bíróság nyomozási bírája 30 napra elrendelte a letartóztatását. A bíróság szerint fennállt a veszélye, hogy tanúkat befolyásolna, illetve bizonyítékokat rejtene el vagy semmisítene meg; a szökés veszélyét akkor nem látta megalapozottnak. A volt minisztert a Nagy Ignác utcai büntetés-végrehajtási intézetbe szállították.',
            ],
          },
          { type: 'video', video: {
            id: 'NB1RPcsbrn0',
            label: 'ATV Magyarország · 2026. szept. 28.',
            title: 'Őrizetben a volt miniszter: Seszták maga ment be az ügyészségre, miután megvonták a mentelmi jogát',
            summary: 'Az ATV híradása Seszták Miklós őrizetbe vételéről: az Országgyűlés felfüggesztette az ő, Hankó Balázs és Magyar Péter mentelmi jogát, Seszták pedig maga ment be a Központi Nyomozó Főügyészségre vallomást tenni.',
          } },
          {
            type: 'text',
            heading: 'Január 30-ig marad rács mögött',
            paragraphs: [
              'Október 28-án a bíróság az NVVH indítványára 2027. január 30-ig meghosszabbította a letartóztatást, ezúttal szökés, elrejtőzés és a bizonyítási eljárás veszélyeztetése miatt. A Fővárosi Törvényszék közleménye szerint Seszták Miklós 9 milliárd forint készpénzt tartott a lakásán páncélszekrényekben; a nyomozók a szekrényeket üresen találták, a bíróság szerint a gyanúsított a kihallgatása előtt gondoskodhatott a pénz elrejtéséről.',
              'A védő a kényszerintézkedés megszüntetését, másodsorban 300 millió forint óvadék ellenében házi őrizetet kért — a bíróság ezt elutasította.',
            ],
          },
          {
            type: 'articles',
            items: [
              {
                source: '24.hu',
                date: '2026. szeptember 30.',
                headline: 'Letartóztatták Seszták Miklós volt minisztert a Volánbusz-ügyben',
                lead: 'A bíróság a letartóztatás három indítványozott okából kettőt elutasított: szerinte a bizonyítás veszélyeztetése indokolja a letartóztatást.',
                url: 'https://24.hu/belfold/2026/09/30/sesztak-miklos-letartoztatas-korrupcio-volanbusz/',
              },
              {
                source: 'HVG',
                date: '2026. október 28.',
                headline: 'Seszták Miklós 9 milliárd forint készpénzt tartott odahaza a páncélszekrényben a bíróság szerint',
                lead: 'A nyomozók üresen találták a letartóztatásban lévő KDNP-s parlamenti képviselő páncélszekrényeit.',
                url: 'https://hvg.hu/gazdasag/20261028_sesztak-miklos-9-milliard-forint-keszpenz-otthon-birosag',
              },
            ],
          },
        ],
      },
      {
        id: 'gyanu',
        title: 'Mivel gyanúsítják?',
        blocks: [
          {
            type: 'text',
            paragraphs: [
              'A gyanú hivatali vesztegetés elfogadásának bűntette és más bűncselekmények. A Mentelmi Bizottság egyik tagjának parlamenti tájékoztatása szerint Seszták Miklós nemzeti fejlesztési minisztersége idején (2014. június 6. – 2018. május 18.) összesen 12,6 milliárd forint értékű kenőpénzt vett át, pénzfutárokon keresztül. A tájékoztatás szerint többek között:',
              'Volánbusz-szerződések: három cég havi 115 millió forintot fizetett egy érdekcsoportnak azért, hogy megtarthassa a Volánbusszal kötött szerződéseit. A gyanú szerint ezt a rendszert Seszták és az MNV akkori vezetője „átvette”, a havi díjat 130 millió forintra emelték, és 2015 májusától 2018 júliusáig összesen 7 076 000 000 forintot kaptak.',
              'Buszbeszerzések: 2015 és 2017 között 14 ügyletben 645 új és használt busz beszerzése után a beszállítók buszonként fizettek — összesen 3 706 600 000 forintot, amelynek 80 százaléka Sesztákhoz, 20 százaléka a másik gyanúsítotthoz került.',
              'Egyéb projektek: egy személy két kft.-hez köthető — főleg uszodaépítési — projektekkel összefüggésben további 1 050 662 605, illetve 270 164 701 forintot juttatott neki.',
              'Ha a bíróság bűnösnek mondja ki, öt-tíz év szabadságvesztés fenyegeti. Vádemelés még nem történt.',
            ],
          },
          {
            type: 'quote',
            text: 'Semmilyen bűncselekményt nem követtem el és semmilyen bűncselekmény elkövetéséről nincs tudomásom.',
            attribution: 'Seszták Miklós · Telex, 2026. szeptember 28.',
            url: 'https://telex.hu/belfold/2026/09/28/sesztak-miklos-mentelmi-jog-parlament-korrupcio',
          },
          {
            type: 'articles',
            items: [
              {
                source: '444',
                date: '2026. szeptember 28.',
                headline: 'Seszták Miklóst összesen 12,6 milliárd forint értékű kenőpénz zsebre rakásával gyanúsítják',
                lead: 'Pénzfutárok vitték az ügyészség indítványa szerint a korrupciós pénzt Sesztáknak, akit azzal gyanúsítanak, hogy az MNV vezérével egy már létező vesztegetési rendszert vett át, és buszbeszerzések után is jogtalan előnyt kért.',
                url: 'https://444.hu/2026/09/28/sesztak-miklost-osszesen-126-milliard-forint-erteku-kenopenz-zsebre-rakasaval-gyanusitjak',
              },
            ],
          },
          { type: 'related-ugy' },
        ],
      },
      {
        id: 'penz',
        title: 'A pénz nyomában',
        blocks: [
          {
            type: 'text',
            paragraphs: [
              'Október 30-án letartóztatták Seszták Miklós egyik bizalmasát is, aki az NVVH szerint a korrupciós pénzeket vette át és szállította. November elején az NVVH azt is közölte, hogy a volt miniszter biztonsági ajtóval zárt, hangszigetelt szobájában talált páncélszekrények olyan típusúak, amilyeneket jellemzően zálogházak és pénzügyi szolgáltatók használnak.',
              'A Telex október 31-én két vagyonkezelő alapítványról írt, amelyekben összesen több mint 4,1 milliárd forint induló vagyon van, és amelyek kapcsolatai Seszták régi üzleti köréhez vezetnek. Seszták és családtagjai papíron nem alapítók és nem kedvezményezettek, a vagyonellenőr azonban mindkét alapítványnál a lánya; az egyiket tizenegy nappal azután hozták létre, hogy az ügyészség önálló nyomozást indított.',
              '2026. november 12-én és 13-án a nyomozók Budapesten, valamint Pest, Békés és Nógrád megyében tartottak összehangolt kutatásokat. Erdőben elásva, mezőgazdasági és raktárépületekben, lakóingatlanokban és egy félreeső helyen lévő széfben összesen 5 071 632 000 forintot, 2 658 350 eurót és 1 257 100 amerikai dollárt találtak — a hatóság közlése szerint több mint 6 milliárd forintot. A teljes összeget befizették a Magyar Államkincstárba.',
            ],
          },
          {
            type: 'articles',
            items: [
              {
                source: '444',
                date: '2026. november 13.',
                headline: 'Itt van az év legerősebb kontentje: az NVVH közzétette a Seszták Miklós eldugott készpénzmilliárdjainak megtalálásáról készült képeket',
                lead: 'A képeken kiterített pénzkötegek, az erdőben ásó nyomozók és az aljnövényzet alól kiemelt pénzkazetták láthatók.',
                url: 'https://444.hu/2026/11/13/itt-van-az-ev-legerosebb-kontentje-az-nvvh-kozzetette-a-sesztak-miklos-eldugott-keszpenzmilliardjainak-megtalalasarol-keszult-kepeket',
              },
              {
                source: 'Telex',
                date: '2026. október 31.',
                headline: '4,1 milliárdos vagyon két alapítványban, amit Seszták Miklós lánya ellenőriz, és a szálak az apja üzleti köréhez vezetnek',
                lead: 'Cipruson és Kanadán át került jelentős vagyon a volt miniszter lányának felügyelete alá.',
                url: 'https://telex.hu/gazdasag/2026/10/31/sesztak-miklos-uzleti-kor-vagyonkezelo-alapitvanyok-milliardok-oak-hodvar-alapitvany-minotax',
              },
              {
                source: 'HVG',
                date: '2026. október 30.',
                headline: 'Letartóztatták Seszták Miklós bizalmasát, aki a pénzfutár lehetett',
                lead: 'Az NVVH szerint a korrupciós pénzeket vette át és szállította a gyanúsított.',
                url: 'https://hvg.hu/itthon/20261030_letartoztatas-sesztak-miklos-bizalmasa-penzfutar',
              },
            ],
          },
        ],
      },
      {
        id: 'ki-o',
        title: 'Ki Seszták Miklós?',
        blocks: [
          {
            type: 'text',
            paragraphs: [
              '1968-ban született, 1994-ben szerzett jogi diplomát az ELTE-n, 1996-tól ügyvéd. 1998 után a kisvárdai képviselő-testület tagja lett, 2010-től a térség Fidesz–KDNP-s egyéni országgyűlési képviselője; 2014-ben, 2018-ban és 2022-ben is nyert. 2014 és 2018 között nemzeti fejlesztési miniszter volt — tárcája felügyelte a Magyar Nemzeti Vagyonkezelőt, amely a Volánbusz tulajdonosi jogait gyakorolta.',
              '2026-ban egyéni választókerületében kikapott a tiszás jelölttől, a parlamentbe a Fidesz–KDNP listájáról jutott be. A mandátumáról a letartóztatása után sem mondott le.',
            ],
          },
          { type: 'video', video: {
            id: 'eBigMSckSD8',
            label: 'Magyar Péter Hivatalos · 2026. szept. 29.',
            title: 'Ki is az a Seszták Miklós, akit tegnap 12 milliárd forintos vesztegetési ügyben őrizetbe vettek?',
            summary: 'Kisvárdai és környékbeli lakosok beszélnek Seszták Miklós térségbeli szerepéről, közvetlenül az őrizetbe vétele után.',
          } },
          {
            type: 'articles',
            items: [
              {
                source: 'Telex',
                date: '2026. szeptember 28.',
                headline: 'A botrányokat halmozó volt miniszter, akit a leggazdagabb képviselőként vihetnek majd el – kicsoda Seszták Miklós?',
                lead: 'Megszavazta a parlament a KDNP-s Seszták Miklós mentelmi jogának felfüggesztését, aki, ha elítélik, akár 10 évet is kaphat.',
                url: 'https://telex.hu/belfold/2026/09/28/sesztak-miklos-mentelmi-jog-parlament-korrupcio',
              },
            ],
          },
        ],
      },
    ],
    newsKeywords: ['Seszták'],
    newsExcludeKeywords: ['Kasza Tibi', 'Binance', 'stand-up', 'Borízű hang', 'legfontosabb hírei', 'napindító', 'Hápogó kacsa'],
    newsSince: '2026-09-11',
  },
  {
    slug: 'hanko-balazs',
    name: 'Hankó Balázs',
    verdictPersonName: 'Hankó Balázs',
    subtitle: 'Volt kulturális és innovációs miniszter · fideszes országgyűlési képviselő',
    photo: '/images/persons/hanko-balazs.webp',
    photoAlt: 'Hankó Balázs',
    photoCredit: 'Hankó Balázs — eredeti fotó: kultura.hu',
    statusLabel: 'Letartóztatásban',
    amountLabel: 'A gyanú szerinti vagyoni hátrány',
    amount: '17,3 milliárd Ft',
    intro:
      'Az Orbán-kormány volt kulturális és innovációs miniszterét 2026. szeptember 28-án este vették őrizetbe, miután az Országgyűlés felfüggesztette a mentelmi jogát; október 1-jén a Kecskeméti Járásbíróság letartóztatta. A gyanú szerint az NKA egyik ideiglenes kollégiumán keresztül 1079 támogatásnál összesen 17,3 milliárd forintot használtak fel az alap törvényi céljaitól eltérően. Hankó Balázs tagadja a bűncselekmény elkövetését; jogerős ítélet nincs, az ártatlanság vélelme megilleti.',
    teaser: 'Az NKA-ügyben különösen jelentős vagyoni hátrányt okozó hűtlen kezeléssel gyanúsítják; február 1-jéig biztosan letartóztatásban marad.',
    crimes: ['Hűtlen kezelés (bűnszövetségben)', 'NKA-botrány'],
    seoDescription:
      'Miért tartóztatták le Hankó Balázst? 17,3 milliárd forintos hűtlen kezelés gyanúja az NKA-ügyben, a „politikai forrásigények”, és mi történt az őrizetbe vétele óta.',
    relatedUgyId: 'nka-botrany',
    showUgyBreaking: true,
    rollupSlug: 'hanko-balazs',
    featuredVideo: {
      id: '57CfLx7IoFQ',
      label: 'Kontroll · 2026. okt. 2.',
      title: 'Letartóztatták Hankó Balázst – Ott voltunk',
      summary: 'A Kontroll riportja a Kecskeméti Járásbíróságról, ahol október 1-jén döntöttek Hankó Balázs letartóztatásáról; a stáb kérdéseket is feltett a volt miniszternek.',
    },
    statusItems: [
      { icon: '🔴', label: 'Őrizetbe vétel', value: '2026. szeptember 28., este — a mentelmi joga felfüggesztésének napján' },
      { icon: '🔒', label: 'Letartóztatás', value: '2026. október 1-jétől (Kecskeméti Járásbíróság); meghosszabbítva, február 1-jéig biztosan marad' },
      { icon: '⚖️', label: 'Gyanú', value: 'Különösen jelentős vagyoni hátrányt okozó, bűnszövetségben elkövetett hűtlen kezelés — a gyanú szerint 17,3 milliárd Ft' },
      { icon: '👥', label: 'Vele együtt', value: 'Varga-Bajusz Veronika volt államtitkár — szintén letartóztatásban' },
      { icon: '📋', label: 'Eljárási szakasz', value: 'Nyomozás — vádemelés még nem történt' },
    ],
    sections: [
      {
        id: 'miert',
        title: 'Miért tartóztatták le?',
        blocks: [
          {
            type: 'text',
            paragraphs: [
              'A Legfőbb Ügyészség 2026. szeptember 22-én kezdeményezte Hankó Balázs mentelmi jogának felfüggesztését az NKA-ügyben. Az Országgyűlés szeptember 28-án reggel felfüggesztette a mentelmi jogát. Hankó a nap nagy részét a Fidesz frakcióirodájában töltötte, ahol azt várta, hogy a munkahelyére érkezzenek a rendőrök; este 19 óra 14 perckor kapta meg az idézést, ezután önként hagyta el a Parlamentet.',
              'Nem sokkal este nyolc után megérkezett a NAV Huszti úti épületébe, ahol őrizetbe vették, majd bilincsben Kecskemétre szállították. Védője szerint a kihallgatás hajnali háromig tartott; Hankó 25 oldalas vallomásában tételesen tagadta, hogy bűncselekményt követett volna el.',
              'Szeptember 30-án az ügyészség indítványozta a letartóztatását: szerinte a volt minisztert sok év szabadságvesztés fenyegeti, kiterjedt kapcsolatrendszere miatt fennáll a szökés és az elrejtőzés veszélye, a hosszabb időn át szervezett, hierarchizált elkövetés miatt pedig az eljárás befolyásolásától is tartani lehet. Október 1-jén a Kecskeméti Járásbíróság elrendelte a letartóztatását; ugyanaznap egykori államtitkárát, Varga-Bajusz Veronikát is letartóztatták. Miközben Hankó a bíróságon volt, az otthonában házkutatást tartottak — ügyvédje szerint semmit nem foglaltak le.',
            ],
          },
          { type: 'video', video: {
            id: 'DqqT0Xak8xc',
            label: 'Kontroll · 2026. szept. 28.',
            title: 'Hankó Balázs egy nehéz napja az Országházban',
            summary: 'A Kontroll tudósítása a mentelmi jog felfüggesztésének napjáról: Hankó Balázs a mentelmi bizottság ülésén érvelt maga mellett, az Országgyűlés mégis felfüggesztette a mentelmi jogát.',
          } },
          {
            type: 'text',
            heading: 'Februárig rács mögött marad',
            paragraphs: [
              'Október 28-án a nyomozási bíró — ezúttal Hankó meghallgatása nélkül, az iratok alapján — három hónappal meghosszabbította a letartóztatását. A fellebbezést november 11-én a Kecskeméti Törvényszék elutasította: a bíróság szerint a bűncselekmény megalapozott gyanúja és a kényszerintézkedés törvényi okai közül több is fennáll, ezért Hankó Balázs február 1-jéig biztosan letartóztatásban marad. Varga-Bajusz Veronika ügyében is hasonló döntés született.',
            ],
          },
          {
            type: 'articles',
            items: [
              {
                source: '444',
                date: '2026. október 1.',
                headline: 'Hankó Balázs fideszes országgyűlési képviselőt, korábbi kulturális és innovációs minisztert letartóztatták',
                lead: 'Hankót reggel rendőri kísérettel, bilincsben vezették be a Kecskeméti Járásbíróságra, ahol órákig várta a döntést.',
                url: 'https://444.hu/2026/10/01/hanko-balazs-fideszes-orszaggyulesi-kepviselot-korabbi-kulturalis-es-innovacios-minisztert-letartoztattak',
              },
              {
                source: 'Telex',
                date: '2026. szeptember 29.',
                headline: 'Hankót bilincsben szállították Kecskemétre, ahol hajnali háromig hallgatták ki',
                lead: 'Vallomást tett, amiben tételesen tagadta, hogy bűncselekményt követett volna el.',
                url: 'https://telex.hu/belfold/2026/09/29/hanko-balazs-vedoje-toth-m-gabor-kihallgatas-orizet',
              },
              {
                source: 'Telex',
                date: '2026. november 11.',
                headline: 'Hankó Balázs börtönben tölti a karácsonyt és a szilvesztert',
                lead: 'Február 1-jéig biztosan letartóztatásban marad a volt fideszes miniszter és az államtitkára is, miután elutasították a fellebbezésüket.',
                url: 'https://telex.hu/belfold/2026/11/11/hanko-balazs-marad-letartoztatasban-bortonben-tolti-karacsonyt-szilvesztert',
              },
            ],
          },
        ],
      },
      {
        id: 'gyanu',
        title: 'Mivel gyanúsítják?',
        blocks: [
          {
            type: 'text',
            paragraphs: [
              'A gyanú különösen jelentős vagyoni hátrányt okozó, bűnszövetségben elkövetett hűtlen kezelés. Az ügyészség szerint az NKA Kiemelt Kulturális Programok Ideiglenes Kollégiumát Hankó irányításával arra használták, hogy a forrásokat az alap törvényi céljaitól eltérően költsék el: 2025. szeptember 3. és 2026. március 30. között 1079 támogatásnál összesen 17,3 milliárd forintot. Papíron a kollégium döntött, a gyanú szerint azonban a tényleges döntéseket Hankó hozta — miközben a törvény szerint a miniszter nem vehetett részt a pályázatok elbírálásában.',
              'A Molnár Áron által megszerzett és a 444 által ismertetett levelek szerint a kormány 2025. május 7-i ülésén, amikor Hankó az NKA 10 milliárd forintos tartalékának felszabadítását kezdeményezte, a kormány előbb a „politikai forrásigények” áttekintését kérte. Egy május 16-i levélben ez a sor szerepel: „106 VK 50 millió ft/VK”, vagyis választókerületenként 50 millió forint. A tartalék végül a gyanú szerinti kollégium keretéhez került.',
              'Ha a bíróság bűnösnek mondja ki, öt-tíz év szabadságvesztés fenyegeti. Védője szerint vele szemben eddig csak a hűtlen kezelés gyanúját közölték, tiltott pártfinanszírozást vagy bűnszervezetet nem. Vádemelés még nem történt.',
            ],
          },
          {
            type: 'articles',
            items: [
              {
                source: '444',
                date: '2026. szeptember 22.',
                headline: 'Milliárdos korrupció miatt kérte Seszták mentelmi jogának felfüggesztését a Legfőbb Ügyészség, Hankót is öt és tíz év közötti tételekkel gyanúsítanák meg',
                lead: 'Az ügyészség szerint 1079 támogatásnál összesen 17,3 milliárd forintot használtak fel az NKA törvényi céljaitól eltérően.',
                url: 'https://444.hu/2026/09/22/tizmilliardos-korrupcioval-gyanusitottak-meg-sesztakot-hankot-is-ot-es-tiz-ev-kozotti-tetelekkel-gyanusitja-a-legfobb-ugyeszseg',
              },
              {
                source: '444',
                date: '2026. október 6.',
                headline: 'A Molnár Áron által megszerzett levelek alapján Hankóék tényleg begyűjtötték előbb a „politikai forrásigényeket”, aztán kaptak engedélyt a kormánytól az NKA 10 milliárdos tartalékának elköltésére',
                lead: 'Az Orbán-kormány feltételt szabott, hogy a kultúra kapjon még 10 milliárdot: azt, hogy a közpénzek elosztásánál számítsanak a politikai igények.',
                url: 'https://444.hu/2026/10/06/a-molnar-aron-altal-megszerzett-levelek-alapjan-hankoek-tenyleg-begyujtottek-elobb-a-politikai-forrasigenyeket-aztan-kaptak-engedelyt-a-kormanytol-az-nka-10-milliardos-tartalekanak-elkoltesere',
              },
            ],
          },
          { type: 'related-ugy' },
        ],
      },
      {
        id: 'mit-mond',
        title: 'Mit mond Hankó Balázs?',
        blocks: [
          {
            type: 'text',
            paragraphs: [
              'Hankó Balázs tagadja a bűncselekmény elkövetését. Szerinte az NKA-kifizetések rendben voltak és a magyar kultúrát szolgálták, az ellene folyó eljárást pedig politikai indíttatású, koncepciós eljárásnak nevezi. A Fidesz politikai fogolyként beszél róla; mandátumáról nem mondott le, letartóztatása alatt is országgyűlési képviselő.',
            ],
          },
          {
            type: 'quote',
            text: 'Bízom abban, hogy a hamis vádakkal szemben győz az igazság.',
            attribution: 'Hankó Balázs · HVG, 2026. szeptember 22.',
            url: 'https://hvg.hu/itthon/20260922_hanko-balazs-bizalom-hamis-vad-gyozelem-igazsag',
          },
          { type: 'video', video: {
            id: 'IOqxsX9GH1Y',
            label: 'ATV Magyarország · 2026. szept. 30.',
            title: 'Indítványozták Hankó Balázs letartóztatását',
            summary: 'Az ATV híradása: Hankó Balázs politikai koncepciós eljárásnak tartja az ellene folyó nyomozást és az őrizetbe vételét; az ügyészség aznap indítványozta a letartóztatását.',
          } },
        ],
      },
    ],
    newsKeywords: ['Hankó'],
    newsExcludeKeywords: ['Kasza Tibi', 'legfontosabb hírei', 'napindító', 'Newscast', 'Hanko bélyegző'],
    newsSince: '2026-09-20',
  },
];

/** Egy kiemelt ügy letartóztatottjainak aloldalai — az ügyoldali promó-dobozhoz. */
export function detaineesForUgy(ugyId: string): DetaineeProfile[] {
  return LETARTOZTATOTTAK.filter((p) => p.relatedUgyId === ugyId);
}

export function detaineeHref(p: DetaineeProfile): string {
  return `/birosagi-iteletek/${p.slug}`;
}

export function getDetaineeProfile(slug: string): DetaineeProfile | undefined {
  return LETARTOZTATOTTAK.find((p) => p.slug === slug);
}

/** A „Börtönben van-e?” lista sorából az aloldalra mutató link, ha van. */
export function detaineeHrefForPerson(personName: string): string | null {
  const p = LETARTOZTATOTTAK.find((x) => x.verdictPersonName === personName);
  return p ? `/birosagi-iteletek/${p.slug}` : null;
}
