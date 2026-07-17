import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sql } from 'drizzle-orm';

import { fmtNumber, fmtFt } from '@korr/shared/format';
import { FtValue } from '../../../_home/ft-value';
import { GALERIA } from '../../../_home/galeria-config';
import { WATCH_LIST } from '../../../_home/watchlist-config';
import { PERSON_PHOTOS, cleanTitle, toAsciiId } from '../../../_home/case-detail-config';
import { getPersonRollup } from '../../../_home/person-rollup-config';
import { DescBlock } from '../../_components/desc-block';
import { truncate, withCta, ctaPerson } from '../../../_home/seo';
import { PersonGaleriaPromo, CrossAdatbazisSzemelyek, CrossUgyek, CrossBirosag } from '../../../_home/cross-promo';

import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const config = getPersonRollup(slug);
  if (!config) return {};

  const db = getDb();
  const excluded = config.excludeIds ?? [];
  const rows = (await db.execute(sql`
    SELECT damage_huf FROM "ScandalCatalog"
    WHERE person = ${config.personName}
      ${excluded.length > 0 ? sql`AND id NOT IN (${sql.join(excluded.map((v) => sql`${v}`), sql`, `)})` : sql``}
  `)) as unknown as Array<{ damage_huf: string }>;
  if (rows.length === 0) return {};

  let total = 0n;
  for (const r of rows) total += BigInt(r.damage_huf ?? 0);

  return {
    title: truncate(`${config.personName} összes ügye`, 40),
    description: withCta(
      `${config.personName} ${fmtNumber(rows.length)} dokumentált ügye, összesen ${fmtFt(total)} érintett közpénzzel`,
      ctaPerson(),
    ),
  };
}

const TOP_N = 10;

type Row = {
  id: string;
  name: string;
  institution: string | null;
  damage_huf: string;
  article_count: number;
};

function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '').trim();
}

function imgSrc(url: string): string {
  if (url.startsWith('/') || url.includes('wikimedia.org')) return url;
  return `/api/img-proxy?url=${encodeURIComponent(url)}`;
}

export default async function PersonRollupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const config = getPersonRollup(slug);
  if (!config) notFound();

  const db = getDb();
  const excluded = config.excludeIds ?? [];
  const rows = (await db.execute(sql`
    SELECT id, name, institution, damage_huf, article_count
    FROM "ScandalCatalog"
    WHERE person = ${config.personName}
      ${excluded.length > 0 ? sql`AND id NOT IN (${sql.join(excluded.map((v) => sql`${v}`), sql`, `)})` : sql``}
    ORDER BY damage_huf DESC, id ASC
  `)) as unknown as Row[];

  if (rows.length === 0) notFound();

  let total = 0n;
  for (const r of rows) total += BigInt(r.damage_huf ?? 0);

  const top = rows.slice(0, TOP_N);
  const rest = rows.slice(TOP_N);
  const topSum = top.reduce((s, r) => s + BigInt(r.damage_huf ?? 0), 0n);
  const topPct = total > 0n ? Math.round((Number(topSum) / Number(total)) * 100) : 0;

  const galeriaEntry = GALERIA.find((g) => norm(g.name) === norm(config.personName));
  const watchEntry = !galeriaEntry ? WATCH_LIST.find((w) => norm(w.name) === norm(config.personName)) : null;
  const personPhotoEntry = !galeriaEntry && !watchEntry ? (PERSON_PHOTOS[config.personName] ?? null) : null;
  const photoUrl = galeriaEntry?.photoUrl ?? watchEntry?.photoUrl ?? personPhotoEntry?.photoUrl ?? null;
  const photoCredit = galeriaEntry?.photoCredit ?? watchEntry?.photoCredit ?? personPhotoEntry?.photoCredit ?? null;
  const initials = config.personName.split(' ').slice(0, 2).map((w) => w[0]).join('');

  return (
    <div className="person-page ugy-page">
      <div className="person-hero">
        <div className="person-hero-inner">
          <div className="person-hero-photo">
            {photoUrl ? (
              <img src={imgSrc(photoUrl)} alt={config.personName} className="person-photo-img" />
            ) : (
              <div className="person-photo-placeholder"><span>{initials || '?'}</span></div>
            )}
            {photoCredit && <div className="photo-credit">{photoCredit}</div>}
          </div>

          <div className="person-hero-text">
            <div className="person-hero-eyebrow">Adatbázis · összesített ügyprofil</div>
            <h1 className="person-hero-name">{config.personName} összes ügye</h1>
            <div className="person-hero-sub">
              {fmtNumber(rows.length)} önálló, tételes ügy az adatbázisból
            </div>

            <div className="person-hero-amount">
              <div className="person-hero-amount-lbl">Összesített érintett közpénz</div>
              <div className="person-hero-amount-val"><FtValue n={total} mode="long" /></div>
            </div>

            <p className="person-hero-desc">
              Összeszedtük {config.personName} összes, az adatbázisban külön-külön dokumentált ügyét,
              hogy ne kelljen egyenként keresgélni és szűrni
              {rest.length > 0
                ? <> — itt a {fmtNumber(rows.length)} ügyből kiemeljük a legnagyobbakat, alattuk pedig a teljes lista is elérhető.</>
                : '.'}
            </p>
          </div>
        </div>
      </div>

      <div className="person-body">
        <div className="ugy-description">
          <h2 className="person-section-title">
            {rest.length > 0 ? 'A 10 legnagyobb ügy' : 'A legnagyobb ügyei'} a K-Monitor adatbázisa alapján
          </h2>
          <p className="person-section-note">
            {rest.length > 0 && <>A {fmtNumber(rows.length)} ügyből ez a 10 adja az érintett közpénz kb. {topPct}%-át. </>}
            Sajtójelentések és nyilvánosan hozzáférhető dokumentumok alapján. Jogerős ítélet hiányában
            az érintett személyek ártatlannak tekintendők.
          </p>
        </div>

        <div className="person-cases">
          {top.map((r, i) => {
            const dmg = BigInt(r.damage_huf ?? 0);
            const writeup = config.writeups?.find((w) => w.id === r.id)?.blocks;
            return (
              <div key={r.id} className="person-case-card">
                <div className="person-case-num">/ {String(i + 1).padStart(2, '0')}</div>
                <div className="person-case-body">
                  <Link href={`/adatbazis/${encodeURIComponent(toAsciiId(r.id))}`} className="person-case-title">
                    {cleanTitle(r.name)}
                  </Link>
                  {r.institution && <p className="person-case-desc">{r.institution}</p>}

                  {writeup ? (
                    <div className="ugy-description-body">
                      {writeup.map((b, bi) => <DescBlock key={bi} block={b} />)}
                    </div>
                  ) : null}

                  <div className="person-case-footer">
                    <div className="person-case-dmg">
                      <span className="person-case-dmg-lbl">Érintett közpénz</span>
                      <span className="person-case-dmg-val"><FtValue n={dmg} /></span>
                    </div>
                    <Link href={`/adatbazis/${encodeURIComponent(toAsciiId(r.id))}`} className="person-case-source">
                      Részletek →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {rest.length > 0 && (
          <div className="case-section">
            <h2 className="person-section-title">A K-Monitor adatbázisában szereplő további {fmtNumber(rest.length)} ügy</h2>
            <p className="person-section-note">
              Kisebb összegű vagy kevésbé dokumentált ügyek — mindegyik saját, önálló oldallal.
            </p>
            <div className="ugyek-more-grid">
              {rest.map((r) => {
                const dmg = BigInt(r.damage_huf ?? 0);
                return (
                  <Link key={r.id} href={`/adatbazis/${encodeURIComponent(toAsciiId(r.id))}`} className="ugyek-more-card">
                    <div className="ugyek-more-eyebrow">
                      {dmg > 0n ? <FtValue n={dmg} /> : `${fmtNumber(r.article_count)} cikk`}
                    </div>
                    <div className="ugyek-more-title">{cleanTitle(r.name)}</div>
                    {r.institution && <div className="ugyek-more-sub">{r.institution}</div>}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="person-more-section">
        <div className="person-more-inner">
          <Link href="/adatbazis" className="back-link">← Vissza az adatbázisba</Link>
        </div>
      </div>

      <div className="cross-promo-section">
        <div className="cross-promo-section-inner">
          {GALERIA.some((g) => g.name === config.personName) && (
            <PersonGaleriaPromo
              personName={config.personName}
              caseCount={rows.length}
              total={total}
              photoUrl={photoUrl}
            />
          )}
          <CrossAdatbazisSzemelyek />
          <CrossUgyek />
          <CrossBirosag />
        </div>
      </div>
    </div>
  );
}
