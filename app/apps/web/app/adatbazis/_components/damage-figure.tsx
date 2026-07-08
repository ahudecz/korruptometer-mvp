import { FtValue } from '../../_home/ft-value';

/**
 * Honest damage display (FR-005). Never presents a budget/project artifact as
 * "kár": when `suppressed` it shows a "becslés alatt" treatment + the basis
 * instead of a hard number. A 0 figure shows "nincs számszerűsítve".
 */
export function DamageFigure({
  huf,
  suppressed,
  basisText,
  label = 'Érintett közpénz',
}: {
  huf: bigint;
  suppressed: boolean;
  basisText?: string | null;
  label?: string;
}) {
  const soft = suppressed || huf <= 0n;
  return (
    <div className={`case-damage${soft ? ' case-damage--soft' : ''}`}>
      <span className="case-damage-label">{label}</span>
      {soft ? (
        <span className="case-damage-pending">
          {huf > 0n ? 'Becslés alatt' : 'Nincs számszerűsítve'}
        </span>
      ) : (
        <span className="case-damage-value">
          <FtValue n={huf} />
        </span>
      )}
      {basisText && <span className="case-damage-basis">{basisText}</span>}
    </div>
  );
}
