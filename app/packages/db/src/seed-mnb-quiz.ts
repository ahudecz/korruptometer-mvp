/**
 * Kvíz-rendszer — első, teszt-tartalomként betöltött kvíz: az MNB-
 * alapítványi (Matolcsy-kör) botrányról. A kérdéssorrend nehézség szerint
 * fokozódik. A pontos számadatok, ahol a projekt más részén (a szavazás
 * MNB-opciója, cross-promo/ugyek-config UGYEK-bejegyzése) már rögzítve
 * vannak, onnan egyeznek (266,4 Mrd induló vagyon, 13 Mrd maradt 2024
 * végén, ÁSZ-feljelentés + rendőrségi nyomozás) — a többi a user saját,
 * szabadon megfogalmazható kérése szerinti, tabloid hangvételű kvíz-
 * tartalom, nem különállóan forrásolt tényállítás — KIVÉVE a Porsche-
 * kérdést, ami az Átlátszó cikkére (linkUrl) épül, és a "ki mondta
 * »elvesztette közpénz jellegét«" kérdést, ahol a user 2026-09-03-án
 * explicit jelezte, hogy a köztudatban Kósa Lajoshoz kötött mondatot
 * valójában Bánki Erik mondta.
 *
 * Idempotens: a Quiz a `slug`-on `onConflictDoNothing`-gal megy be; a
 * QuizQuestion sorokat mindig törli és újra beszúrja a kvízhez tartozóan —
 * ez engedi, hogy a kérdés-szöveget utólag finomítani lehessen anélkül,
 * hogy az onConflict-egyezés miatt a régi szöveg beragadna.
 *
 * Használat: pnpm --filter @korr/db exec tsx src/seed-mnb-quiz.ts
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

const QUIZ = {
  slug: 'mnb-bankrablas',
  title: 'Lehetnél te a Vagyonvisszaszerzési Hivatal legfőbb ügyésze?',
  intro:
    'Nézzük, mennyit tudsz az MNB-alapítványi botrányról — a Matolcsy-kör körüli ügyről, amiben eddig kiderült sztorik szerint milliárdok tűntek el nyomtalanul, rejtélyes befektetésekben és külföldi kitérőkön. 10 kérdés, egyre nehezebb — kezdjük!',
  coverImageUrl: '/images/persons/matolcsy-gyorgy.png',
  coverImageCaption: 'Matolcsy György',
  tiers: [
    { minScore: 0, maxScore: 3, title: 'Sajnos elbuknál egy felvételin', description: 'Ne aggódj, a Hivatalnak is kellenek irodai dolgozók.' },
    { minScore: 4, maxScore: 6, title: 'Nyomozónak felvennének', description: 'Van benned gyanakvás, csak még csiszolódnod kell.' },
    { minScore: 7, maxScore: 9, title: 'Vezető is lehetnél a Hivatalban', description: 'Alaposan követed az ügyet — a részletek se kerülik el a figyelmed.' },
    { minScore: 10, maxScore: 10, title: 'Tökéletes főügyész-jelölt', description: 'Mindent tudsz. Az NVVH-nak szüksége van rád.' },
  ],
  outroVideoId: 'bgA0PTDFKlY',
  outroVideoIntro: 'Akármi is az eredményed, nézd meg, hogy hol tart az ügy másfél év után:',
};

type SeedQuestion = {
  questionText: string;
  options: [string, string, string];
  correctIndex: 0 | 1 | 2;
  explanation?: string;
  explanationWrong?: string;
  imageUrl?: string;
  imageCaption?: string;
  linkUrl?: string;
  linkLabel?: string;
  videoId?: string;
  videoIntro?: string;
};

const QUESTIONS: SeedQuestion[] = [
  {
    questionText: 'Mekkora induló vagyonból indult a botrányba keveredett MNB-alapítvány (PADME)?',
    options: ['160 milliárd Ft', '266,4 milliárd Ft', '500 milliárd Ft'],
    correctIndex: 1,
    explanation: 'A PADME jegybanki alapítvány 266,4 milliárd forintos induló vagyonából mára alig maradt valami.',
    imageUrl: '/images/persons/matolcsy-gyorgy.png',
    imageCaption: 'Matolcsy György',
  },
  {
    questionText: '2024 végére mennyi maradt a PADME alapítvány eredeti vagyonából?',
    options: ['13 milliárd Ft', '90 milliárd Ft', '150 milliárd Ft'],
    correctIndex: 0,
    explanation: 'A vagyon jelentős része eltűnt — pont ez alapozta meg a hűtlen kezelés gyanúját.',
    imageUrl: '/images/quiz/penzvesztes.png',
    linkUrl:
      'https://444.hu/2025/12/22/padme-270-milliard-forint-uszott-el-es-amikor-atvettek-csak-9-millio-volt-a-jegybanki-alapitvany-kasszajaban',
    linkLabel: 'A teljes cikk elolvasása (444)',
  },
  {
    questionText: 'Ki mondta a híres "elvesztette közpénz jellegét" mondatot, ami megágyazott a jegybanki vagyon alapítványba adásának?',
    options: ['Matolcsy György', 'Kósa Lajos', 'Bánki Erik'],
    correctIndex: 2,
    explanation:
      'Ez volt a csavar! A mém-mondatot mindenki Kósa Lajoshoz köti, pedig valójában Bánki Erik mondta. Amíg itt vagy, nézd meg Kósa saját, legendás magyarázatát is:',
    explanationWrong:
      'Igen, tudom, hogy ez meglepő, mert Kósa híres elmagyarázós videójából lett mém, de magát a mondatot Bánki Erik mondta. De ne búsulj, nézd inkább vissza ezt az epic 3 percet:',
    imageUrl: '/images/persons/kosa_lajos_mfor.hu.png',
    imageCaption: 'Kósa Lajos',
    videoId: 'IlPwGx3xZ3Y',
  },
  {
    questionText: 'Ki nyújtotta be azt a törvényjavaslatot, ami lehetővé tette az MNB vagyonának alapítványba adását?',
    options: ['Lázár János', 'Bánki Erik', 'Varga Mihály'],
    correctIndex: 1,
    explanation: 'Bánki Erik neve azóta a legtöbb MNB-botrányos cikkben felbukkan.',
    imageUrl: '/images/persons/banki-erik.png',
    imageCaption: 'Bánki Erik',
  },
  {
    questionText: 'Melyik ország alapkezelőinél kötöttek ki jelentős összegek az alapítványi vagyonból?',
    options: ['Svájc', 'Liechtenstein', 'Luxemburg'],
    correctIndex: 0,
    explanation: 'Svájci alapkezelők kaptak megbízást a vagyon egy részének kezelésére — az átláthatóság itt is szinte a nullával egyenlő.',
    imageUrl: '/images/quiz/terkep.png',
  },
  {
    questionText: 'Elsősorban mibe fektették az alapítványi vagyon jelentős részét a hagyományos befektetések helyett?',
    options: ['Kriptovalutába', 'Ingatlanportfóliókba', 'Aranyrudakba'],
    correctIndex: 1,
    explanation: 'Ingatlanportfóliók és egyéb nehezen átlátható eszközök vitték el a vagyon nagy részét.',
    imageUrl: '/images/quiz/ingatlan-kripto.png',
  },
  {
    questionText: 'Melyik fideszes politikus mondta az ATV-ben Kálmán Olga felvetésére, hogy megpróbálták eltitkolni az MNB gazdálkodását, azt, hogy "De sikerült?"',
    options: ['Kovács Zoltán', 'Kósa Lajos', 'Németh Szilárd'],
    correctIndex: 0,
    explanation: 'Kovács Zoltán önironikus (vagy inkább öngólos) mondata azóta is az egyik legidézettebb pillanat az ügyben.',
    imageUrl: '/images/quiz/kovacs-zoltan.png',
    imageCaption: 'Kovács Zoltán',
    videoId: 'uir4XOACdcs?start=1016',
    videoIntro: 'Nézd vissza a klasszikust:',
  },
  {
    questionText: 'Nagyjából mennyi közpénz jutott a Kecskeméti egyetemnek az MNB-közeli alapítványi hálózatból?',
    options: ['45 milliárd Ft', '127 milliárd Ft', '300 milliárd Ft'],
    correctIndex: 1,
    explanation: 'A Kecskeméti egyetem az egyik legnagyobb kedvezményezett volt az alapítványi pénzek elosztásánál.',
  },
  {
    questionText: 'Vélhetően Dubajba menekítve, legalább hány darabos Porsche-gyűjteménye lehet Matolcsy Ádámnak, aki a gyanú szerint kezelte a pénzt?',
    options: ['2 darab', '4 darab', '8 darab'],
    correctIndex: 1,
    explanation: 'Az Átlátszó nyomozása szerint Matolcsy Ádám legalább 4 db Porsche 911-es modellt gyűjtött.',
    imageUrl: '/images/quiz/matolcsy-adam-porsche.png',
    imageCaption: 'Fotó: Átlátszó',
    linkUrl: 'https://atlatszo.hu/kozpenz/2019/04/23/matolcsy-adam-porsche-911-targakat-gyujt/',
    linkLabel: 'A teljes cikk elolvasása',
  },
  {
    questionText: 'A Kecskeméti egyetemnek juttatott 127 milliárdhoz köthető Szemereyné Pataki Klaudia áll-e rokoni kapcsolatban Matolcsy Györggyel?',
    options: [
      'Nem, semmilyen kapcsolat nincs köztük',
      'Igen, távoli rokonok — a férje Matolcsy másod-unokatestvére',
      'Igen, de csak nagyon áttételesen — a testvére sógorának a húga',
    ],
    correctIndex: 1,
    explanation:
      'Szemereyné Pataki Klaudia férje Matolcsy György másod-unokatestvére — így Szemereyné házasság révén Matolcsy távoli rokonságához tartozik.',
    imageUrl: '/images/quiz/szemereyne-pataki-klaudia.png',
    imageCaption: 'Szemereyné Pataki Klaudia',
  },
];

async function main() {
  assertWriteTarget('seed-mnb-quiz');

  const [quiz] = await db
    .insert(schema.quizzes)
    .values(QUIZ)
    .onConflictDoNothing({ target: schema.quizzes.slug })
    .returning();

  let quizRow = quiz;
  if (!quizRow) {
    // Már létezik — frissítsük az outro-videót és introt is, ne csak a
    // kérdéseket (a slug-egyezés miatt az insert fentebb kimaradt).
    [quizRow] = await db
      .update(schema.quizzes)
      .set({
        title: QUIZ.title,
        intro: QUIZ.intro,
        tiers: QUIZ.tiers,
        coverImageUrl: QUIZ.coverImageUrl,
        coverImageCaption: QUIZ.coverImageCaption,
        outroVideoId: QUIZ.outroVideoId,
        outroVideoIntro: QUIZ.outroVideoIntro,
      })
      .where(eq(schema.quizzes.slug, QUIZ.slug))
      .returning();
  }

  if (!quizRow) throw new Error('Quiz seed/lookup failed');

  console.log(`Quiz: ${quizRow.slug} (${quizRow.id})`);

  await db.delete(schema.quizQuestions).where(eq(schema.quizQuestions.quizId, quizRow.id));

  for (let i = 0; i < QUESTIONS.length; i++) {
    const q = QUESTIONS[i]!;
    await db.insert(schema.quizQuestions).values({
      quizId: quizRow.id,
      displayOrder: i + 1,
      questionText: q.questionText,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation ?? null,
      explanationWrong: q.explanationWrong ?? null,
      imageUrl: q.imageUrl ?? null,
      imageCaption: q.imageCaption ?? null,
      linkUrl: q.linkUrl ?? null,
      linkLabel: q.linkLabel ?? null,
      videoId: q.videoId ?? null,
      videoIntro: q.videoIntro ?? null,
    });
  }

  console.log(`QuizQuestion: ${QUESTIONS.length} kérdés beszúrva.`);
  await conn.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
