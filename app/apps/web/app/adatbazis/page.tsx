import Link from 'next/link';
import { sql } from 'drizzle-orm';

import { fmtNumber } from '@korr/shared/format';
import { FtValue } from '../_home/ft-value';
import { CaseRow } from './_components/case-row';
import { autoDisplayTitle, getCaseDisplayTitle, getCaseOverride, HIDDEN_DAMAGE_IDS, RETIRED_SCANDAL_IDS, toAsciiId } from '../_home/case-detail-config';
import { getFeaturedPeople, getTotalDamage } from '../_home/featured-persons';
import { CrossUgyek, CrossLemondosok, CrossGaleria, CrossMegszunt, CrossFelszolitottak } from '../_home/cross-promo';

import { getDb } from '@/lib/db';

import { CaseFilters, type ScandalFilterState } from './case-filters';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Adatbázis',
  description: 'Kereshető, szűrhető adatbázis a dokumentált magyar korrupciós ügyekről — érintettek, összegek és intézmények szerint. Kattints, és keress rá egy ügyre!',
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PAGE_SIZE = 50;
const SORTS = ['damage_desc', 'damage_asc', 'recent', 'name'] as const;
type Sort = (typeof SORTS)[number];

type ScandalRow = {
  id: string;
  name: string;
  person: string | null;
  institution: string | null;
  article_count: number;
  investigation_count: number;
  damage_huf: string; // int8 over raw driver → string
  is_open: boolean;
};

// Rows with a hideAutoDamage override show "Becslés alatt" instead of the
// raw number (see the table below) — sorting by "Közpénz" must not rank those
// artifact/suppressed figures above real ones just because damage_huf is
// still a big raw number under the hood.
function orderBySql(sort: Sort) {
  const suppressedLast = HIDDEN_DAMAGE_IDS.length > 0
    ? sql`(id IN (${sql.join(HIDDEN_DAMAGE_IDS.map((v) => sql`${v}`), sql`, `)}))`
    : sql`FALSE`;
  switch (sort) {
    case 'damage_asc':
      return sql`${suppressedLast} ASC, damage_huf ASC, id ASC`;
    case 'recent':
      return sql`created_at DESC NULLS LAST, id ASC`;
    case 'name':
      return sql`name ASC, id ASC`;
    case 'damage_desc':
    default:
      return sql`${suppressedLast} ASC, damage_huf DESC, id ASC`;
  }
}

export default async function AdatbazisPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (typeof val === 'string') flat[k] = val;
  }

  const q = flat.q?.trim() ?? '';
  const offence = flat.offence?.trim() ?? '';
  const open = flat.open === 'open' || flat.open === 'closed' ? flat.open : '';
  const minDamage = /^\d+$/.test(flat.minDamage ?? '') ? BigInt(flat.minDamage!) : 0n;
  const sort: Sort = (SORTS as readonly string[]).includes(flat.sort ?? '')
    ? (flat.sort as Sort)
    : 'damage_desc';
  const off = /^\d+$/.test(flat.off ?? '') ? Math.min(Number(flat.off), 100000) : 0;

  const db = getDb();

  // "Kiemelt személyek" strip: live total per featured person, respecting
  // each rollup's excludeIds (duplicates/artifacts) so the number shown here
  // matches what the rollup page itself reports.
  const featuredPeople = await getFeaturedPeople(db);
  const featuredSum = featuredPeople.reduce((s, p) => s + p.total, 0n);
  const totalDamageAll = await getTotalDamage(db);
  const featuredPct = totalDamageAll > 0n ? Math.round((Number(featuredSum) / Number(totalDamageAll)) * 1000) / 10 : 0;
  // Kerekítve 100 Mrd-ra a headline-hoz — sosem túloz (floor), és egy kerek,
  // megjegyezhető szám ("TOP 7000 milliárd") jobb egy címben, mint a pontos
  // (folyamatosan változó) összeg.
  const featuredSumRoundedMrd = Math.floor(Number(featuredSum) / 1e9 / 100) * 100;

  // Retired/merged duplicate ids (see RETIRED_REDIRECTS in [id]/page.tsx) are
  // hidden from the general listing so they don't dangle as stale, double-
  // counting rows. Found during the 2026-07-05 person-rollup data audit.
  const conds = [sql`id NOT IN (${sql.join(RETIRED_SCANDAL_IDS.map((v) => sql`${v}`), sql`, `)})`];
  if (q) {
    const pat = `%${q}%`;
    conds.push(
      sql`(name ILIKE ${pat} OR coalesce(person,'') ILIKE ${pat} OR coalesce(institution,'') ILIKE ${pat} OR coalesce(summary,'') ILIKE ${pat})`,
    );
  }
  if (offence) conds.push(sql`offence_codes && ARRAY[${offence}]::text[]`);
  if (open === 'open') conds.push(sql`is_open = TRUE`);
  if (open === 'closed') conds.push(sql`is_open = FALSE`);
  if (minDamage > 0n) conds.push(sql`damage_huf >= ${minDamage.toString()}`);
  const where = sql.join(conds, sql` AND `);

  const rows = (await db.execute(sql`
    SELECT id, name, person, institution, article_count, investigation_count, damage_huf, is_open
    FROM "ScandalCatalog"
    WHERE ${where}
    ORDER BY ${orderBySql(sort)}
    LIMIT ${PAGE_SIZE + 1} OFFSET ${off}
  `)) as unknown as ScandalRow[];

  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  const totalRes = (await db.execute(
    sql`SELECT count(*)::int AS c FROM "ScandalCatalog" WHERE ${where}`,
  )) as unknown as Array<{ c: number }>;
  const total = totalRes[0]?.c ?? 0;

  const offRows = (await db.execute(
    sql`SELECT code, "labelHu" AS label FROM "OffenceTypeRef" ORDER BY "sortOrder", "labelHu"`,
  )) as unknown as Array<{ code: string; label: string }>;
  const offences = offRows.map((o) => ({ code: o.code, label: o.label }));

  const initial: ScandalFilterState = { q, offence, open, minDamage: flat.minDamage, sort };

  function sortHref(s: Sort) {
    const next = new URLSearchParams(flat);
    next.set('sort', s);
    next.delete('off');
    return `/adatbazis?${next.toString()}`;
  }
  function nextHref() {
    const next = new URLSearchParams(flat);
    next.set('off', String(off + PAGE_SIZE));
    return `/adatbazis?${next.toString()}`;
  }
  function prevHref() {
    const next = new URLSearchParams(flat);
    const prev = off - PAGE_SIZE;
    if (prev <= 0) next.delete('off'); else next.set('off', String(prev));
    return `/adatbazis?${next.toString()}`;
  }
  const rangeFrom = off + 1;
  const rangeTo = off + page.length;
  const showRange = off > 0 || hasMore;

  return (
    <>
    <section className="section" id="database">
      <div className="section-head">
        <div className="section-num">03 / Adatbázis</div>
        <h2 className="section-title">Az ügyek nyilvántartása.</h2>
      </div>

      <p className="section-partner-note">
        Együttműködő partnerünk a{' '}
        <a href="https://k-monitor.hu" target="_blank" rel="noopener noreferrer">
          <strong>K-Monitor</strong>
        </a>{' '}
        — az ő teljes, nyilvánosan hozzáférhető adatbázisuk (64 000+ dokumentált eset) szolgál
        az itt látható elemzés alapjául. Az adatokat feldolgoztuk, szűrtük és rendszerezve jelenítjük meg.
      </p>

      {featuredPeople.length > 0 && (
        <div className="featured-persons" style={{ marginBottom: 32 }}>
          <h2 className="person-section-title">
            Kiemelt személyek — a TOP {featuredSumRoundedMrd.toLocaleString('hu-HU')} milliárd Ft közpénz útja
          </h2>
          <p className="person-section-note">
            A K-Monitor adatbázisa alapján összefűztük a kiemelt személyekhez tartozó ügyeket,
            hogy megspóroljuk az időd a szűrésre és a felesleges kattintgatásra — egy kattintással
            az adott személy összes, tételes ügye és a legnagyobbak áttekintése (K-Monitor-adatok
            alapján). Erre a 12 emberre összesen{' '}
            <strong><FtValue n={featuredSum} /></strong> dokumentáltan érintett közpénz jut — ez a
            teljes adatbázisban érintett közpénz{' '}
            <strong>{String(featuredPct).replace('.', ',')}%-a</strong>.
          </p>
          <div className="featured-persons-grid">
            {featuredPeople.map((p) => (
              <Link key={p.slug} href={`/adatbazis/szemely/${p.slug}`} className="featured-person-card">
                <div className="featured-person-photo">
                  {p.photoUrl ? (
                    <img src={p.photoUrl} alt={p.name} className="featured-person-img" />
                  ) : (
                    <div className="featured-person-placeholder">
                      <span>{p.name.split(' ').slice(0, 2).map((w) => w[0]).join('')}</span>
                    </div>
                  )}
                </div>
                <div className="featured-person-text">
                  <div className="featured-person-name">{p.name}</div>
                  <div className="featured-person-dmg-lbl">Érintett közpénz</div>
                  <div className="featured-person-stat"><FtValue n={p.total} /></div>
                  <div className="featured-person-cases">{fmtNumber(p.caseCount)} ügy</div>
                  <div className="featured-person-cta">Összes ügy →</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 8, marginBottom: 32 }}>
        <h3 className="person-section-title">Teljes adatbázis</h3>
        <p className="person-section-note">
          Az összes dokumentált ügy, szűrhetően — a K-Monitor adatbázisa alapján.
        </p>
      </div>

      <CaseFilters offences={offences} initial={initial} />

      <div className="db-meta">
        <div className="db-count">
          {showRange ? (
            <><strong>{fmtNumber(rangeFrom)}–{fmtNumber(rangeTo)}</strong> találat {fmtNumber(total)} ügyből</>
          ) : (
            <><strong>{fmtNumber(page.length)}</strong> találat {fmtNumber(total)} ügyből</>
          )}
        </div>
        <div className="db-sort">
          <a href={sortHref('damage_desc')}>
            <button type="button" className={sort === 'damage_desc' ? 'active' : ''}>
              Közpénz ↓
            </button>
          </a>
          <a href={sortHref('recent')}>
            <button type="button" className={sort === 'recent' ? 'active' : ''}>
              Friss ↓
            </button>
          </a>
          <a href={sortHref('name')}>
            <button type="button" className={sort === 'name' ? 'active' : ''}>
              Név A–Z
            </button>
          </a>
        </div>
      </div>

      {page.length === 0 ? (
        <div className="empty-state">
          Nincs ilyen találat. Próbáld lazítani a szűrőket — különösen a min. közpénz-érintettséget
          vagy a jogsértés típusát.
        </div>
      ) : (
        <table className="db-table">
          <thead>
            <tr>
              <th>Ügy</th>
              <th>Felelős</th>
              <th>Intézmény</th>
              <th className="num">Cikkek</th>
              <th className="num">Érintett közpénz (Ft)</th>
            </tr>
          </thead>
          <tbody>
            {page.map((c) => (
              <CaseRow key={c.id} href={`/adatbazis/${encodeURIComponent(toAsciiId(c.id))}`}>
                <td data-label="Ügy">
                  <Link href={`/adatbazis/${encodeURIComponent(toAsciiId(c.id))}`} className="case-name">
                    {autoDisplayTitle(c.name, c.person ?? null, getCaseDisplayTitle(c.id))}
                  </Link>
                  {c.investigation_count > 1 && (
                    <div className="case-id">{fmtNumber(c.investigation_count)} kapcsolódó ügy</div>
                  )}
                </td>
                <td data-label="Felelős">
                  <div style={{ fontSize: 14, color: 'var(--ink)' }}>{c.person ?? '—'}</div>
                </td>
                <td data-label="Intézmény">{c.institution ?? '—'}</td>
                <td className="num" data-label="Cikkek">
                  {fmtNumber(c.article_count)}
                </td>
                <td className="num db-damage-cell" data-label="Érintett közpénz">
                  {getCaseOverride(c.id)?.hideAutoDamage ? (
                    <span style={{ color: 'var(--muted)', fontStyle: 'italic', fontSize: 13 }}>Becslés alatt</span>
                  ) : BigInt(c.damage_huf) > 0n ? (
                    <FtValue n={BigInt(c.damage_huf)} />
                  ) : (
                    '—'
                  )}
                </td>
              </CaseRow>
            ))}
          </tbody>
        </table>
      )}

      {(off > 0 || hasMore) && (
        <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          {off > 0 && (
            <Link
              href={prevHref()}
              style={{
                display: 'inline-block',
                border: '2px solid var(--ink)',
                color: 'var(--ink)',
                background: 'transparent',
                padding: '12px 24px',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                textDecoration: 'none',
              }}
            >
              ← Előző {PAGE_SIZE}
            </Link>
          )}
          <span style={{ fontSize: 13, color: 'var(--muted)', minWidth: 120, textAlign: 'center' }}>
            {fmtNumber(rangeFrom)}–{fmtNumber(rangeTo)} / {fmtNumber(total)}
          </span>
          {hasMore && (
            <Link
              href={nextHref()}
              style={{
                display: 'inline-block',
                background: 'var(--ink)',
                color: '#fff',
                padding: '12px 24px',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                textDecoration: 'none',
              }}
            >
              Következő {PAGE_SIZE} →
            </Link>
          )}
        </div>
      )}
    </section>

      <div className="cross-promo-section">
        <div className="cross-promo-section-inner">
          <CrossUgyek />
          <CrossLemondosok />
          <CrossGaleria />
          <CrossMegszunt />
          <CrossFelszolitottak />
        </div>
      </div>
    </>
  );
}
