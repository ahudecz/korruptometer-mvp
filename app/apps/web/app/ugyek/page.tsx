import UgyekClient from './UgyekClient';
import { CrossLemondosok, CrossMegszunt, CrossGaleria, CrossFelszolitottak } from '../_home/cross-promo';

export const dynamic = 'force-dynamic';

export default function UgyekPage() {
  return (
    <>
      <UgyekClient />
      <div className="cross-promo-section">
        <div className="cross-promo-section-inner">
          <CrossLemondosok />
          <CrossGaleria />
          <CrossMegszunt />
          <CrossFelszolitottak />
        </div>
      </div>
    </>
  );
}
