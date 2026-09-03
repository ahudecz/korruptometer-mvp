import Link from 'next/link';

/**
 * Teljes szélességű, kitört promó-csík a hero fejléc/KPI-blokkja és a
 * KPI-kártyarács között (l. page.tsx) — szándékosan NEM a breaking-banner
 * mellett/alatt, hogy ne tűnjön úgy, mintha azt váltaná le (user report,
 * 2026-08-31).
 *
 * 2026-09-03 user kérés: a korábbi szavazás-promó (feljelentés-hivatal
 * ügyeire szavaztatás, szavazatszámmal) helyett most a kvíz-rendszer
 * promója — a fájl/komponens neve (poll-banner/PollBanner) történeti okból
 * maradt, hogy ne kelljen az importot is átírni page.tsx-ben egy tisztán
 * tartalmi cseréért. A "/kviz" a legfrissebb kvízre irányít
 * (kviz/page.tsx), nem egy konkrét slug van belőgetve, hogy egy jövőbeli
 * új kvíznél ne kelljen itt is módosítani.
 */
export async function PollBanner() {
  return (
    <Link href="/kviz" className="poll-banner">
      <div className="poll-banner-inner">
        <span className="poll-banner-eyebrow">Kvíz</span>
        <p className="poll-banner-headline">
          Lehetnél te a Vagyonvisszaszerzési Hivatal legfőbb ügyésze?
        </p>
        <p className="poll-banner-subheadline">
          Nézzük, mennyit tudsz az MNB-alapítványi botrányról, töltsd ki a kvízt most!
        </p>
        <span className="poll-banner-cta">
          Kitöltöm a kvízt <span aria-hidden="true">→</span>
        </span>
      </div>
    </Link>
  );
}
