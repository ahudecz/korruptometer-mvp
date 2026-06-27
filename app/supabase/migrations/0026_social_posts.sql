-- Social feed posts (manually curated via Supabase dashboard)
create table if not exists "SocialPost" (
  id uuid primary key default gen_random_uuid(),
  "authorName"  text not null,
  "authorHandle" text,
  platform      text not null default 'facebook',
  "postUrl"     text not null,
  content       text not null,
  "postedAt"    timestamptz,
  "createdAt"   timestamptz not null default now()
);

create index if not exists "SocialPost_postedAt_idx" on "SocialPost" ("postedAt" desc);
