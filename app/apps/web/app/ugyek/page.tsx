import type { Metadata } from 'next';
import UgyekClient from './UgyekClient';
import { loadDetentionCounts } from '@/lib/detention-counts';
import { CrossLemondosok, CrossMegszunt, CrossGaleria, CrossFelszolitottak, CrossErdekesUgyek } from '../_home/cross-promo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  alternates: { canonical: '/ugyek' },
  title: { absolute: 'Kiemelt ügyek' },
  description: 'A legdurvább NER-es korrupciós ügyek egy helyen — az NKA-botránytól az aranykonvojig. Kattints, és nézd meg, mi derült ki eddig!',
  openGraph: { title: 'Kiemelt ügyek — Kegyencjárat', description: 'A legdurvább, folyamatosan frissülő korrupciós ügyek szerkesztőségi válogatása.' },
};

export default async function UgyekPage() {
  const counts = await loadDetentionCounts();
  return (
    <>
      <UgyekClient detentionCounts={counts ? Object.fromEntries(counts) : null} />
      <div className="cross-promo-section">
        <div className="cross-promo-section-inner">
          <CrossErdekesUgyek pageKey="/ugyek" />
          <CrossLemondosok />
          <CrossGaleria />
          <CrossMegszunt />
          <CrossFelszolitottak />
        </div>
      </div>
    </>
  );
}
