// Egyetlen forrás a "hány NER-káder távozott" logikára — a /lemondasok
// hub-oldal stat-kártyái ÉS a nyitóoldal (app/page.tsx) KPI-számlálója
// is ebből dolgozik, hogy a két szám sose tudjon szétcsúszni (2026-08-02,
// user report: a nyitóoldali és a /lemondasok-os "total" évek óta nem
// egyezett meg megbízhatóan, mert mindkét hely saját, egymástól független
// listát tartott karban arról, mely resignationType számít bele).
//
// Tervezési elv: az OSSZES/osszes mindig KIZÁRÁS-alapú (bármi beleszámít,
// ami nincs kifejezetten kizárva) — így egy ÚJ resignationType érték
// (pl. a 2026-08-01-i 'visszahívás') automatikusan beleszámít a total-ba,
// nem kell külön kódot írni hozzá. A megjelenített AL-bontás (kategória
// szerinti kártyák) viszont értelemszerűen felsorolás-alapú kell legyen —
// ott a lenti teszt jelez, ha egy új típus egyik kártyába se esik bele.

export type ResignationStatRow = { resignationType: string; name: string };

/** Ez a típus jelenti azt, hogy a személy MÉG hivatalban van — nem távozás. */
export const RESIGNATION_EXCLUDED_TYPES: string[] = ['Hivatalban van'];

/**
 * Szerkesztőségi tömeges leépítések (pl. "X szerkesztősége") a
 * /megszunt oldalon már számítanak "leépítés"-ként — itt kizárjuk,
 * nehogy duplán szerepeljenek a "NER-káder távozott" számlálóban. Ugyanezt
 * a szót használja a nyitóoldal (app/page.tsx) SQL `NOT ILIKE`-je is —
 * innen importálva nem tud a két hely szétcsúszni.
 */
export const SZERKESZTOSEG_NEEDLE = 'szerkesztőség';

export function isSzerkesztosegName(name: string): boolean {
  return name.toLowerCase().includes(SZERKESZTOSEG_NEEDLE);
}

export function isCountedDeparture(row: ResignationStatRow): boolean {
  return !RESIGNATION_EXCLUDED_TYPES.includes(row.resignationType) && !isSzerkesztosegName(row.name);
}

const KIRUGAS_FELMENTES_TYPES: readonly string[] = ['kirúgás', 'felmentés', 'egyéb'];

export interface ResignationStats {
  /** A nyitóoldali KPI-vel egyező, kizárás-alapú végösszeg. */
  osszes: number;
  kirugasFelmentesCount: number;
  lemondasCount: number;
  visszahivasCount: number;
  /**
   * osszes-be beleszámító, de egyik névre-szóló kártyába se sorolt sorok
   * száma — 0-nak KELL lennie. Ha nem az, egy új resignationType érték
   * érkezett anélkül, hogy saját kártyát kapott volna a hub-oldalon.
   */
  uncategorizedCount: number;
}

// Egyetlen forrás a resignationType → címke/szín leképezésre is — 2026-08-02,
// user report: a nyitóoldal (resignations-section.tsx) saját, harmadik,
// egymástól függetlenül karbantartott TYPE_COLOR/TYPE_LABEL térképet
// tartott, aminek szintén nem volt 'visszahívás' bejegyzése, ezért szürkén
// jelent meg élesben a lemondasok/resignation-list.tsx-en már lila
// badge-ként helyesen mutatott típus. A lenti két map az EGYETLEN hely,
// ahol ez definiálva van — l. resignation-stats.test.ts, ami minden élő
// resignation_type enum-értékre garantálja, hogy mindkettőben szerepel.
export const RESIGNATION_TYPE_LABEL: Record<string, string> = {
  'lemondás': '↓ Lemondás',
  'kirúgás': '✕ Kirúgás',
  'felmentés': '⟲ Felmentés',
  'visszahívás': '↩ Visszahívás',
  'egyéb': '◈ Egyéb',
  'Hivatalban van': 'Hivatalban van',
};

export const RESIGNATION_TYPE_COLOR: Record<string, string> = {
  'lemondás': '#4B7AFF',
  'kirúgás': '#E31937',
  'felmentés': '#FF9D00',
  'visszahívás': '#8A5CF6',
  'egyéb': '#888888',
  'Hivatalban van': '#666666',
};

export function computeResignationStats(rows: ResignationStatRow[]): ResignationStats {
  const counted = rows.filter(isCountedDeparture);
  const kirugasFelmentesCount = counted.filter(r => KIRUGAS_FELMENTES_TYPES.includes(r.resignationType)).length;
  const lemondasCount = counted.filter(r => r.resignationType === 'lemondás').length;
  const visszahivasCount = counted.filter(r => r.resignationType === 'visszahívás').length;
  const osszes = counted.length;
  const uncategorizedCount = osszes - (kirugasFelmentesCount + lemondasCount + visszahivasCount);
  return { osszes, kirugasFelmentesCount, lemondasCount, visszahivasCount, uncategorizedCount };
}
