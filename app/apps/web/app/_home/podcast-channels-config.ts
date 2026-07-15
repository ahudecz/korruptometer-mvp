export interface PodcastChannelConfig {
  /** Egyedi kulcs, DB-ben (`PodcastVideo.channelSlug`) és configban is ez azonosítja. */
  slug: string;
  /** YouTube @handle — a nyers "UC..." channel ID-t a scrape-youtube job
   *  oldja fel futásidőben a YouTube Data API-val (channels.list?forHandle=),
   *  nem itt van hardkódolva (a handle stabil, kényelmesen kereshető; a
   *  nyers ID kinyerése böngésző nélkül nem volt megbízhatóan lehetséges). */
  handle: string;
  name: string;
  /** Minden videója eleve témába vágó (pl. saját politikusi csatorna, vagy
   *  dedikált korrupciós/oknyomozó szervezet) — kihagyja a kulcsszó/AI
   *  relevancia-kaput, egyenesen topikailag jóváhagyva. */
  alwaysRelevant?: boolean;
  /** Nincs kulcsszó-egyezés esetén AI-osztályozásra megy ("maybe" kupac),
   *  nem eldobásra. Az AI-döntés mindig Telegramra megy jóváhagyásra —
   *  ez a "bizonytalanság" eset, szándékosan emberi kontrollal (eltér a
   *  hír-pipeline néma AI-döntésétől, l. scrape-youtube.ts komment). */
  relevantByDefault?: boolean;
  /** Csatornánkénti nézettségi küszöb — ez alatt a videó topikailag már
   *  jóváhagyott, de a homepage-en nem jelenik meg, amíg el nem éri. Kivétel:
   *  ha a küszöb alatti videót a rendszer "breaking"-nek ítéli (l.
   *  scrape-youtube.ts isBreaking-ellenőrzés), akkor is megy Telegram-
   *  értesítés, hogy kézzel korábban is publikálható legyen. 2026-07-15:
   *  a nagy olvasottságú/vegyes-témájú magazinoknál (Telex/HVG/24/Partizán/
   *  ATV/444) az itt szereplő számok első becslések — a valódi
   *  nézettség-eloszlást csak a YOUTUBE_API_KEY bekötése után lehet
   *  látni, onnantól finomíthatók. */
  viewThreshold: number;
}

export const PODCAST_CHANNELS: PodcastChannelConfig[] = [
  // ── Saját politikusi csatornák — minden videó eleve témába vágó ──────────
  {
    slug: 'juhasz-peter',
    handle: '@juhaszpetervideo',
    name: 'Juhász Péter | Juhi',
    alwaysRelevant: true,
    viewThreshold: 0,
  },
  {
    slug: 'tompos-marton',
    handle: '@TomposMartonMomentum',
    name: 'Tompos Márton',
    alwaysRelevant: true,
    viewThreshold: 0,
  },
  {
    slug: 'tordai-bence',
    handle: '@Tordai_Bence',
    name: 'Tordai Bence',
    alwaysRelevant: true,
    viewThreshold: 0,
  },
  {
    slug: 'jambor-andras',
    handle: '@jambor.andras.kepviselo',
    name: 'Jámbor András',
    alwaysRelevant: true,
    viewThreshold: 0,
  },
  {
    slug: 'molnar-aron',
    handle: '@MolnárÁronYoutube',
    name: 'Molnár Áron',
    alwaysRelevant: true,
    viewThreshold: 0,
  },

  // ── Korrupció-/oknyomozó watchdog szervezetek — minden videó eleve témába vágó ──
  {
    slug: 'direkt36',
    handle: '@direkt3634',
    name: 'Direkt36',
    alwaysRelevant: true,
    viewThreshold: 0,
  },
  {
    slug: 'atlatszo',
    handle: '@Atlatszovideo',
    name: 'Átlátszó',
    alwaysRelevant: true,
    viewThreshold: 0,
  },
  {
    slug: 'k-monitor',
    handle: '@k-monitor',
    name: 'K-Monitor',
    alwaysRelevant: true,
    viewThreshold: 0,
  },

  // ── Politikai szatíra / elemző műsorok — kulcsszó+AI kapu, alacsony volumen ──
  {
    slug: 'otpontban',
    handle: '@otpontban',
    name: 'Ötpontban',
    relevantByDefault: true,
    viewThreshold: 0,
  },
  {
    slug: 'gulyasagyu',
    handle: '@gulyasagyumedia',
    name: 'Gulyáságyú',
    relevantByDefault: true,
    viewThreshold: 0,
  },
  {
    slug: 'fokuszcsoport',
    handle: '@fokuszcsoport',
    name: 'Fókuszcsoport',
    relevantByDefault: true,
    viewThreshold: 0,
  },
  {
    slug: 'pottyondy-edina',
    handle: '@pottyondyedina',
    name: 'Pottyondy Edina',
    relevantByDefault: true,
    viewThreshold: 0,
  },
  {
    slug: 'magyarorszag-kedvenc-musora',
    handle: '@magyarorszagkedvencmusora',
    name: 'Magyarország Kedvenc Műsora',
    relevantByDefault: true,
    viewThreshold: 0,
  },
  {
    slug: 'testbeszed',
    handle: '@Testbeszed',
    name: 'Testbeszéd',
    relevantByDefault: true,
    viewThreshold: 0,
  },
  {
    slug: 'magyar-hang',
    handle: '@magyarhang',
    name: 'Magyar Hang',
    relevantByDefault: true,
    viewThreshold: 0,
  },
  {
    slug: 'heti-naplo',
    handle: '@HetiNaplo',
    name: 'Heti Napló',
    relevantByDefault: true,
    viewThreshold: 0,
  },
  {
    slug: 'merce',
    handle: '@mercehu',
    name: 'Mérce',
    relevantByDefault: true,
    viewThreshold: 0,
  },
  {
    slug: 'valasz-online',
    handle: '@valaszonline',
    name: 'Válasz Online',
    relevantByDefault: true,
    viewThreshold: 0,
  },
  {
    slug: 'szabad-europa',
    handle: '@szabad-europa',
    name: 'Szabad Európa',
    relevantByDefault: true,
    viewThreshold: 0,
  },

  // ── Nagy olvasottságú / vegyes témájú magazinok — kulcsszó+AI kapu, magasabb küszöb ──
  {
    slug: 'kontroll',
    handle: '@kontrollhu',
    name: 'Kontroll',
    relevantByDefault: false,
    viewThreshold: 50000,
  },
  {
    slug: 'partizan',
    handle: '@Partizánmédia',
    name: 'Partizán',
    relevantByDefault: true,
    viewThreshold: 50000,
  },
  {
    slug: 'atv',
    handle: '@ATVmagyarorszag',
    name: 'ATV',
    relevantByDefault: true,
    viewThreshold: 50000,
  },
  {
    slug: '444',
    handle: '@negynegynegy',
    name: '444',
    relevantByDefault: true,
    viewThreshold: 125000,
  },
  {
    slug: 'telex',
    handle: '@Telexponthu',
    name: 'Telex',
    relevantByDefault: true,
    viewThreshold: 100000,
  },
  {
    slug: 'hvg',
    handle: '@HVGonline',
    name: 'HVG Videó',
    relevantByDefault: true,
    viewThreshold: 75000,
  },
  {
    slug: '24hu',
    handle: '@24ponthu',
    name: '24.hu',
    relevantByDefault: true,
    viewThreshold: 75000,
  },
];
