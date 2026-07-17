import type { Metadata } from 'next';
import UgyekClient from './UgyekClient';
import { CrossLemondosok, CrossMegszunt, CrossGaleria, CrossFelszolitottak } from '../_home/cross-promo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Kiemelt ügyek',
  description: 'A legdurvább, folyamatosan frissülő korrupciós ügyek szerkesztőségi válogatása. Kattints, és nézd meg, mi derült ki eddig!',
  openGraph: { title: 'Kiemelt ügyek — Kegyencjárat', description: 'A legdurvább, folyamatosan frissülő korrupciós ügyek szerkesztőségi válogatása.' },
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
