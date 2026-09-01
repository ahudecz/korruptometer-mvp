/**
 * 011-nvvh-case-poll — a kérdés + a 30 kurátorolt opció idempotens betöltése.
 * A tartalom a specs/011-nvvh-case-poll kutatási alaplistájából származik
 * (lásd a feature-előkészítő anyagot) — mindegyik legalább 1 forráslinkkel.
 *
 * Idempotens: a kérdés a `slug`-on, az opciók a (pollQuestionId, title)
 * egyedi indexen keresztül `onConflictDoNothing`-gal mennek be — újrafuttatás
 * ártalmatlan.
 *
 * Használat: pnpm --filter @korr/db exec tsx src/seed-nvvh-poll.ts
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import * as schema from './schema';
import { assertWriteTarget } from './guard';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL not set');

const conn = postgres(DB_URL, { prepare: false, max: 1 });
const db = drizzle(conn, { schema });

const QUESTION = {
  slug: 'nvvh-elso-5-ugye',
  questionText:
    'Mi legyen a Nemzeti Vagyonvisszaszerzési és Védelmi Hivatal első 5 ügye?',
  minSelect: 1,
  maxSelect: 5,
};

type SeedOption = {
  title: string;
  shortDescription: string;
  amountHuf?: bigint;
  amountLabel?: string;
  sourceUrl: string;
  sourceOutlet: string;
  isAreaNotCase?: boolean;
  touchesEuFunds?: boolean;
  alreadyReported?: boolean;
};

// Sorrend = displayOrder. 1-22: konkrét, egyedi ügyek (a "Kiemelt" — már van
// eljárás, de az NVVH törvényi jogköre alapján ez nem kizáró ok — a 16-17.
// helyen). 23-30: "Terület" — nem egyetlen ügy, hanem egész vizsgálati
// terület, egy jellemző példaeset forrásával.
const OPTIONS: SeedOption[] = [
  {
    title: 'MNB-alapítványok / Matolcsy-kör / Pallas Athéné',
    shortDescription:
      'A PADME jegybanki alapítvány 266,4 Mrd Ft-os induló vagyonából 2024 végére csak 13 Mrd maradt — az ÁSZ hűtlen kezelés gyanújával feljelentést tett, a rendőrség nyomoz.',
    amountLabel: '~270 Mrd Ft',
    sourceUrl:
      'https://444.hu/2025/12/22/padme-270-milliard-forint-uszott-el-es-amikor-atvettek-csak-9-millio-volt-a-jegybanki-alapitvany-kasszajaban',
    sourceOutlet: '444',
    alreadyReported: true,
  },
  {
    title: '2020-as lélegeztetőgép-beszerzések',
    shortDescription:
      'A Külügyminisztérium 2026. augusztus 25-én hűtlen kezelés gyanújával feljelentést tett a Szijjártó Péter idején kötött, 300 milliárdos Covid-lélegeztetőgép-beszerzések ügyében.',
    amountLabel: '~300 Mrd Ft',
    sourceUrl:
      'https://444.hu/2026/08/25/hutlen-kezeles-gyanujaval-tett-feljelentest-a-kulugyminiszterium-a-lelegeztetogep-beszerzesek-miatt',
    sourceOutlet: '444',
    alreadyReported: true,
  },
  {
    title: 'Magántőkealapokon mozgatott állami vagyon',
    shortDescription:
      'Az állam 2024 végéig 1311 Mrd Ft-ot fektetett magántőkealapokba — a Transparency szerint az alapkezelők fele nem hozza nyilvánosságra a vagyon értékét.',
    amountHuf: 1_311_000_000_000n,
    sourceUrl: 'https://transparency.hu/hirek/tobb-mint-1300-milliard-magantokealapokba/',
    sourceOutlet: "Transparency Int'l",
  },
  {
    title: '4iG védelmiipari vagyonátadás',
    shortDescription:
      'Állami hadiipari cégek kerültek a 4iG-hez versenyeztetés nélkül, miután korábban titokban tízmilliárdokat pumpáltak a cégbe — a szerződés részleteit a mai napig titkolják.',
    amountHuf: 72_000_000_000n,
    sourceUrl:
      'https://telex.hu/direkt36/2026/04/07/titokban-allami-tizmilliardokat-pumpaltak-orban-egyik-kedvenc-cegebe-amely-aztan-kesobb-hadiipari-cegeket-vett-az-allamtol',
    sourceOutlet: 'Telex / Direkt36',
  },
  {
    title: 'Elios / Tiborcz / közvilágítás',
    shortDescription:
      'Az OLAF 35 vizsgált tenderből 17-ben szervezett csalást állapított meg Tiborcz István cégénél; 43,7 millió eurós EU-támogatás visszavonását javasolta.',
    amountLabel: '13+ Mrd Ft',
    sourceUrl:
      'https://atlatszo.hu/kozpenz/2022/02/04/vegre-nyilvanos-az-elios-ugyrol-szolo-olaf-jelentes-bar-tiborcz-istvan-es-az-elios-nevet-kitakartak-benne/',
    sourceOutlet: 'Átlátszó',
    touchesEuFunds: true,
  },
  {
    title: 'Hatvanpuszta és a vagyonosodási lánc',
    shortDescription:
      'Orbán Győző birtokának felújítása ~30 millió euróba került; a projektben részt vevő cégek jelentős állami szerződéseket és támogatásokat kaptak.',
    amountLabel: '~11,5 Mrd Ft',
    sourceUrl: 'https://444.hu/2025/08/27/hatvanpuszta-a-hazugsagra-epitett-palota',
    sourceOutlet: '444',
  },
  {
    title: 'Budapest–Belgrád vasút',
    shortDescription:
      'A magyar szakasz kínai hitelből épül, a hitelszerződést 10 évre titkosították; a szerb szakaszhoz képest a magyar kilométerár jóval magasabb.',
    amountLabel: '~800 Mrd Ft',
    sourceUrl:
      'https://hvg.hu/itthon/20220905_kina_budapest_belgrad_vasut_hitelcsomag_szerzodes_kinai',
    sourceOutlet: 'HVG',
  },
  {
    title: 'Paks II. szerződéses és tanácsadói lánc',
    shortDescription:
      'Csak a „Mr. Oroszország" Klaus Mangold cégével kötött ~8 hónapos tanácsadói keretszerződés 8,2 Mrd Ft-ot ért — a szerződés részletei átláthatatlanok.',
    amountHuf: 8_200_000_000n,
    sourceUrl:
      'https://m.hvg.hu/gazdasag/2022072_mr_oroszorszag_klaus_mangold_keretszerzodes_itm',
    sourceOutlet: 'HVG',
  },
  {
    title: 'Vodafone Magyarország állami megvásárlása',
    shortDescription:
      'Az állam 49%-os részesedésért 323 Mrd Ft-ot fizetett; a szerződés éveken át titkos volt, bíróság kötelezte a kormányt a nyilvánosságra hozatalára.',
    amountHuf: 323_000_000_000n,
    sourceUrl: 'https://telex.hu/gazdasag/2023/01/09/megvette-a-magyar-allam-es-a-4ig-egy-cege-a-magyar-vodafone-t',
    sourceOutlet: 'Telex',
  },
  {
    title: 'MLSZ és a stadion-futballfinanszírozás',
    shortDescription:
      'Az elmúlt 12 év 100+ Mrd Ft-nyi TAO-támogatásának nincs lezárt elszámolása — az MLSZ és a Sportállamtitkárság adatai több esetben ellentmondanak egymásnak.',
    amountLabel: '100+ Mrd Ft',
    sourceUrl:
      'https://hvg.hu/sport/20260811_mlsz-sportallamtiktarsag-tao-program-tamogatas-lezart-elszamolas',
    sourceOutlet: 'HVG',
  },
  {
    title: 'Nemzeti Konzultációk üzleti rendszere',
    shortDescription:
      '2011 óta legalább 119 Mrd Ft ment el nemzeti konzultációkra — a szuverenitásvédelmi konzultáció önmagában 16 Mrd Ft-os reklám- és nyomdaköltséggel.',
    amountHuf: 119_000_000_000n,
    sourceUrl:
      'https://telex.hu/belfold/2026/02/09/legalabb-119-milliardot-koltott-2011-ota-a-kormany-nemzeti-konzultaciora',
    sourceOutlet: 'Telex',
  },
  {
    title: 'Autópálya-koncessziók',
    shortDescription:
      'A 35 éves koncesszió alatt eddig 1024 Mrd Ft-ot fizetett ki az állam Mészáros és Szíjj László magántőkealapjainak — a befektetők hozama egy évben 127%.',
    amountHuf: 1_024_000_000_000n,
    sourceUrl:
      'https://444.hu/2026/07/04/vitezy-david-az-autopalya-koncessziorol-az-elmult-negy-evben-1024-milliard-forintot-fizettek-ki-meszaros-es-szijj-laszlo-magantokealapjainak',
    sourceOutlet: '444',
  },
  {
    title: 'Mátrai Erőmű',
    shortDescription:
      'Mészáros 5,9 Mrd Ft-ért vette meg 2018-ban a 73%-ot, majd az állam 17,4 Mrd Ft-ért vásárolta vissza tőle a veszteséges erőművet — a teljes tranzakció 75+ Mrd Ft-ba került.',
    amountLabel: '75+ Mrd Ft',
    sourceUrl:
      'https://444.hu/2023/07/29/kiderul-hogy-miert-vette-meg-az-allam-milliardokkal-dragabban-a-veszteseges-matrai-eromuvet-meszaros-lorinctol',
    sourceOutlet: '444',
  },
  {
    title: 'Várnegyed és állami ingatlanprojektek',
    shortDescription:
      'A József főhercegi palota felújítási kerete 56 Mrd Ft-ról 96,5 Mrd Ft-ra nőtt — nemzetbiztonsági okokra hivatkozva közbeszerzés nélkül.',
    amountHuf: 96_500_000_000n,
    sourceUrl:
      'https://telex.hu/belfold/2026/06/05/jozsef-fohercegi-palota-budavar-40-milliarddal-dragul-lazar-janos-ekm',
    sourceOutlet: 'Telex',
  },
  {
    title: 'Zugló / Bosnyák téri ingatlanfejlesztés',
    shortDescription:
      'A kormány visszaköveteli a Bosnyák téri irodakomplexumra kifizetett ~315 Mrd Ft közpénzt a beruházótól, szerződésszegésre hivatkozva.',
    amountHuf: 315_000_000_000n,
    sourceUrl:
      'https://telex.hu/gazdasag/2026/08/07/zugloi-iroda-monstrum-bosnyak-ter-bayer-construct-pereskedes-allam-szerzodes-felmondas-300-milliard-forint',
    sourceOutlet: 'Telex',
  },
  {
    title: 'Parkfenntartási kenőpénzbotrány',
    shortDescription:
      '8 politikust és vállalkozót tartóztattak le 2026 júniusában — Fidesz, DK, Momentum és MSZP is érintett. Egy parkfenntartó vállalkozó 2011–2024 között közel 2 Mrd Ft kenőpénzt fizethetett budapesti politikusoknak milliárdos szerződésekért cserébe.',
    amountLabel: '~2 Mrd Ft',
    sourceUrl: 'https://telex.hu/belfold/2026/06/04/orsi-gergely-reakcio-letartoztatas',
    sourceOutlet: 'Telex',
    alreadyReported: true,
  },
  {
    title: 'Bánki Erik Volvo-gate (Pécs)',
    shortDescription:
      'Hadházy Ákos kétszer is feljelentette Bánki Erik fideszes országgyűlési képviselőt a túlárazott pécsi Volvo-buszbeszerzés ügyében — két vádlottat jogerősen elítéltek, de az ügy Bánki szerepét illetően nem zárult le.',
    amountLabel: '~700 M Ft',
    sourceUrl: 'https://444.hu/2026/04/27/hadhazy-masodszor-is-feljelentette-banki-eriket-a-volvo-csalas-miatt',
    sourceOutlet: '444',
    alreadyReported: true,
  },
  {
    title: 'Völner–Schadl ügy teljes gazdasági háttere',
    shortDescription:
      'Schadl György végrehajtói kamarai elnök 83 M Ft készpénzt adott Völner Pál igazságügyi államtitkárnak; az ügyészség 10, illetve 8 év börtönt kért rájuk.',
    amountLabel: '83 M Ft (a per tétje)',
    sourceUrl:
      'https://telex.hu/belfold/2022/10/24/volner-pal-schadl-gyorgy-vademeles-magyar-birosagi-vegrehajtoi-kar-korrupcio',
    sourceOutlet: 'Telex',
  },
  {
    title: 'Rogán-kör kommunikációs megbízásai',
    shortDescription:
      'A Rogán vezette hivatal 225 Mrd Ft-os keretszerződést kötött Balásy Gyula cégeivel — a G7 szerint 225 Mrd Ft-nyi kommunikációs közpénz jelentős része versenyeztetés nélkül ment el.',
    amountHuf: 225_000_000_000n,
    sourceUrl: 'https://telex.hu/g7/penz/2025/11/12/kommunikacios-koltes-balasy-rogan-kozpenz',
    sourceOutlet: 'Telex / G7',
  },
  {
    title: 'Állami informatikai közbeszerzések',
    shortDescription:
      'A kormány feljelentést tett a KRÉTA, Neptun és Poszeidon rendszerek 100,8 Mrd Ft-os beszerzései miatt — 73 Mrd Ft versenyeztetés nélkül, egyetlen cégcsoporthoz köthetően.',
    amountHuf: 100_800_000_000n,
    sourceUrl:
      'https://444.hu/2026/07/17/feljelentest-tesz-a-kormany-a-kreta-a-neptun-es-az-allami-iratkezelo-rendszerek-tobb-mint-100-milliard-forintos-gyanus-beszerzesei-miatt',
    sourceOutlet: '444',
  },
  {
    title: 'Nemzeti Kulturális Alap pénzosztási rendszere',
    shortDescription:
      'Hankó Balázs volt kulturális miniszter a választások előtt szabálytalanul osztott ki milliárdos NKA-támogatásokat; a NAV 7 gyanúsítottat vett őrizetbe.',
    amountLabel: '17+ Mrd Ft',
    sourceUrl:
      'https://telex.hu/belfold/2026/06/23/nka-botrany-hat-szemelyt-orizetbe-vett-a-nav-hanko-balazs-tarr-zoltan',
    sourceOutlet: 'Telex',
    alreadyReported: true,
  },
  {
    title: 'Kaszinókoncessziók versenyeztetés nélkül',
    shortDescription:
      'Garancsihoz köthető cég 2061-ig szóló koncessziót kapott a soproni kaszinóra pályázat nélkül; a Garancsi–Habony közös kaszinócég 12 Mrd Ft osztalékot fizetett.',
    amountLabel: '12 Mrd Ft (1 eset)',
    sourceUrl: 'https://telex.hu/gazdasag/2024/05/31/osztalek-lvc-diamond-kaszino-garancsi-istvan-habony-arpad',
    sourceOutlet: 'Telex',
  },
  // --- Terület — nem egyedi ügy, hanem egész vizsgálati terület ---
  {
    title: 'Az MNB teljes Matolcsy-korszaka',
    shortDescription:
      'Teljes vagyonmozgási audit (ingatlanok, alapítványok, magántőkealapok, tanácsadói szerződések) — példaeset: az MNB közpénzjelleg-vitája, amivel eltitkolták az alapítványi költéseket.',
    sourceUrl:
      'https://444.hu/2026/08/21/mnb-transparency-international-kozpenz-allamhaztartas-adatigenyles-varga-mihaly-matolcsy-gyorgy',
    sourceOutlet: '444',
    isAreaNotCase: true,
  },
  {
    title: 'MVM–MET energiakereskedelmi rendszer',
    shortDescription:
      'A MET privilegizált hozzáférést kapott az osztrák–magyar gázvezetékhez versenyeztetés nélkül; számítások szerint ha az MVM egyedül importál, 50–60 Mrd Ft-tal olcsóbb lett volna.',
    amountLabel: '~50–60 Mrd Ft',
    sourceUrl: 'https://444.hu/2015/11/05/nem-stimmel-a-met-mvm-uzlet-miniszteri-magyarazata',
    sourceOutlet: '444',
    isAreaNotCase: true,
  },
  {
    title: 'Lázár János megmagyarázhatatlan vagyonosodása',
    shortDescription:
      'A batidai vadászkastélya körüli földekre és a hozzá vezető útra 3,3 Mrd Ft közpénz ment el, miközben Lázár maga is folyamatosan bővíti a birtokot — eddig legalább 183 M Ft-ot költött földvásárlásra, és egyedüliként ő kap osztalékot a kastélyt birtokló cégből.',
    amountLabel: '~3,3 Mrd Ft',
    sourceUrl:
      'https://atlatszo.hu/orszagszerte/2025/01/21/legalabb-183-milliot-koltott-lazar-janos-a-kastelya-melletti-foldek-megvasarlasara/',
    sourceOutlet: 'Átlátszó',
  },
  {
    title: 'Balaton-parti állami vagyonátadások',
    shortDescription:
      'Kikötők, kempingek eladása/bérbeadása — például a balatonboglári Sellő kemping 1 Mrd Ft-ért kelt el egykori strómanhálózathoz köthető cégnek.',
    sourceUrl:
      'https://atlatszo.hu/2020/10/21/folytatodik-a-balaton-kiarusitasa-berbeadjak-a-vitorlaskikotoket-vizparti-telkeket-privatizalnak/',
    sourceOutlet: 'Átlátszó',
    isAreaNotCase: true,
  },
  {
    title: 'Kisfaludy-program',
    shortDescription:
      '300 Mrd Ft-os turisztikai fejlesztési program — a támogatás kétharmada az igénylők fél százalékánál koncentrálódott, köztük kormányközeli szereplőknél.',
    amountHuf: 300_000_000_000n,
    sourceUrl: 'https://adatbazis.k-monitor.hu/adatbazis/cimkek/kisfaludy-program',
    sourceOutlet: 'K-Monitor adatbázis',
    isAreaNotCase: true,
  },
  {
    title: 'Lombkoronasétányok és vidéki EU-projektek',
    shortDescription:
      'Az OLAF manipulált közbeszerzést és túlárazást tárt fel a nyírmártonfalvi lombkoronasétánynál; a volt polgármester ellen vádat emeltek költségvetési csalás gyanújával.',
    amountLabel: '~60 M Ft (1 eset)',
    sourceUrl:
      'https://atlatszo.hu/impakt/2026/01/08/visszaeleseket-tart-fel-az-olaf-az-elhiresult-lombkorona-setanyt-is-tamogato-unios-videkfejlesztesi-program-lebonyolitasa-teren/',
    sourceOutlet: 'Átlátszó',
    isAreaNotCase: true,
    touchesEuFunds: true,
  },
  {
    title: 'Állami egyetemek alapítványosítása',
    shortDescription:
      'Egyetemi vagyon (ingatlanok, részvények) került vagyonkezelő alapítványokhoz, kormány-kinevezte kuratóriumok ellenőrzése alá — az elosztás intézményenként rendkívül egyenlőtlen.',
    sourceUrl:
      'https://atlatszo.hu/oktatas/2026/06/05/autonomia-atlathatosag-bizalom-mind-eltunt-az-egyetemi-modellvaltassal/',
    sourceOutlet: 'Átlátszó',
    isAreaNotCase: true,
  },
  {
    title: 'EU-s pénzek legnagyobb kedvezményezettjei',
    shortDescription:
      'Politikaközeli vállalkozások rendszeresen részesülnek uniós fejlesztési pénzekből (GINOP); egy vizsgált szeletben 36 kedvezményezett cég kapta a támogatás 46%-át.',
    amountLabel: '121,3 Mrd Ft (1 szelet)',
    sourceUrl:
      'https://atlatszo.hu/kozpenz/2017/11/30/politikakozeli-vallalkozasok-is-reszesulnek-a-ginop-unios-fejlesztesi-penzekbol/',
    sourceOutlet: 'Átlátszó',
    isAreaNotCase: true,
    touchesEuFunds: true,
  },
];

async function main() {
  assertWriteTarget('seed-nvvh-poll');

  const [question] = await db
    .insert(schema.pollQuestions)
    .values(QUESTION)
    .onConflictDoNothing({ target: schema.pollQuestions.slug })
    .returning();

  const questionRow =
    question ??
    (
      await db
        .select()
        .from(schema.pollQuestions)
        .where(eq(schema.pollQuestions.slug, QUESTION.slug))
    )[0];

  if (!questionRow) throw new Error('PollQuestion seed/lookup failed');

  console.log(`PollQuestion: ${questionRow.slug} (${questionRow.id})`);

  let inserted = 0;
  for (let i = 0; i < OPTIONS.length; i++) {
    const opt = OPTIONS[i]!;
    const result = await db
      .insert(schema.pollOptions)
      .values({
        pollQuestionId: questionRow.id,
        displayOrder: i + 1,
        title: opt.title,
        shortDescription: opt.shortDescription,
        amountHuf: opt.amountHuf ?? null,
        amountLabel: opt.amountLabel ?? null,
        sourceUrl: opt.sourceUrl,
        sourceOutlet: opt.sourceOutlet,
        isAreaNotCase: opt.isAreaNotCase ?? false,
        touchesEuFunds: opt.touchesEuFunds ?? false,
        alreadyReported: opt.alreadyReported ?? false,
      })
      .onConflictDoNothing({ target: [schema.pollOptions.pollQuestionId, schema.pollOptions.title] })
      .returning({ id: schema.pollOptions.id });
    if (result.length > 0) inserted++;
  }

  console.log(`PollOption: ${inserted} új sor beszúrva (${OPTIONS.length - inserted} már létezett).`);
  await conn.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
