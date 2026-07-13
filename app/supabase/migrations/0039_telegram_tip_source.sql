-- 008-telegram-review-bot bővítés: fordított irányú bejelentés (user Telegramon
-- küld be egy URL-t, a bot 5 kategória-gombbal válaszol). A NewsArticle.sourceId
-- NOT NULL, és a legtöbb beküldött URL nem esik egyik konfigurált outlet
-- adapterébe sem (routeOutletByUrl null-t ad) — ez a dedikált Source sor a
-- fallback minden ilyen kézi bejelentéshez.

insert into "Source" (slug, name, homepage, tag, enabled)
values ('telegram-bejelentes', 'Telegram bejelentés', 'https://telegram.org', 'newsletter', true)
on conflict (slug) do nothing;
