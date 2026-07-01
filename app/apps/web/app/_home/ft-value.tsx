import { fmtFtParts } from '@korr/shared/format';

/**
 * Pénzösszeg reszponzív / helytakarékos mértékegységgel (Milliárd ↔ Mrd).
 *
 * mode:
 *  - 'long'  : desktopon mindig a teljes „Milliárd Ft", mobilon „Mrd Ft".
 *              Széles helyekre (pl. hero), ahol a nagy szám is kifér.
 *  - 'short' : mindig a tömör „Mrd Ft". Keskeny helyekre (pl. KPI grafikon-
 *              blokk), ahol a „Milliárd" már kis számnál is két sorba törne.
 *  - 'auto'  : (alapértelmezett) kis értéknél a teljes „Milliárd" (desktop) /
 *              „Mrd" (mobil); de ha a milliárd-érték 3+ számjegyű (≥100 Mrd),
 *              akkor — a sortörés elkerülésére — mindig a tömör „Mrd".
 *
 * A milliárd alatti sávoknál (M Ft, e Ft) nincs eltérés, ott sima szöveget adunk.
 */
const WIDE_BILLIONS = 100; // 3+ számjegyű milliárd → „Milliárd" már törne

export function FtValue({
  n,
  mode = 'auto',
}: {
  n: number | bigint;
  mode?: 'long' | 'short' | 'auto';
}) {
  const { value, unitLong, unitShort } = fmtFtParts(n);

  // Nem milliárdos összeg: nincs hosszú/rövid eltérés.
  if (unitLong === unitShort) return <>{`${value} ${unitLong}`}</>;

  const billions = Math.abs(typeof n === 'bigint' ? Number(n) : n) / 1_000_000_000;
  const effectiveMode = mode === 'auto' && billions >= WIDE_BILLIONS ? 'short' : mode;

  if (effectiveMode === 'short') {
    return (
      <span className="ft-amount">
        {value} <span className="ft-unit-fixed">{unitShort}</span>
      </span>
    );
  }

  // 'long' és a kis értékű 'auto': desktopon Milliárd, mobilon Mrd.
  return (
    <span className="ft-amount">
      {value}{' '}
      <span className="ft-unit-long">{unitLong}</span>
      <span className="ft-unit-short">{unitShort}</span>
    </span>
  );
}
