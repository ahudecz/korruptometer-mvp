import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });
import postgres from 'postgres';
import { assertWriteTarget } from './guard';

/**
 * 2026-11-17: az Anthropic API-kredit 2026-11-06 22:02 óta elfogyott, az LLM-
 * detektorok nem futottak. A kiesés óta beérkezett 461 cikket Claude Code
 * kézzel nézte át; a user az összes alábbi tételt jóváhagyta ("mind", a 9-es
 * felmentés). Minden adat a megadott forrásokból, forrásban nem igazolt adat
 * nincs benne (l. feedback-no-invented-data). Idempotens: név+dátum alapján
 * nem szúr be duplán, a frissítéseknél ellenőrzi, hogy a kiegészítés már bent van-e.
 */

type Verdict = {
  personName: string; position: string; crimes: string[]; verdictType: string; sentenceLabel: string | null;
  verdictDate: string; court: string; summary: string; description: string;
  sources: { url: string; name: string; headline: string; date: string }[];
};

const VERDICTS: Verdict[] = [
  {
    personName: 'Orbán Áron',
    position: 'Orbán Viktor volt miniszterelnök öccse',
    crimes: ['embercsempészet'],
    verdictType: 'előzetesben',
    sentenceLabel: null,
    verdictDate: '2026-11-11T00:00:00Z',
    court: 'Budai Központi Kerületi Bíróság',
    summary:
      'Orbán Áront, Orbán Viktor volt miniszterelnök öccsét 2026. november 9-én vették őrizetbe; november 11-én a Budai Központi Kerületi Bíróság egy hónapra elrendelte az ő és élettársa letartóztatását. Az ügyészség szerint 2022-től üzletszerűen, anyagi haszonszerzés céljából legalább száz vietnámi állampolgárnak segítettek az államhatár jogellenes átlépésében; a gyanú üzletszerűen, bűnszövetségben elkövetett embercsempészés. A bíróság a szökés, az elrejtőzés és a bizonyítás befolyásolásának veszélyével indokolt. A vele együtt előállított két másik gyanúsított közül egyet bűnügyi felügyelet alá helyeztek, a negyedik szabadlábon védekezhet. A végzés nem jogerős, védője fellebbezett. Vádemelés nem történt.',
    description: 'Orbán Áron: letartóztatás, embercsempészet',
    sources: [
      { url: 'https://444.hu/2026/11/09/orban-aront-este-a-gyorskocsi-utcai-fogdaba-vittek', name: '444', headline: 'Orbán Áront este a Gyorskocsi utcai fogdába vitték', date: '2026-11-09' },
      { url: 'https://kontroll.hu/cikk/belfold/2026/11/11/letartoztattak-orban-aront-es-az-elettarsat', name: 'Kontroll', headline: 'Letartóztatták Orbán Áront és az élettársát', date: '2026-11-11' },
      { url: 'https://kontroll.hu/cikk/belfold/2026/11/12/orban-aron-uegyvedje-szerint-a-megalapozott-gyanu-sem-all-fenn-fellebbeztek-a-letartoztatas-ellen', name: 'Kontroll', headline: 'Orbán Áron ügyvédje szerint a megalapozott gyanú sem áll fenn, fellebbeztek a letartóztatás ellen', date: '2026-11-12' },
    ],
  },
  {
    personName: 'B. Tamás (Bolcsik Zoltán fia)',
    position: 'Bolcsik Zoltán volt rendészeti államtitkár fia',
    crimes: ['költségvetési csalás'],
    verdictType: 'előzetesben',
    sentenceLabel: null,
    verdictDate: '2026-11-12T00:00:00Z',
    court: 'Ismeretlen bíróság (a Fővárosi Törvényszék szóvivője közölte)',
    summary:
      'Bolcsik Zoltán volt rendészeti államtitkár, Pintér Sándor egykori bizalmasa fiát a NAV 2026. november 10-én vette őrizetbe egy számlagyáras ügyben; november 12-én a bíróság egy hónapra elrendelte a letartóztatását. A gyanú bűnszervezetben és felbujtóként elkövetett, különösen jelentős vagyoni hátrányt okozó költségvetési csalás és más bűncselekmények: a NAV szerint az általa irányított, őrzésvédelemmel és takarítással foglalkozó bűnszervezet több mint másfél milliárd forint vagyoni hátrányt okozott. Vádemelés nem történt.',
    description: 'Bolcsik Zoltán fia: letartóztatás, költségvetési csalás',
    sources: [
      { url: 'https://telex.hu/belfold/2026/11/10/orizetbe-vettek-bolcsik-zoltan-volt-rendeszeti-allamtitkarnak-fiat', name: 'Telex', headline: 'Őrizetbe vették a Fidesz-kormány egyik államtitkárának a fiát', date: '2026-11-10' },
      { url: 'https://telex.hu/belfold/2026/11/12/elrendeltek-a-volt-allamtitkar-fianak-a-letartoztatasat', name: 'Telex', headline: 'Letartóztatták a Fidesz-kormány egyik államtitkárának a fiát', date: '2026-11-12' },
      { url: 'https://hang.hu/belfold/tul-sokat-tudott-letartoztattak-a-fideszes-rendeszeti-allamtitkar-fiat-193800', name: 'Magyar Hang', headline: 'Túl sokat tudott: letartóztatták a fideszes rendészeti államtitkár fiát', date: '2026-11-12' },
    ],
  },
  {
    personName: 'Filemon Mihály',
    position: 'Nyírmártonfalva volt fideszes polgármestere',
    crimes: ['költségvetési csalás kísérlete', 'hamis magánokirat felhasználása'],
    verdictType: 'vádemelés',
    sentenceLabel: 'vádemelés/meggyanúsítás',
    verdictDate: '2026-11-11T00:00:00Z',
    court: 'Debreceni Járásbíróság',
    summary:
      'Filemon Mihály, Nyírmártonfalva volt fideszes polgármestere ellen 2026 májusában vádat emeltek a lombkoronasétány-ügyben; a büntetőper 2026. november 11-én kezdődött a Debreceni Járásbíróságon. A vád különösen nagy vagyoni hátrányt okozó költségvetési csalás kísérlete és hamis magánokirat felhasználása, 63,89 millió forint támogatással összefüggésben; a vádirat szerint elhallgatta, hogy a sétány építésének idején kivágatták az erdőt. Vádlott-társa egy vállalkozó. Filemon a tárgyaláson tagadta a bűncselekmény elkövetését. Ítélet nem született.',
    description: 'Filemon Mihály: vádemelés, költségvetési csalás kísérlete',
    sources: [
      { url: 'https://444.hu/2026/11/11/lombkoronasetany-filemon-mihaly-nyirmartonfalva-debreceni-jarasbirosag', name: '444', headline: 'Lombkoronasétányos polgármester: Egy erdő attól nem szűnik meg erdőnek lenni, hogy kivágják a fákat', date: '2026-11-11' },
      { url: 'https://kontroll.hu/cikk/belfold/2026/11/11/a-lombkoronasetanyos-volt-polgarmester-szerint-fa-nelkuel-se-szunik-meg-az-erdo', name: 'Kontroll', headline: 'A lombkoronasétányos volt polgármester szerint fa nélkül se szűnik meg az erdő', date: '2026-11-11' },
    ],
  },
];

type VerdictUpdate = { personName: string; marker: string; replaceFrom?: string; replaceTo?: string; append?: string; source: { url: string; name: string; headline: string; date: string } };

const UPDATES: VerdictUpdate[] = [
  {
    personName: 'Matolcsy György',
    marker: 'másodfokon helybenhagyta',
    replaceFrom: 'A döntés nem jogerős, fellebbezett. Vádemelés nem történt.',
    replaceTo:
      'A fellebbezést a Fővárosi Törvényszék 2026. november 5-én elutasította, másodfokon helybenhagyta a november 23-ig tartó letartóztatást: a törvényszék szerint egy gyanúsítottnál a büntetőeljárással összefüggő iratokat találtak, és a bizonyítékok megsemmisítésére utaló körülmények is felmerültek. Vádemelés nem történt.',
    source: { url: 'https://444.hu/2026/11/05/felmerultek-a-bizonyitekok-megsemmisitesere-utalo-korulmenyek-is-megerositettek-masodfokon-matolcsy-gyorgy-letartoztatasat', name: '444', headline: '„Felmerültek a bizonyítékok megsemmisítésére utaló körülmények is” – megerősítették másodfokon Matolcsy György letartóztatását', date: '2026-11-05' },
  },
  {
    personName: 'Hankó Balázs',
    marker: 'február 1-jéig',
    append:
      ' Október 28-án a nyomozási bíró három hónappal meghosszabbította a letartóztatását; a fellebbezést november 11-én a Kecskeméti Törvényszék elutasította, így február 1-jéig biztosan letartóztatásban marad. Vádemelés nem történt.',
    source: { url: 'https://telex.hu/belfold/2026/11/11/hanko-balazs-marad-letartoztatasban-bortonben-tolti-karacsonyt-szilvesztert', name: 'Telex', headline: 'Hankó Balázs börtönben tölti a karácsonyt és a szilvesztert', date: '2026-11-11' },
  },
  {
    personName: 'Varga-Bajusz Veronika',
    marker: 'február 1-jéig',
    replaceFrom: 'A döntés ellen ő és védője fellebbezett, erről másodfokon a Kecskeméti Törvényszék dönt.',
    replaceTo:
      'Letartóztatását októberben meghosszabbították; a fellebbezést a Kecskeméti Törvényszék november 11-én elutasította, így február 1-jéig biztosan letartóztatásban marad. Vádemelés nem történt.',
    source: { url: 'https://hvg.hu/itthon/20261111_nka-botrany-hanko-balazs-varga-bajusz-veronika-letartoztatas-fellebbezes-elutasitas', name: 'HVG', headline: 'Elutasították Hankó és Varga-Bajusz fellebbezését, februárig biztosan letartóztatásban maradnak', date: '2026-11-11' },
  },
];

type Res = { name: string; position: string; institution: string; resignationType: string; sector: string; date: string; description: string; url: string; source: string };

const RESIGNATIONS: Res[] = [
  { name: 'Főző Virág', position: 'főigazgató-helyettes', institution: 'Magyar Állami Operaház', resignationType: 'kirúgás', sector: 'kultúra', date: '2026-11-06', description: 'Azonnali hatállyal elbocsátották az Operából', url: 'https://444.hu/2026/11/06/okovacs-szilveszter-helyetteset-is-kirugtak-az-operabol', source: '444' },
  { name: 'Rétvári Bence', position: 'monitoringbizottsági elnök', institution: 'EFOP és EFOP Plusz Monitoring Bizottság', resignationType: 'felmentés', sector: 'közigazgatás', date: '2026-11-06', description: 'Felmentették az EFOP-monitoringbizottság éléről', url: 'https://hvg.hu/gazdasag/20261107_retvari-bence-felmentes-operativ-program-monitoring-bizottsag-szegenyseg', source: 'HVG' },
  { name: 'Schmidt Gábor', position: 'elnök', institution: 'Magyar Kajak-Kenu Szövetség', resignationType: 'lemondás', sector: 'sport és civil szervezetek', date: '2026-11-16', description: 'Lemondott a kajak-kenu szövetség elnöki posztjáról', url: 'https://telex.hu/sport/2026/11/16/schmidt-gabor-lemondas-magyar-kajak-kenu-szovetseg-elnoki-poszt-lemondas', source: 'Telex' },
  { name: 'Timár István Szilveszter', position: 'főigazgató', institution: 'Sándor-palota', resignationType: 'felmentés', sector: 'közigazgatás', date: '2026-11-16', description: 'Megszűnt a Sándor-palota főigazgatói megbízatása', url: 'https://444.hu/2026/11/16/baka-andras-elso-allamfoi-dontese-volt-hivatalvezetot-csinalni-sulyok-tamas-foigazgatojabol-aki-most-tavozik', source: '444' },
];

async function main() {
  assertWriteTarget('backfill-llm-outage-2026-11-17');
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

  for (const v of VERDICTS) {
    const dup = await sql`SELECT id FROM "CourtVerdict" WHERE "personName" = ${v.personName} AND "verdictType" = ${v.verdictType} AND "verdictDate"::date = ${v.verdictDate}::date`;
    if (dup.length) { console.log(`= CourtVerdict már bent: ${v.personName}`); continue; }
    const [r] = await sql`
      INSERT INTO "CourtVerdict" ("personName", position, crimes, "sentenceYears", "sentenceLabel", "verdictType", "verdictDate", court, summary, description,
        "sourceUrls", "sourceNames", "sourceHeadlines", "sourceDates", "reviewStatus", "createdAt", "updatedAt")
      VALUES (${v.personName}, ${v.position}, ${v.crimes}, 0, ${v.sentenceLabel}, ${v.verdictType}, ${v.verdictDate}, ${v.court}, ${v.summary}, ${v.description},
        ${v.sources.map((s) => s.url)}, ${v.sources.map((s) => s.name)}, ${v.sources.map((s) => s.headline)}, ${v.sources.map((s) => s.date)}, 'approved', now(), now())
      RETURNING id`;
    console.log(`+ CourtVerdict ${v.personName} [${r!.id}]`);
  }

  for (const u of UPDATES) {
    const rows = await sql<{ id: string; summary: string; sourceUrls: string[] }[]>`SELECT id, summary, "sourceUrls" FROM "CourtVerdict" WHERE "personName" = ${u.personName} AND "verdictType" = 'előzetesben' AND "reviewStatus" = 'approved'`;
    if (rows.length !== 1) { console.log(`! ${u.personName}: ${rows.length} sor, kihagyva`); continue; }
    const row = rows[0]!;
    if (row.summary.includes(u.marker)) { console.log(`= ${u.personName}: már frissítve`); continue; }
    let summary = row.summary;
    if (u.replaceFrom) {
      if (!summary.includes(u.replaceFrom)) { console.log(`! ${u.personName}: a cserélendő mondat nincs meg, kihagyva`); continue; }
      summary = summary.replace(u.replaceFrom, u.replaceTo!);
    } else {
      summary = summary + u.append!;
    }
    const addSrc = !row.sourceUrls.includes(u.source.url);
    await sql`
      UPDATE "CourtVerdict" SET summary = ${summary}, "updatedAt" = now(),
        "sourceUrls" = CASE WHEN ${addSrc} THEN array_append("sourceUrls", ${u.source.url}) ELSE "sourceUrls" END,
        "sourceNames" = CASE WHEN ${addSrc} THEN array_append("sourceNames", ${u.source.name}) ELSE "sourceNames" END,
        "sourceHeadlines" = CASE WHEN ${addSrc} THEN array_append("sourceHeadlines", ${u.source.headline}) ELSE "sourceHeadlines" END,
        "sourceDates" = CASE WHEN ${addSrc} THEN array_append("sourceDates", ${u.source.date}) ELSE "sourceDates" END
      WHERE id = ${row.id}`;
    console.log(`~ CourtVerdict frissítve: ${u.personName}`);
  }

  for (const r of RESIGNATIONS) {
    const dup = await sql`SELECT id FROM "PoliticalResignation" WHERE name = ${r.name} AND institution = ${r.institution}`;
    if (dup.length) { console.log(`= Lemondás már bent: ${r.name}`); continue; }
    const [row] = await sql`
      INSERT INTO "PoliticalResignation" (name, position, institution, "resignationType", "resignationDate", description, pinned, "sourceUrls", "sourceNames", "reviewStatus", sector, "createdAt", "updatedAt")
      VALUES (${r.name}, ${r.position}, ${r.institution}, ${r.resignationType}, ${r.date}, ${r.description}, false, ${[r.url]}, ${[r.source]}, 'approved', ${r.sector}, now(), now())
      RETURNING id`;
    console.log(`+ Lemondás ${r.name} [${row!.id}]`);
  }

  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
