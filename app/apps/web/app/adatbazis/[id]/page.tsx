import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';

import { fmtDate, fmtFt, fmtNumber } from '@korr/shared/format';
import { Mugshot } from '@korr/ui/mugshot';

import { getDb, schema } from '@/lib/db';

export const dynamic = 'force-dynamic';

type Hair = 'short' | 'bald' | 'wave' | 'cap' | 'slick';
type Detention = 'loose' | 'wanted' | 'busted' | 'pretrial' | 'investig';

function statusPillClass(s: string): string {
  if (s === 'Lezárva') return 'pill lezarva';
  if (s === 'Vádemelés') return 'pill vad';
  return 'pill folyamatban';
}

function fmtRelative(d: Date): string {
  const diff = Date.now() - d.getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'most';
  if (h < 24) return `${h} órája`;
  if (h < 48) return 'tegnap';
  const days = Math.floor(h / 24);
  return `${days} napja`;
}

export default async function CasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const { cases, rogueProfiles, newsArticles, sources } = schema;

  const caseRow = await db.query.cases.findFirst({ where: eq(cases.id, id) });
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
      linkOverridden: newsArticles.linkOverridden,
      sourceSlug: sources.slug,
      sourceName: sources.name,
    })
    .from(newsArticles)
    .leftJoin(sources, eq(newsArticles.sourceId, sources.id))
    .where(eq(newsArticles.relatedCaseId, id))
    .orderBy(newsArticles.publishedAt);

  const detention: Detention = (profile?.detention as Detention) ?? 'loose';
  const isBusted = detention === 'busted';
  const isWanted = detention === 'wanted';

  return (
    <article className="case-detail">
      <Link href="/adatbazis" className="back-link">
        ← Adatbázis
      </Link>
      <div className="hero-eyebrow" style={{ marginBottom: 16 }}>
        Ügy {caseRow.id}
      </div>
      <h1>{caseRow.name}</h1>
      <div className="meta">
        <span>{caseRow.position}</span>
        <span style={{ color: 'var(--line-strong)' }}>·</span>
        <span>{caseRow.region}</span>
        <span style={{ color: 'var(--line-strong)' }}>·</span>
        <span>{caseRow.caseYear}</span>
        <span className={statusPillClass(caseRow.status)}>{caseRow.status}</span>
      </div>

      <div className="case-detail-grid">
        <div className={`rogue r-${detention}`} style={{ background: 'var(--ink)', color: '#fff' }}>
          <div className="rogue-rank">
            <span>{caseRow.id}</span>
            <span className="id">{caseRow.region}</span>
          </div>
          <div className={`rogue-mug ${isBusted ? 'desat' : ''}`}>
            <div className="corner-tag">{caseRow.id}</div>
            <Mugshot
              caseId={caseRow.id}
              name={caseRow.name}
              variant={profile?.variant ?? 0}
              glasses={profile?.glasses ?? false}
              hair={(profile?.hair as Hair) ?? 'short'}
              detention={detention}
            />
            {isBusted && (
              <>
                <div className="stamp">BUSTED</div>
                <div className="face-cross"></div>
              </>
            )}
            {isWanted && <div className="stamp small">WANTED</div>}
            <div className={`status-strip ${detention}`}>{profile?.detentionLabel ?? '—'}</div>
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
          <div className="case-stat-row">
            <div className="case-stat">
              <div className="label">Érintett összeg</div>
              <div className="value">{fmtFt(caseRow.amount)}</div>
            </div>
            <div className="case-stat">
              <div className="label">Szabadságvesztés</div>
              <div className="value">{fmtNumber(caseRow.sentenceYears)} év</div>
            </div>
          </div>
          <div className="case-stat-row">
            <div className="case-stat">
              <div className="label">Szektor</div>
              <div className="value" style={{ fontSize: 24 }}>
                {caseRow.sector}
              </div>
            </div>
            <div className="case-stat">
              <div className="label">Évszám</div>
              <div className="value">{caseRow.caseYear}</div>
            </div>
          </div>

          {profile?.extraStatus && (
            <div className="submission-assurance" style={{ marginTop: 32 }}>
              <strong>Aktuális helyzet</strong>
              {profile.extraStatus}
            </div>
          )}

          <div className="section-num" style={{ marginTop: 56, marginBottom: 24 }}>
            Kapcsolódó hírek
          </div>
          {articles.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>
              Még nincs hozzárendelt cikk. A hírfolyam-illesztés a Phase 3 után
              automatikusan kapcsolja össze a cikkeket az ügyekkel.
            </p>
          ) : (
            <div className="news-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {articles.map((a) => (
                <a
                  key={a.id}
                  className="news-card"
                  href={a.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="news-meta">
                    <span className="news-tag">{a.tag ?? a.sourceName ?? 'Hír'}</span>
                    <span className="news-time">{fmtRelative(a.publishedAt)}</span>
                  </div>
                  <h3 className="news-headline">{a.headline}</h3>
                  <p className="news-excerpt">{a.excerpt}</p>
                  <span className="news-source">
                    {a.sourceName ?? a.sourceSlug ?? 'Forrás'}
                    {a.linkOverridden ? ' · szerk.' : ''}
                  </span>
                  <span style={{ display: 'none' }}>{fmtDate(a.publishedAt)}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
