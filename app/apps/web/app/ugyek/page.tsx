import type { Metadata } from 'next';
import UgyekClient from './UgyekClient';
import { CrossLemondosok, CrossMegszunt, CrossGaleria, CrossFelszolitottak } from '../_home/cross-promo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Ügyek',
  description: 'Dokumentált korrupciós ügyek kereshető adatbázisa — összeg, szektor, státusz és régió szerint szűrhető.',
  openGraph: { title: 'Ügyek — Kegyencjárat', description: 'Dokumentált korrupciós ügyek kereshető adatbázisa.' },
};

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
