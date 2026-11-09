import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getFeltaro } from '../../../_home/rendszervaltas-config';
import { FeltaroProfile } from '../../../rendszervaltas/[slug]/feltaro-profile';
import { verifyPreviewToken } from '@/lib/dicsosegfal-publish';

/**
 * Titkos előnézet a még nem élesített Dicsőségfal-tervezetekhez — telefonról
 * is megnézhető, mielőtt a Telegram „🚀 Élesít" gombjával kikerül. A kulcs a
 * `k` paraméter (l. lib/dicsosegfal-publish.ts). Rossz vagy hiányzó kulcsnál
 * 404, nem 401: ne derüljön ki, hogy az útvonal létezik.
 *
 * Mindig dinamikus és noindex; a robots.txt is tiltja, a sitemapben nincs.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { absolute: 'Előnézet — Kegyencjárat' },
  robots: { index: false, follow: false, nocache: true },
};

export default async function FeltaroPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ k?: string }>;
}) {
  const { slug } = await params;
  const { k } = await searchParams;
  const f = getFeltaro(slug);
  if (!f || !verifyPreviewToken(slug, k)) notFound();

  return (
    <>
      <div
        role="status"
        style={{
          background: '#171a20',
          color: '#fff',
          padding: '10px 16px',
          fontSize: 14,
          textAlign: 'center',
        }}
      >
        {f.live ? 'Ez a profil már élesben van.' : 'ELŐNÉZET — ez a tervezet még nincs élesítve, a keresők nem látják.'}
      </div>
      <FeltaroProfile f={f} />
    </>
  );
}
