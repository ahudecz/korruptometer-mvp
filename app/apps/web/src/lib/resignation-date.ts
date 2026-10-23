/**
 * A lemondás/felmentés listázási dátuma = a DÖNTÉS napja, nem a jogviszony
 * megszűnése. 2026-10-23, user kérés: Börcsök András felmentése (444, okt. 15.)
 * 2027. jún. 14-i dátummal (a felmentési idő vége) állt a /lemondasok élén, és
 * ott is maradt volna júniusig.
 *
 * Ha a kinyert dátum a cikk megjelenése UTÁN van, az a hatálybalépés /
 * a megbízatás vége — ilyenkor a cikk napja a döntés napjának legjobb közelítése.
 * Egy nap türelem: a cikk időbélyege és a naptári dátum időzóna miatt elcsúszhat.
 */
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function resolveResignationDate(raw: string | undefined | null, articleDate: Date): Date {
  if (!raw) return articleDate;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return articleDate;
  if (!isNaN(articleDate.getTime()) && d.getTime() > articleDate.getTime() + ONE_DAY_MS) return articleDate;
  return d;
}
