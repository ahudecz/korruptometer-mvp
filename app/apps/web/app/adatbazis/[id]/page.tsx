import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';

import { fmtDate, fmtFt, fmtNumber } from '@korr/shared/format';
import { Mugshot } from '@korr/ui/mugshot';

import { getDb, schema } from '@/lib/db';

export const dynamic = 'force-dynamic';

type Hair = 'short' | 'bald' | 'wave' | 'cap' | 'slick';

export default async function CasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const { cases, rogueProfiles, newsArticles, sources } = schema;

  const caseRow = await db.query.cases.findFirst({
    where: eq(cases.id, id),
  });
  if (!caseRow) {
    notFound();
  }

  const profile = await db.query.rogueProfiles.findFirst({
    where: eq(rogueProfiles.caseId, id),
  });

  const articles = await db
    .select({
      id: newsArticles.id,
      headline: newsArticles.headline,
      excerpt: newsArticles.excerpt,
      sourceUrl: newsArticles.sourceUrl,
      publishedAt: newsArticles.publishedAt,
      tag: newsArticles.tag,
      sourceSlug: sources.slug,
      sourceName: sources.name,
    })
    .from(newsArticles)
    .leftJoin(sources, eq(newsArticles.sourceId, sources.id))
    .where(eq(newsArticles.relatedCaseId, id))
    .orderBy(newsArticles.publishedAt);

  return (
    <article className="section">
      <div style={{ marginBottom: 16, fontSize: 12, color: 'var(--muted)' }}>
        <Link href="/adatbazis">← Adatbázis</Link>
      </div>
      <div className="section-eyebrow">Ügy {caseRow.id}</div>
      <h2>{caseRow.name}</h2>
      <p className="lede">
        {caseRow.position} · {caseRow.region} · {caseRow.caseYear} ·{' '}
        <span
          className={
            caseRow.status === 'Lezárva'
              ? 'pill lezarva'
              : caseRow.status === 'Vádemelés'
                ? 'pill vad'
                : 'pill folyamatban'
          }
          style={{ marginLeft: 4 }}
        >
          {caseRow.status}
        </span>
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(220px, 280px) 1fr',
          gap: 32,
          alignItems: 'start',
          marginTop: 24,
        }}
      >
        <div className="rogue" style={{ overflow: 'hidden' }}>
          <div className="rogue-rank">
            <span>{caseRow.id}</span>
            <span>{caseRow.region}</span>
          </div>
          <div className={`rogue-mug ${profile?.detention === 'busted' ? 'desat' : ''}`}>
            <Mugshot
              caseId={caseRow.id}
              name={caseRow.name}
              variant={profile?.variant ?? 0}
              glasses={profile?.glasses ?? false}
              hair={(profile?.hair as Hair) ?? 'short'}
              detention={profile?.detention ?? 'loose'}
            />
            <div className={`status-strip ${profile?.detention ?? 'loose'}`}>
              {profile?.detentionLabel ?? '—'}
            </div>
          </div>
          <div className="rogue-name">{caseRow.name}</div>
          <div className="rogue-pos">
            {caseRow.position} · {caseRow.region} · {caseRow.caseYear}
          </div>
          <div className="rogue-tags">
            {(profile?.crimes ?? []).map((c) => (
              <span key={c} className="tag">
                {c}
              </span>
            ))}
          </div>
          <div className="rogue-amount">
            <span className="lbl">Gyanúsítva</span>
            <span className="val">{fmtFt(caseRow.amount)}</span>
          </div>
        </div>

        <div>
          <div className="kpi-grid" style={{ marginBottom: 32 }}>
            <div className="kpi">
              <div className="label">Érintett összeg</div>
              <div className="value">{fmtFt(caseRow.amount)}</div>
            </div>
            <div className="kpi">
              <div className="label">Szabadságvesztés</div>
              <div className="value">
                {fmtNumber(caseRow.sentenceYears)} év
              </div>
            </div>
            <div className="kpi">
              <div className="label">Szektor</div>
              <div className="value" style={{ fontSize: 22 }}>
                {caseRow.sector}
              </div>
            </div>
            <div className="kpi">
              <div className="label">Évszám</div>
              <div className="value">{caseRow.caseYear}</div>
            </div>
          </div>

          {profile?.extraStatus && (
            <div className="empty-state" style={{ textAlign: 'left' }}>
              <strong>Aktuális helyzet:</strong> {profile.extraStatus}
            </div>
          )}

          <h3 style={{ marginTop: 32, marginBottom: 12 }}>Kapcsolódó hírek</h3>
          {articles.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>
              Még nincs hozzárendelt cikk. A hírfolyam-illesztés csak a Phase 3
              után kapcsolja össze automatikusan a cikkeket az ügyekkel.
            </p>
          ) : (
            <div className="news-list">
              {articles.map((a) => (
                <a
                  key={a.id}
                  className="news-card"
                  href={a.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="news-meta">
                    <span>{a.sourceName ?? a.sourceSlug ?? '—'}</span>
                    <span>{fmtDate(a.publishedAt)}</span>
                  </div>
                  <strong>{a.headline}</strong>
                  <p style={{ color: 'var(--muted)', fontSize: 14 }}>{a.excerpt}</p>
                  {a.tag && (
                    <span className="pill" style={{ alignSelf: 'flex-start' }}>
                      {a.tag}
                    </span>
                  )}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
