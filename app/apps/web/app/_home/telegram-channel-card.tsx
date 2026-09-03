/**
 * 012-reader-subscriptions — a NYILVÁNOS Telegram-csatorna olvasói belépője
 * (User Story 2, FR-020, A4).
 *
 * A csatorna eddig csak szerveroldalon létezett: a `TELEGRAM_PUBLIC_CHANNEL_ID`
 * a küldést kapcsolja, de az olvasónak SEHOL nem mondtuk meg, hogy van ilyen és
 * hogyan lehet rá feliratkozni. Ez a kártya az a hiányzó fél.
 *
 * A4 szerint ez a "telefonos" csatorna: telefonszámot soha nem tárolunk, és
 * SMS-szolgáltatás nincs — a telefonra érkező értesítést a Telegram adja.
 *
 * A link KÜLÖN env-változó (`NEXT_PUBLIC_TELEGRAM_CHANNEL_URL`), nem a
 * `TELEGRAM_PUBLIC_CHANNEL_ID`-ból származtatva: az utóbbi lehet numerikus
 * belső azonosító (`-100…`), amiből nem képezhető `t.me` cím, és szerver-
 * oldali titok — nem való a böngészőbe.
 *
 * Ha a változó nincs beállítva, a kártya NEM jelenik meg. Ugyanaz a
 * kikapcsoló-logika, mint a küldésnél (FR-022): fél kész csatornára nem
 * küldünk olvasót.
 */
/**
 * Van-e egyáltalán csatorna, amire mutathatunk. EGY forrás, hogy a kártya és
 * a rá hivatkozó SZÖVEGEK ne tudjanak szétcsúszni: amíg nincs csatorna, egy
 * oldal sem ígérhet "két utat".
 */
export function hasTelegramChannel(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_URL);
}

export function TelegramChannelCard() {
  // A `NEXT_PUBLIC_` előtagú változót a Next a fordításkor behelyettesíti, akár
  // modulszinten, akár itt olvassuk. A komponensen BELÜL olvassuk, hogy a
  // kikapcsolt ág tesztelhető legyen modul-újratöltés nélkül.
  const channelUrl = process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_URL;
  if (!channelUrl) return null;

  return (
    <div className="chan">
      <div className="chan-head">
        <span className="chan-title">Telegram-csatorna</span>
        <span className="chan-when">Azonnal</span>
      </div>
      <div className="chan-body">
        <p>
          Minden téma, szűrés nélkül, ahogy felkerül. Nem kérünk e-mail címet,
          telefonszámot és nevet — semmit nem tárolunk rólad.
        </p>
        <a
          className="chan-tg-btn"
          href={channelUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Csatorna megnyitása
        </a>
        <p className="chan-note">
          Telegram-fiók kell hozzá. Kilépni bármikor lehet, minket nem kell
          értesíteni.
        </p>
      </div>
    </div>
  );
}
