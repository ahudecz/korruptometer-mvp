import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getFeltaro } from '../../_home/rendszervaltas-config';
import { FeltaroProfile, urlFor } from './feltaro-profile';

// Statikus tartalom, DB-hívás nélkül. Napi újragenerálás bőven elég ahhoz,
// hogy egy config-módosítás kimenjen, és a Googlebot mindig kész HTML-t kapjon.
export const revalidate = 86400;



/**
 * SZÁNDÉKOSAN ÜRES — ezek az oldalak nem a buildben készülnek el, hanem az
 * első kérésre, és onnantól ISR-ből (l. `revalidate` fentebb).
 *
 * 2026-09-17, mért ok: három egymást követő deploy hasalt el azon, hogy
 * ezeknek a lapoknak a statikus generálása túllépte a Next 60 másodperces
 * per-oldal limitjét — „Failed to build /rendszervaltas/[slug]/page:
 * /rendszervaltas/juhasz-peter (attempt 3 of 3)". A build Clevelandben fut,
 * az adatbázis Európában van, tehát minden lekérdezés ~150 ms oda-vissza; a
 * lap alján négy cross-promo blokk kérdez, és ezek a lapok a site
 * leghosszabb HTML-jei (~400 kB). Négy mag, hat lap egyszerre — ez nem fért
 * bele. Ugyanez a build EURÓPAI gépen, az éles adatbázissal, nulla
 * időtúllépéssel átmegy: nem a kód lassú, hanem a földrajz.
 *
 * Futásidőben a lap a frankfurti régióban generálódik, az adatbázis mellett,
 * és a kérés-limit 300 másodperc — ott ez a munka bőven belefér. Az első
 * kérés után az eredmény cache-elve van, a Googlebot is kész HTML-t kap.
 * A sitemap továbbra is felsorolja őket (l. sitemap.ts).
 *
 * Ha ez valaha visszakerül a buildbe, a cross-promo blokkokat kell előbb
 * kivenni ezekről a lapokról — nem a limitet kell kerülgetni.
 */
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const f = getFeltaro(slug);
  if (!f || !f.live) return {};
  const title = f.detail?.seoTitle ?? `${f.name} — mit tárt fel?`;
  const description =
    f.detail?.seoDescription ??
    `${f.name} (${f.role}) a Kegyencjárat Dicsőségfalán. ${f.tagline}`.slice(0, 300);
  return {
    title: { absolute: `${title} — Kegyencjárat` },
    description,
    alternates: { canonical: urlFor(f.id) },
    openGraph: { type: 'profile', url: urlFor(f.id), title, description },
  };
}

export default async function FeltaroPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const f = getFeltaro(slug);
  if (!f || !f.live) notFound();
  return <FeltaroProfile f={f} />;
}
