// Egyetlen forrás a "/visszaszerzett-vagyon" összesítőjére. Ennek a
// tábla­nak (AssetRecovery) nincs kategória-oszlopa, amin egy jövőbeli
// típus csendben átcsúszhatna a számláláson — a lenti teszt ezt az
// invariánst rögzíti (2026-08-02, user kérés: automata teszt minden
// "total"-ra, hogy ez a tábla se tudjon reprodukálni egy hasonló bugot,
// mint a lemondasok/megszunt oldalaknál).

export type RecoveryStatRow = { amountFt: bigint };

export function computeRecoveryTotal(rows: RecoveryStatRow[]): bigint {
  return rows.reduce((s, r) => s + r.amountFt, 0n);
}
