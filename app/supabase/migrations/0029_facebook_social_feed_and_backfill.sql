-- ============================================================================
-- 0029 — Facebook social feed + NKA/médiaváltozás backfill (KONSZOLIDÁLT)
-- ----------------------------------------------------------------------------
-- Ez a migráció egyetlen, idempotens scriptbe vonja össze a
-- 002-make-facebook-social-feed branch öt különálló migrációját, miután a
-- main (investigation-engine) beolvadt és a sorszámok 0028-ig elhasználódtak:
--
--   0016_social_post_hidden        → SocialPost: hidden, imageUrl, postUrl unique
--   0017_facebook_pages            → FacebookPage tábla + index
--   0018_facebook_pages_seed       → 21 Facebook oldal
--   0019_megafon_closure           → Megafon megszűnés (MediaClosure)
--   0020_backfill_orban_ughy       → Orbán Balázs lemondás + Ughy Attila előzetes
--   0021_nka_pretrial_backfill     → NKA 5 további előzetes
--
-- A régi fájlokat NEM töröljük (megmaradnak hivatkozásként). Ez a script a
-- forrás-igazság: minden blokk a main által létrehozott táblákra épül
-- (SocialPost=0026, MediaClosure/PoliticalResignation=0014, CourtVerdict=0028),
-- és teljesen idempotens (IF NOT EXISTS / ON CONFLICT / WHERE NOT EXISTS),
-- így bármikor újrafuttatható duplikálás nélkül.
-- ============================================================================


-- ─── 1. SocialPost kiegészítések (0016) ─────────────────────────────────────
-- A main 0026_social_posts.sql létrehozza a táblát, de ezek hiányoznak belőle.

alter table "SocialPost" add column if not exists "hidden" boolean not null default false;
alter table "SocialPost" add column if not exists "imageUrl" text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'SocialPost_postUrl_unique'
      and conrelid = '"SocialPost"'::regclass
  ) then
    alter table "SocialPost" add constraint "SocialPost_postUrl_unique" unique ("postUrl");
  end if;
end $$;


-- ─── 2. FacebookPage tábla (0017) — csak ezen a branchen létezik ─────────────

create table if not exists "FacebookPage" (
  id uuid primary key default gen_random_uuid(),
  "pageId" text not null unique,
  "pageName" text not null,
  "pageHandle" text,
  enabled boolean not null default true,
  "lastSyncedAt" timestamptz,
  "consecutiveFailures" integer not null default 0,
  "createdAt" timestamptz not null default now()
);

create index if not exists "FacebookPage_enabled_idx" on "FacebookPage" (enabled);


-- ─── 3. FacebookPage seed (0018) — 21 oldal ─────────────────────────────────

insert into "FacebookPage" ("pageId", "pageName", "pageHandle") values
  ('atlatszo.hu',              'Átlátszó',               'atlatszo.hu'),
  ('molnararonofficial',       'Molnár Áron',            'molnararonofficial'),
  ('peter.magyar.102',         'Magyar Péter',           'peter.magyar.102'),
  ('kapitanyistvan.tisza',     'Kapitány István',        'kapitanyistvan.tisza'),
  ('tarrzoltan.tisza',         'Tárr Zoltán',            'tarrzoltan.tisza'),
  ('vastagbor',                'Vastagbőr',              'vastagbor'),
  ('Juhi.JuhaszPeter',         'Juhász Péter',           'Juhi.JuhaszPeter'),
  ('hadhazyakos',              'Hadházy Ákos',           'hadhazyakos'),
  ('dullszabolcsujsagiro',     'Dull Szabolcs',          'dullszabolcsujsagiro'),
  ('panyiszabolcs',            'Pányi Szabolcs',         'panyiszabolcs'),
  ('61575111935495',           'Maydayhungary',          null),
  ('NAVprofil',                'NAV',                    'NAVprofil'),
  ('kormanyzat',               'Kormányzat',             'kormanyzat'),
  ('tarkanyizsoltdebrecen',    'Tarkányi Zsolt',         'tarkanyizsoltdebrecen'),
  ('kontrollponthu',           'Kontrollpont',           'kontrollponthu'),
  ('jamborandrasoldala',       'Jámbor András',          'jamborandrasoldala'),
  ('avakmajom',                'A Vak Majom',            'avakmajom'),
  ('bodiskrisztaofficial',     'Bódis Kriszta',          'bodiskrisztaofficial'),
  ('drkuljaandras',            'Kulja András',           'drkuljaandras'),
  ('balogh.balazs.tisza',      'Balogh Balázs',          'balogh.balazs.tisza'),
  ('tisza.budapest.06oevk',    'Tisza Budapest 06. ÖVK', 'tisza.budapest.06oevk')
on conflict ("pageId") do nothing;


-- ─── 4. Megafon megszűnés (0019) → MediaClosure ─────────────────────────────

insert into "MediaClosure" (name, "eventType", description, "eventDate", "sourceUrl", "sourceName")
select
  'Megafon',
  'megszűnés',
  'A Media1 értesülése szerint 2026. június 26-án az utolsó alkalmazott is távozik a Megafontól. A megszűnés nem 100%-ban megerősített — forrás: Media1.',
  '2026-06-26 00:00:00+00'::timestamptz,
  'https://media1.hu/2026/06/25/veget-erhet-a-megafon-mukodese-penteken-az-utolso-alkalmazott-is-tavozik/',
  'Media1'
where not exists (
  select 1 from "MediaClosure" where name = 'Megafon'
);


-- ─── 5. Orbán Balázs lemondás (0020) → PoliticalResignation ──────────────────
-- (rövid leírással, ahogy a grafikon megköveteli)

insert into "PoliticalResignation" (name, position, institution, "resignationType", "resignationDate", description, pinned)
select
  'Orbán Balázs',
  'kuratóriumi elnök',
  'Mathias Corvinus Collegium (MCC)',
  'lemondás',
  '2026-06-19 00:00:00+00'::timestamptz,
  'Lemondott az MCC kuratóriumi elnöki posztjáról',
  false
where not exists (
  select 1 from "PoliticalResignation"
  where name = 'Orbán Balázs' and institution like '%Mathias Corvinus%'
);


-- ─── 6. NKA-botrány előzetesek (0020 Ughy + 0021 öt fő) → CourtVerdict ───────

insert into "CourtVerdict" ("personName", position, crimes, "sentenceYears", "sentenceLabel", "verdictType", "verdictDate", court, summary, "sourceUrls", "sourceNames", "sourceHeadlines", "sourceDates")
select * from (values
  (
    'Ughy Attila',
    'Budapest XVIII. kerület volt polgármestere',
    ARRAY['hűtlen kezelés'],
    0,
    'előzetes letartóztatás',
    'előzetesben',
    '2026-06-23 00:00:00+00'::timestamptz,
    'Ismeretlen bíróság',
    'Ughy Attilát, Budapest XVIII. kerületének volt polgármesterét az NKA-botrány keretében 2026. június 23-án előzetes letartóztatásba helyezték hűtlen kezelés bűntett megalapozott gyanúja miatt.',
    ARRAY['https://444.hu/2026/06/25/ughy-attila-elozetes-letartoztatas'],
    ARRAY['444.hu'],
    ARRAY['Hat személy előzetesben az NKA-botrányban'],
    ARRAY['2026-06-25']
  ),
  (
    'Bús Balázs',
    'NKA korábbi alelnöke, Óbuda–Békásmegyer volt polgármestere',
    ARRAY['hűtlen kezelés'], 0, 'előzetes letartóztatás', 'előzetesben',
    '2026-06-23 00:00:00+00'::timestamptz, 'Ismeretlen bíróság',
    'Bús Balázst, az NKA korábbi alelnökét és Óbuda–Békásmegyer volt polgármesterét 2026. június 23-án előzetes letartóztatásba helyezte a NAV hűtlen kezelés bűntett megalapozott gyanúja miatt az NKA-botrányban.',
    ARRAY['https://444.hu/2026/06/25/ughy-attila-elozetes-letartoztatas'], ARRAY['444.hu'],
    ARRAY['Hat személy előzetesben az NKA-botrányban'], ARRAY['2026-06-25']
  ),
  (
    'Krucsainé Herter Anikó',
    'NKTK főigazgatója',
    ARRAY['hűtlen kezelés'], 0, 'előzetes letartóztatás', 'előzetesben',
    '2026-06-23 00:00:00+00'::timestamptz, 'Ismeretlen bíróság',
    'Krucsainé Herter Anikót, az NKTK főigazgatóját 2026. június 23-án előzetes letartóztatásba helyezte a NAV hűtlen kezelés bűntett megalapozott gyanúja miatt az NKA-botrányban.',
    ARRAY['https://444.hu/2026/06/25/ughy-attila-elozetes-letartoztatas'], ARRAY['444.hu'],
    ARRAY['Hat személy előzetesben az NKA-botrányban'], ARRAY['2026-06-25']
  ),
  (
    'Burom Gábor',
    'Kulturális és Innovációs Minisztérium korábbi miniszteri kabinetfőnök-helyettese',
    ARRAY['hűtlen kezelés'], 0, 'előzetes letartóztatás', 'előzetesben',
    '2026-06-23 00:00:00+00'::timestamptz, 'Ismeretlen bíróság',
    'Burom Gábort, a KIM korábbi miniszteri kabinetfőnök-helyettesét 2026. június 23-án előzetes letartóztatásba helyezte a NAV hűtlen kezelés bűntett megalapozott gyanúja miatt az NKA-botrányban.',
    ARRAY['https://444.hu/2026/06/25/ughy-attila-elozetes-letartoztatas'], ARRAY['444.hu'],
    ARRAY['Hat személy előzetesben az NKA-botrányban'], ARRAY['2026-06-25']
  ),
  (
    'Unger Erika',
    'NKTK kabinetvezető',
    ARRAY['hűtlen kezelés'], 0, 'előzetes letartóztatás', 'előzetesben',
    '2026-06-23 00:00:00+00'::timestamptz, 'Ismeretlen bíróság',
    'Unger Erikát, az NKTK kabinetvezetőjét 2026. június 23-án előzetes letartóztatásba helyezte a NAV hűtlen kezelés bűntett megalapozott gyanúja miatt az NKA-botrányban.',
    ARRAY['https://444.hu/2026/06/25/ughy-attila-elozetes-letartoztatas'], ARRAY['444.hu'],
    ARRAY['Hat személy előzetesben az NKA-botrányban'], ARRAY['2026-06-25']
  ),
  (
    'Zámbó Nóra',
    'Kulturális és Innovációs Minisztérium korábbi miniszteri kabinetfőnök-helyettese',
    ARRAY['hűtlen kezelés'], 0, 'előzetes letartóztatás', 'előzetesben',
    '2026-06-23 00:00:00+00'::timestamptz, 'Ismeretlen bíróság',
    'Zámbó Nórát, a KIM korábbi miniszteri kabinetfőnök-helyettesét 2026. június 23-án előzetes letartóztatásba helyezte a NAV hűtlen kezelés bűntett megalapozott gyanúja miatt az NKA-botrányban.',
    ARRAY['https://444.hu/2026/06/25/ughy-attila-elozetes-letartoztatas'], ARRAY['444.hu'],
    ARRAY['Hat személy előzetesben az NKA-botrányban'], ARRAY['2026-06-25']
  )
) as v("personName", position, crimes, "sentenceYears", "sentenceLabel", "verdictType", "verdictDate", court, summary, "sourceUrls", "sourceNames", "sourceHeadlines", "sourceDates")
where not exists (
  select 1 from "CourtVerdict" cv
  where cv."personName" = v."personName"
    and cv."verdictType" = 'előzetesben'
);
