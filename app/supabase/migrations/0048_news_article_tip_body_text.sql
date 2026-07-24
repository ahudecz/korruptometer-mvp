-- Kézi Telegram-tipp: a beküldött link rövid og:description-je gyakran nem
-- tartalmazza az összes érintett nevét (l. múzeumigazgatók-eset, 2026-07-24).
-- Ez az oszlop a teljes cikktörzset (vagy a userköldő manuálisan mellékelt
-- szövegét) tárolja, KIZÁRÓLAG az újra-detektáláshoz — a publikus "excerpt"
-- mezőt nem érinti/nem helyettesíti.
ALTER TABLE "NewsArticle" ADD COLUMN IF NOT EXISTS "tipBodyText" text;
