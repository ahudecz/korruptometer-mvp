// Egyetlen forrás a "/megszunt" stat-kártyáira. 2026-08-02, user report:
// az "Érintett médium összesen" kártya rég csak `megszűnés + leépítés`
// sorokat számolta, miközben a táblázat maga MINDEN approved sort kiírt
// (beleértve a mediaClosureTypeEnum másik két értékét, 'elmaradt esemény'
// és 'egyéb'-et is) — élesben ez 19-et mutatott 21 helyett.
//
// Tervezési elv, mint resignation-stats.ts-nél: az összesítő sose
// felsorolás-alapú (mindig rows.length, tehát eleve nem tud alulszámolni),
// az AL-bontás (kiemelt kártyák) felsorolás-alapú marad, de a teszt jelez,
// ha egy típus egyik kártyába se esik bele.

export type MediaClosureStatRow = { eventType: string };

export interface MediaClosureStats {
  mediaCount: number;
  megszuntCount: number;
  leepitesCount: number;
  /** rows.length-be beleszámító, de saját kártyát nem kapó sorok száma. */
  uncategorizedCount: number;
}

export function computeMediaClosureStats(rows: MediaClosureStatRow[]): MediaClosureStats {
  const megszuntCount = rows.filter(r => r.eventType === 'megszűnés').length;
  const leepitesCount = rows.filter(r => r.eventType === 'leépítés').length;
  const mediaCount = rows.length;
  const uncategorizedCount = mediaCount - (megszuntCount + leepitesCount);
  return { mediaCount, megszuntCount, leepitesCount, uncategorizedCount };
}
