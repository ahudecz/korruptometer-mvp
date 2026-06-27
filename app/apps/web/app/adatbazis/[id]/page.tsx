import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sql } from 'drizzle-orm';

import { fmtFt, fmtNumber } from '@korr/shared/format';

import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

type ScandalHeader = {
  id: string;
  name: string;
  person: string | null;
  institution: string | null;
  summary: string | null;
  article_count: number;
  investigation_count: number;
  damage_huf: string;
  is_open: boolean;
  offence_labels: string | null;
};

type Member = {
  id: string;
  caseName: string | null;
  primaryPersonName: string | null;
  primaryEntityName: string | null;
  articleCount: number;
};

type Article = {
  id: string;
  headline: string;
  excerpt: string | null;
  sourceUrl: string;
  publishedAt: Date;
  tag: string | null;
  source_name: string | null;
};

function fmtRelative(d: Date): string {
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'most';
  if (h < 24) return `${h} órája`;
  if (h < 48) return 'tegnap';
  return `${Math.floor(h / 24)} napja`;
}

export default async function ScandalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();

  const headRes = (await db.execute(sql`
    SELECT sc.id, sc.name, sc.person, sc.institution, sc.summary, sc.article_count,
           sc.investigation_count, sc.damage_huf, sc.is_open,
           (SELECT string_agg(o."labelHu", ', ' ORDER BY o."sortOrder")
            FROM "OffenceTypeRef" o WHERE o.code = ANY(sc.offence_codes)) AS offence_labels
    FROM "ScandalCatalog" sc WHERE sc.id = ${id} LIMIT 1
  `)) as unknown as ScandalHeader[];
  const scandal = headRes[0];
  if (!scandal) notFound();

  const offenceLabels = scandal.offence_labels
    ? scandal.offence_labels.split(', ').filter(Boolean)
    : [];

  const members = (await db.execute(sql`
    SELECT id, "caseName", "primaryPersonName", "primaryEntityName", "articleCount"
    FROM "Investigation"
    WHERE "scandalKey" = ${id} AND status NOT IN ('merged','dismissed')
    ORDER BY "articleCount" DESC NULLS LAST
  `)) as unknown as Member[];

  const articles = (await db.execute(sql`
    SELECT DISTINCT n.id, n.headline, n.excerpt, n."sourceUrl",
           n."publishedAt", n.tag, s.name AS source_name
    FROM "InvestigationArticleLink" l
    JOIN "Investigation" i ON i.id = l."investigationId"
    JOIN "NewsArticle" n ON n.id::text = l."articleId" AND l."articleSource" = 'news'
    LEFT JOIN "Source" s ON s.id = n."sourceId"
    WHERE i."scandalKey" = ${id}
    ORDER BY n."publishedAt" DESC
    LIMIT 30
  `)) as unknown as Article[];

  const damage = BigInt(scandal.damage_huf);

  return (
    <article className="case-detail">
      <Link href="/adatbazis" className="back-link">
        ← Adatbázis
      </Link>
      <div className="hero-eyebrow" style={{ marginBottom: 16 }}>
        Ügy
      </div>
      <h1>{scandal.name}</h1>
      <div className="meta">
        {scandal.person && <span>{scandal.person}</span>}
        {scandal.institution && (
          <>
            <span style={{ color: 'var(--line-strong)' }}>·</span>
            <span>{scandal.institution}</span>
          </>
        )}
        <span className={scandal.is_open ? 'pill folyamatban' : 'pill lezarva'}>
          {scandal.is_open ? 'Folyamatban' : 'Lezárt'}
        </span>
      </div>

      {scandal.summary && (
        <p style={{ maxWidth: 720, color: 'var(--ink-2)', marginTop: 16 }}>{scandal.summary}</p>
      )}

      <div className="case-stat-row" style={{ marginTop: 32 }}>
        <div className="case-stat">
          <div className="label">Becsült kár</div>
          <div className="value">{damage > 0n ? fmtFt(damage) : '—'}</div>
        </div>
        <div className="case-stat">
          <div className="label">Kapcsolódó ügyek</div>
          <div className="value">{fmtNumber(scandal.investigation_count)}</div>
        </div>
        <div className="case-stat">
          <div className="label">Cikkek</div>
          <div className="value">{fmtNumber(scandal.article_count)}</div>
        </div>
      </div>

      {offenceLabels.length > 0 && (
        <div className="rogue-tags" style={{ marginTop: 24 }}>
          {offenceLabels.map((l) => (
            <span key={l} className="tag">
              {l}
            </span>
          ))}
        </div>
      )}

      {scandal.investigation_count > 1 && (
        <>
          <div className="section-num" style={{ marginTop: 56, marginBottom: 24 }}>
            Kapcsolódó ügyek
          </div>
          <table className="db-table">
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>{m.caseName ?? '—'}</td>
                  <td>{m.primaryPersonName ?? '—'}</td>
                  <td>{m.primaryEntityName ?? '—'}</td>
                  <td className="num">{fmtNumber(m.articleCount)} cikk</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div className="section-num" style={{ marginTop: 56, marginBottom: 24 }}>
        Kapcsolódó hírek
      </div>
      {articles.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>Még nincs hozzárendelt cikk.</p>
      ) : (
        <div className="news-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {articles.map((a) => (
            <a key={a.id} className="news-card" href={a.sourceUrl} target="_blank" rel="noopener noreferrer">
              <div className="news-meta">
                <span className="news-tag">{a.tag ?? a.source_name ?? 'Hír'}</span>
                <span className="news-time">{fmtRelative(a.publishedAt)}</span>
              </div>
              <h3 className="news-headline">{a.headline}</h3>
              {a.excerpt && <p className="news-excerpt">{a.excerpt}</p>}
              <span className="news-source">{a.source_name ?? 'Forrás'}</span>
            </a>
          ))}
        </div>
      )}
    </article>
  );
}
