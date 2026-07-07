-- SocialPost jelenleg RLS nélkül fut: a nyitóoldal és a /legfontosabb-hangok
-- oldal "Több poszt" gombja a NEXT_PUBLIC_SUPABASE_ANON_KEY-vel közvetlenül
-- hívja a Supabase REST API-t, a hidden=false szűrést csak a kliens JS adja
-- hozzá. RLS nélkül bárki, aki a REST API-t a szűrés nélkül hívja, olvashatja
-- az elrejtett (hidden=true) posztokat is. Ez a migráció adatbázis-szinten
-- kényszeríti ki a szűrést; a service-role kulcsot használó szerver oldali
-- kód (Inngest sync, admin API-k) RLS-t megkerülve továbbra is mindent lát.

alter table "SocialPost" enable row level security;

drop policy if exists "SocialPost public read (visible only)" on "SocialPost";
create policy "SocialPost public read (visible only)"
  on "SocialPost"
  for select
  to anon, authenticated
  using (hidden = false);
