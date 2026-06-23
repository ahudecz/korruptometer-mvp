import Link from 'next/link';
import { sql } from 'drizzle-orm';

import { fmtFt, fmtNumber } from '@korr/shared/format';

import { getDb } from '@/lib/db';

import { CaseFilters, type ScandalFilterState } from './case-filters';

export const dynamic = 'force-dynamic';

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

function orderBySql(sort: Sort) {
  switch (sort) {
    case 'damage_asc':
      return sql`damage_huf ASC, id ASC`;
    case 'recent':
      return sql`created_at DESC NULLS LAST, id ASC`;
    case 'name':
      return sql`name ASC, id ASC`;
    case 'damage_desc':
    default:
      return sql`damage_huf DESC, id ASC`;
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

  const conds = [sql`TRUE`];
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

  return (
    <section className="section" id="database">
      <div className="section-head">
        <div className="section-num">03 / Adatbázis</div>
        <h2 className="section-title">Az ügyek nyilvántartása.</h2>
      </div>

      <CaseFilters offences={offences} initial={initial} />

      <div className="db-meta">
        <div className="db-count">
          <strong>{fmtNumber(page.length)}</strong> találat {fmtNumber(total)} ügyből
          {hasMore ? ' (folytatható)' : ''}
        </div>
        <div className="db-sort">
          <a href={sortHref('damage_desc')}>
            <button type="button" className={sort === 'damage_desc' ? 'active' : ''}>
              Kár ↓
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
          Nincs ilyen találat. Próbáld lazítani a szűrőket — különösen a min. kárt
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
              <th>Státusz</th>
              <th className="num">Becsült kár (Ft)</th>
            </tr>
          </thead>
          <tbody>
            {page.map((c) => (
              <tr key={c.id}>
                <td data-label="Ügy">
                  <Link href={`/adatbazis/${encodeURIComponent(c.id)}`} className="case-name">
                    {c.name}
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
                <td data-label="Státusz">
                  <span className={c.is_open ? 'pill folyamatban' : 'pill lezarva'}>
                    {c.is_open ? 'Folyamatban' : 'Lezárt'}
                  </span>
                </td>
                <td className="num" data-label="Becsült kár">
                  {BigInt(c.damage_huf) > 0n ? fmtFt(BigInt(c.damage_huf)) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {hasMore && (
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Link
            href={nextHref()}
            style={{
              display: 'inline-block',
              background: 'var(--ink)',
              color: '#fff',
              padding: '14px 28px',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              textDecoration: 'none',
            }}
          >
            További találatok →
          </Link>
        </div>
      )}
    </section>
  );
}
