/**
 * A 30 szavazó-opció közül azokhoz, amelyeknek van egyértelműen
 * kapcsolódó kiemelt ügy- (`/ugyek/[id]`) vagy kiemelt személy-oldala
 * (`/galeria/[id]`), egy "Nézd meg az ügy legfrissebb híreit" link az
 * eredmény-nézetben (user kérés, 2026-09-02). Kézzel, cím szerint
 * feltérképezve — csak ott, ahol a kapcsolat egyértelmű, nem
 * találgatás (pl. "EU-s pénzek legnagyobb kedvezményezettjei" nem kap
 * linket, mert nincs neki dedikált oldala).
 */
export const POLL_OPTION_LINKS: Record<string, string> = {
  'Lázár János megmagyarázhatatlan vagyonosodása': '/galeria/lazar-janos',
  'MNB-alapítványok / Matolcsy-kör / Pallas Athéné': '/ugyek/mnb-botrany',
  '2020-as lélegeztetőgép-beszerzések': '/ugyek/lelegeztetogep',
  'Elios / Tiborcz / közvilágítás': '/galeria/tiborcz-istvan',
  'Hatvanpuszta és a vagyonosodási lánc': '/ugyek/hatvanpuszta',
  'Autópálya-koncessziók': '/galeria/meszaros-lorinc',
  'Mátrai Erőmű': '/galeria/meszaros-lorinc',
  'Várnegyed és állami ingatlanprojektek': '/galeria/lazar-janos',
  'Parkfenntartási kenőpénzbotrány': '/ugyek/parkfenntartas',
  'Bánki Erik Volvo-gate (Pécs)': '/volvo-gate',
  'Rogán-kör kommunikációs megbízásai': '/galeria/rogan-antal',
  'Nemzeti Kulturális Alap pénzosztási rendszere': '/ugyek/nka-botrany',
  'Az MNB teljes Matolcsy-korszaka': '/galeria/matolcsy-gyorgy',
};
