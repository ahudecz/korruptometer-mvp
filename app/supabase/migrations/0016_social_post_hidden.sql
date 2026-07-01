-- FR-005: hidden mező hozzáadása (default false = látható)
alter table "SocialPost"
  add column if not exists "hidden" boolean not null default false;

-- imageUrl mező hozzáadása (a UI már használta, de hiányzott a sémából)
alter table "SocialPost"
  add column if not exists "imageUrl" text;

-- FR-008: duplikátum védelem postUrl alapján
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'SocialPost_postUrl_unique'
      and conrelid = '"SocialPost"'::regclass
  ) then
    alter table "SocialPost"
      add constraint "SocialPost_postUrl_unique" unique ("postUrl");
  end if;
end $$;
