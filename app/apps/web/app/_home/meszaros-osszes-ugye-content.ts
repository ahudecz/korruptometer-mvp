import type { DescriptionBlock } from './ugyek-config';

/**
 * Curated top-10 write-ups for the "Mészáros Lőrinc összes ügye" rollup page.
 * Keyed by ScandalCatalog id so the page can join it against a live DB query
 * (rank/damage/name always come from the DB — only the paragraph + citation
 * are editorial). If a top-10 slot's id has no entry here, the page falls
 * back to a plain card (name/institution/damage/link only).
 *
 * Sources verified against local KmdbArticle (K-Monitor sajtóadatbázis).
 */
export interface MeszarosCaseWriteup {
  id: string;
  blocks: DescriptionBlock[];
}

export const MESZAROS_TOP_CASES: MeszarosCaseWriteup[] = [
  {
    id: 'felcsut-tao-alapitvany',
    blocks: [
      {
        type: 'text',
        content:
          'A Felcsúti Utánpótlás Neveléséért Alapítvány — Orbán Viktor gyerekkori klubja — tíz év alatt 158,9 milliárd forintnyi társasági-adó-kedvezményes (TAO) támogatást kapott, ezzel az NB I. harmadik legnagyobb költségvetéséből gazdálkodik egy vidéki egyesület. A pénz jelentős része a klub körüli cégeken (köztük Mészáros-érdekeltségeken) keresztül csapódott le, miközben az elszámolás átláthatósága évek óta vitatott.',
      },
      {
        type: 'article-card',
        source: '444',
        headline: 'Tíz év alatt 158,9 milliárd forint ment a felcsúti fociba',
        date: '2026-04-10',
        url: 'https://444.hu/2026/04/10/tiz-ev-alatt-1589-milliard-forint-ment-a-felcsuti-fociba',
        lead: 'Az NB I. harmadik legnagyobb költségvetésével gazdálkodik a felcsúti foci. Van is miből fizetni az átlagosan havi bruttó 3,7 milliós fizetést.',
      },
    ],
  },
  {
    id: '4ig-univerzum-allami-tamogatas',
    blocks: [
      {
        type: 'text',
        content:
          'A 4iG — amelynek egyik alapítója, Jászai Gellért, Mészáros bankjától (MBH) vett fel hitelt a cégvásárlásokhoz — előbb ingyen jutott hozzá az állami Antenna Hungária egy részéhez, majd az abból leválasztott műsorszóró üzletágat 72 milliárd forintért adta el vissza az államnak. A kör így zárult: állami vagyon → magánkézbe → majd busásan vissza az államnak, jelentős extraprofittal a közbenső szereplőknél.',
      },
      {
        type: 'article-card',
        source: '444',
        headline: 'Összesen 72 milliárdot fizethet a 4iG műsorszóró cégéért az állam, Mészáros Lőrinc bankjától is vettek fel hitelt',
        date: '2025-12-11',
        url: 'https://444.hu/2025/12/11/osszesen-72-milliardot-fizethet-a-4ig-musorszoro-cegeert-az-allam-meszaros-lorinc-bankjatol-is-vettek-fel-hitelt',
        lead: 'Jászai Gellért úgy tett szert a most az államnak eladott cégre, hogy apport révén megszerezte az állami Antenna Hungária döntő részét, abból leválasztotta és külön cégbe szervezte a műsorszóró üzletágat, amit 72 milliárd forintért tovább-, azaz visszaadott.',
      },
    ],
  },
  {
    id: 'meszaros-vasuti-beruhasas-r-kord',
    blocks: [
      {
        type: 'text',
        content:
          'Mészáros vasútépítő cégei (köztük az R-Kord Kft.) éveken át dokumentáltan hibás, valótlan jegyzőkönyvekkel igazolt munkát számláztak ki a MÁV-nak: vas nélküli vasbeton, el nem készült korszerűsítések, ki nem fizetett alvállalkozók. A Szabad Európa térképre gyűjtött vasúti projektjei alapján a K-Monitor 60 milliárd forintos nagyságrendben azonosította a vitatott közpénzt.',
      },
      {
        type: 'article-card',
        source: 'Szabad Európa',
        headline: 'Térképre tettük Mészáros Lőrinc összes eddig megtalált vitatott vasúti beruházását',
        date: '2024-07-11',
        url: 'https://www.szabadeuropa.hu/a/terkepre-tettuk-meszaros-lorinc-osszes-eddig-megtalalt-necces-vasuti-beruhazasat/33028232.html',
        lead: 'Vas nélküli vasbeton; valótlan tartalmú jegyzőkönyvek alapján átvett és kifizetett, el nem készült korszerűsítés; ki nem fizetett alvállalkozók, ötmilliárdból „meggyorsított”, később befejeződő felújítás – mindez természetesen rengeteg és annál is több közpénzért.',
      },
    ],
  },
  {
    id: 'meszaros-matrai-gazeromu-elsewedy',
    blocks: [
      {
        type: 'text',
        content:
          'Mészáros nyerte az MVM mátrai gázerőmű-építési tenderjét egy egyiptomi partnerrel (Elsewedy Electric) és a West Hungária Bauval közösen — miközben a másik ajánlattevő, Garancsi István cége érvénytelen ajánlatot adott be. A szerződés végleges értéke 52 milliárd forint volt; a kérdés, mennyivel volt magasabb ez a versenyeztetett piaci árnál.',
      },
      {
        type: 'article-card',
        source: 'HVG',
        headline: 'Mészáros Lőrinc nyerte a mátrai gázerőmű építésére kiírt tendert, Garancsi István érvénytelen ajánlatot adott be',
        date: '2025-01-23',
        url: 'https://hvg.hu/gazdasag/20250123_Meszaros-Lorinc-nyerte-a-matrai-gazeromu-epitesere-kiirt-tendert',
        lead: '6 milliárd forintos keretösszeg mellett foghat neki az építkezésnek egy egyiptomi partnerrel és a West Hungária Bauval közösen.',
      },
    ],
  },
  {
    id: 'meszaros-vasut-allomas-katonai-milliard-itm',
    blocks: [
      {
        type: 'text',
        content:
          'A HVG számítása szerint a vasútépítésben az átlagos profitráta 8,5 százalék körül mozog — ezzel szemben a pályafenntartási munkák jelentős részét bezsebelő V-Híd és egy szinte kizárólag a MÁV-nak dolgozó kft. 27–29 százalékos profitrátát ért el 2020 és 2024 között. Ha a normál piaci rátával számoltak volna, mintegy 120 milliárd forinttal több maradt volna a rendszerben — ennek egy konzervatív, dokumentált szelete az 50 milliárd forintos becslés.',
      },
      {
        type: 'article-card',
        source: 'HVG',
        headline: 'Mészáros Lőrinc több tízmilliárd forint extraprofitot talicskázott ki a magyar vasútból',
        date: '2025-09-17',
        url: 'https://hvg.hu/kkv/20250917_Meszaros-Lorinc-tobb-tizmilliard-forint-extraprofitot-talicskazott-ki-a-magyar-vasutbol',
        lead: 'A vasútépítésben az átlagos profitráta 8,5 százalék, de pályafenntartási munkák közel felét bezsebelő V-Híd, és egy, szinte csak a MÁV-nak dolgozó kft 27-29 százalékot ért el 2020-2024 között. Ha a normál profitrátával dolgoztak volna, mintegy 120 milliárd forinttal több maradt volna a rendszerben.',
      },
    ],
  },
  {
    id: 'szij-duna-aszfalt',
    blocks: [
      {
        type: 'text',
        content:
          'A mohácsi Duna-híd és a hozzá kapcsolódó útépítések (Duna Aszfalt Zrt., Szíjj László cége) a tervezetthez képest sokszorosára duzzadt költségvetéssel épülnek — a kormány 2026 tavaszán további 76 milliárd forintot adott a projekthez, amely így közelít az 500 milliárd forinthoz egy olyan hídon, amelyet a becslések szerint napi néhány száz autó fog használni.',
      },
      {
        type: 'article-card',
        source: '444',
        headline: 'Újabb 76 milliárdot adna a kormány a már így is rekorddrága mohácsi Duna-híd útjainak az építésére',
        date: '2026-04-11',
        url: 'https://444.hu/2026/04/11/ujabb-76-milliardot-adna-a-kormany-a-mar-igy-is-rekorddraga-mohacsi-duna-hid-utjainak-az-epitesere',
        lead: 'Közeledünk az 500 milliárdhoz egy olyan projekten, amit napi 600 autó fog használni.',
      },
    ],
  },
  {
    id: 'meszaros-tigaz-met-energia',
    blocks: [
      {
        type: 'text',
        content:
          'A Tigáz gázszolgáltatót az állam kényszerhelyzetben, áron alul adta el a MET csoportnak — a becslések szerint 40 milliárd forintos veszteséggel az állami költségvetés számára. A tranzakció után a MET és a Mészáros-birodalom stratégiai együttműködésbe kezdett a magyar energiapiacon.',
      },
      {
        type: 'article-card',
        source: 'Index',
        headline: 'Nem a Tigáz volt az utolsó - a MET és a Mészáros-birodalom közös tervei',
        date: '2019-07-19',
        url: 'https://index.hu/gazdasag/2019/07/19/nem_a_tigaz_volt_az_utolso_-_a_met_es_a_meszaros-birodalom_kozos_tervei/',
        lead: 'Először úgy tűnt, hogy csak a Tigáz tulajdonlására állt össze a MET és a Mészáros-csoport, de láthatóan komolyabb tartalma is lehet a stratégiai együttműködésnek.',
      },
    ],
  },
  {
    id: 'meszaros-mbh-bank-korrupcios',
    blocks: [
      {
        type: 'text',
        content:
          'Hadházy Ákos szerint mintegy 50 milliárd forintnyi közpénz veszett köddé a Mészáros-érdekeltségű MBH Banknál egy állami részvényértékesítés során — az ügyben a képviselő az MNB-hez és a Nemzetgazdasági Minisztériumhoz fordult. Az MBH Bank az elmúlt években Mészáros pénzügyi birodalmának központi elemévé vált, több más, kisebb visszaélési gyanúval (részvénybónuszok, tulajdonosváltások) is összefonódva.',
      },
      {
        type: 'article-card',
        source: '24.hu',
        headline: 'Köddé vált 50 milliárdnyi közpénz a Mészáros-féle MBH Banknál',
        date: '2025-11-19',
        url: 'https://24.hu/fn/gazdasag/2025/11/19/mbh-bank-meszaros-lorinc-tozsde-bankholding-hadhazy-akos-reszveny/',
        lead: 'Az ügyben Hadházy Ákos az MNB-hez és az NGM-hez fordult.',
      },
    ],
  },
  {
    id: 'meszaros-nemzeti-kozszolgalati-egyetem',
    blocks: [
      {
        type: 'text',
        content:
          'A Mészáros tulajdonában álló ZÁÉV nyerte el a Nemzeti Közszolgálati Egyetem 34 milliárd forintos bővítését egy tárgyalásos (nem nyílt) közbeszerzési eljárásban, mindössze két ajánlattevő közül. Az új épületegyüttesben a Katasztrófavédelmi és a Nemzetbiztonsági Intézet kap helyet — egy 7 ezer négyzetméteres, díszmedencés „Exclusive kert” társaságában.',
      },
      {
        type: 'article-card',
        source: 'atlatszo.hu',
        headline: 'Mészáros Lőrinc cége 34 milliárdért bővíti a Nemzeti Közszolgálati Egyetemet',
        date: '2024-04-18',
        url: 'https://atlatszo.hu/kozpenz/2024/04/18/meszaros-lorinc-cege-34-milliardert-boviti-a-nemzeti-kozszolgalati-egyetemet/',
        lead: 'A kivitelezőt tárgyalásos eljárásban kereste az egyetem, és végül két ajánlattevőből a Mészáros Lőrinc tulajdonában álló ZÁÉV nyerte el a megbízást.',
      },
    ],
  },
];

export function getMeszarosWriteup(id: string): DescriptionBlock[] | null {
  return MESZAROS_TOP_CASES.find((c) => c.id === id)?.blocks ?? null;
}
