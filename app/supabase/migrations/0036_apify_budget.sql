-- Apify-nak nincs natív költséglimitje (csak havi plan-cap), ezért a
-- Facebook sync scriptek (Inngest + manuális CLI) ide könyvelik el a tényleges
-- Apify futásköltséget (usageTotalUsd), és leállnak, ha spentUsd eléri limitUsd-t.
-- Nem hónaponta reseteli magát — kézzel kell nullázni/emelni a limitet, ha kell.

create table if not exists "ApifyBudget" (
  id text primary key,
  "spentUsd" numeric not null default 0,
  "limitUsd" numeric not null default 5,
  "updatedAt" timestamptz not null default now()
);

insert into "ApifyBudget" (id, "spentUsd", "limitUsd")
values ('global', 0, 5)
on conflict (id) do nothing;
