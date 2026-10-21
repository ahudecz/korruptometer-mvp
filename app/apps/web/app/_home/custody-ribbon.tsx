/**
 * Átlós piros szalag a kényszerintézkedés alatt álló kiemelt személyek
 * fotóján (GaleriaEntry.custodyStamp), a lemondottak/eltávolítottak
 * szalagjának (.watchlist-badge--resigned) mintájára. 2026-10-21, Matolcsy
 * György őrizetbe vétele. A szülőnek position:relative kell; a szalag saját,
 * levágott rétegben ül, így a szülő overflow-ját nem kell állítani.
 */
export function CustodyRibbon({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <div className="custody-ribbon-wrap" aria-hidden="true">
      <div className="custody-ribbon">{text}</div>
    </div>
  );
}
