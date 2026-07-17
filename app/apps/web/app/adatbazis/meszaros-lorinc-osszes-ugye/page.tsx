import Link from 'next/link';
import { sql } from 'drizzle-orm';

import { fmtNumber } from '@korr/shared/format';
import { FtValue } from '../../_home/ft-value';
import { GALERIA } from '../../_home/galeria-config';
import { cleanTitle, toAsciiId } from '../../_home/case-detail-config';
import { getMeszarosWriteup } from '../../_home/meszaros-osszes-ugye-content';
import { getPersonRollup } from '../../_home/person-rollup-config';
import { DescBlock } from '../_components/desc-block';

import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Mészáros Lőrinc összes ügye',
  description:
    'Mészáros Lőrinc összes, külön-külön dokumentált ügye egy helyen, érintett közpénzzel és forrásokkal. Kattints, és nézd meg mindet!',
};

// Single source of truth for excluded ids lives in person-rollup-config.ts
// (shared with the generic /adatbazis/szemely/[slug] page) — see that file's
// comments for why each id is excluded.
const EXCLUDED_IDS = getPersonRollup('meszaros-lorinc')?.excludeIds ?? [];
const TOP_N = 10;

type Row = {
  id: string;
  name: string;
  institution: string | null;
  damage_huf: string;
  article_count: number;
};

export default async function MeszarosOsszesUgyePage() {
  const db = getDb();

  const rows = (await db.execute(sql`
    SELECT id, name, institution, damage_huf, article_count
    FROM "ScandalCatalog"
    WHERE person = 'Mészáros Lőrinc'
      AND id NOT IN (${sql.join(EXCLUDED_IDS.map((v) => sql`${v}`), sql`, `)})
    ORDER BY damage_huf DESC, id ASC
  `)) as unknown as Row[];

  let total = 0n;
  for (const r of rows) total += BigInt(r.damage_huf ?? 0);

  const top = rows.slice(0, TOP_N);
  const rest = rows.slice(TOP_N);
  const topSum = top.reduce((s, r) => s + BigInt(r.damage_huf ?? 0), 0n);
  const topPct = total > 0n ? Math.round((Number(topSum) / Number(total)) * 100) : 0;

  const galeriaEntry = GALERIA.find((g) => g.id === 'meszaros-lorinc');
  const photoUrl = galeriaEntry?.photoUrl ?? null;

  return (
    <div className="person-page ugy-page">
      <div className="person-hero">
        <div className="person-hero-inner">
          <div className="person-hero-photo">
            {photoUrl ? (
              <img src={photoUrl} alt="Mészáros Lőrinc" className="person-photo-img" />
            ) : (
              <div className="person-photo-placeholder"><span>ML</span></div>
            )}
            {galeriaEntry?.photoCredit && <div className="photo-credit">{galeriaEntry.photoCredit}</div>}
          </div>

          <div className="person-hero-text">
            <div className="person-hero-eyebrow">Adatbázis · összesített ügyprofil</div>
            <h1 className="person-hero-name">Mészáros Lőrinc összes ügye</h1>
            <div className="person-hero-sub">
              {fmtNumber(rows.length)} önálló, tételes ügy az adatbázisból
            </div>

            <div className="person-hero-amount">
              <div className="person-hero-amount-lbl">Összesített érintett közpénz</div>
              <div className="person-hero-amount-val"><FtValue n={total} mode="long" /></div>
            </div>

            <p className="person-hero-desc">
              Összeszedtük Mészáros Lőrinc összes, az adatbázisban külön-külön dokumentált ügyét,
              hogy ne kelljen egyenként keresgélni és szűrni — itt a {fmtNumber(rows.length)} ügyből
              kiemeljük a legnagyobbakat, alattuk pedig a teljes lista is elérhető.
            </p>
          </div>
        </div>
      </div>

      <div className="person-body">
        <div className="ugy-description">
          <h2 className="person-section-title">A 10 legnagyobb ügy a K-Monitor adatbázisa alapján</h2>
          <p className="person-section-note">
            A {fmtNumber(rows.length)} ügyből ez a 10 adja az érintett közpénz kb. {topPct}%-át. Sajtójelentések és
            nyilvánosan hozzáférhető dokumentumok alapján. Jogerős ítélet hiányában az érintett
            személyek ártatlannak tekintendők.
          </p>
        </div>

        <div className="person-cases">
          {top.map((r, i) => {
            const dmg = BigInt(r.damage_huf ?? 0);
            const writeup = getMeszarosWriteup(r.id);
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
    </div>
  );
}
