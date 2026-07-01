-- Facebook oldalak listája — az Inngest sync-facebook-posts cron olvassa
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
