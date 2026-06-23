-- Breaking news detection system

-- 1. BreakingMonitor: manuálisan felvehetők új figyelt személyek/ügyek
create table if not exists "BreakingMonitor" (
  id uuid primary key default gen_random_uuid(),
  keyword text not null,
  type text not null default 'keyword', -- 'person' | 'case' | 'keyword'
  label text not null,
  enabled boolean not null default true,
  "createdAt" timestamptz not null default now()
);

create index if not exists "BreakingMonitor_enabled_idx" on "BreakingMonitor" (enabled);

-- 2. NewsArticle breaking mezők
alter table "NewsArticle"
  add column if not exists "isBreakingCandidate" boolean not null default false,
  add column if not exists "breakingOverride" boolean;

create index if not exists "NewsArticle_breaking_idx" on "NewsArticle" ("isBreakingCandidate");
