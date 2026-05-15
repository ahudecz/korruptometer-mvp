'use client';

import { useEffect, useState } from 'react';

import { PercentileChart } from './percentile-chart';
import { PersonDecisionForm } from './person-decision-form';
import { STATE_BADGE_LABEL } from './persons-list';

export type PersonHeader = {
  id: string;
  displayName: string;
  mentionCount: number;
  articleCountWithAmount: number;
  p1: string | null;
  p10: string | null;
  p50: string | null;
  p90: string | null;
  p99: string | null;
  topTopics: { topic: string; count: number }[];
  topInstitutions: { institution: string; count: number }[];
  topPersons: { person: string; count: number }[];
  approvalState: 'pending' | 'approved' | 'rejected';
  caseId: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  total: string | null;
};

type ArticleRow = {
  newsId: number;
  title: string;
  sourceUrl: string;
  archiveUrl: string | null;
  pubTime: string | null;
  newspaper: string | null;
  topics: string[];
  amountHuf: string | null;
};

const PAGE_SIZE = 20;

function fmtFt(s: string | null): string {
  if (s == null) return '—';
  const v = Number(s);
  if (!Number.isFinite(v) || v === 0) return '—';
  if (v >= 1_000_000_000) {
    const mrd = Math.round((v / 1_000_000_000) * 10) / 10;
    return `${mrd.toLocaleString('hu-HU', { maximumFractionDigits: 1 })} Mrd Ft`;
  }
  if (v >= 1_000_000) return `${Math.round(v / 1_000_000).toLocaleString('hu-HU')} M Ft`;
  return `${v.toLocaleString('hu-HU')} Ft`;
}

export function PersonDetailPanel({
  person,
  onClose,
}: {
  person: PersonHeader | null;
  onClose: () => void;
}) {
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!person) {
      setArticles([]);
      setTotal(0);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/kmonitor-persons/${person.id}/articles?limit=${PAGE_SIZE}&offset=0`)
      .then((r) => r.json())
      .then((j: { total: number; articles: ArticleRow[] }) => {
        if (cancelled) return;
        setArticles(j.articles);
        setTotal(j.total);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [person?.id]);

  async function loadMore() {
    if (!person) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/kmonitor-persons/${person.id}/articles?limit=${PAGE_SIZE}&offset=${articles.length}`,
      );
      const j = (await res.json()) as { articles: ArticleRow[]; total: number };
      setArticles((prev) => [...prev, ...j.articles]);
      setTotal(j.total);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!person) {
    return (
      <div className="detail-empty">
        <div>
          <div className="icon">◌</div>
          <p>
            Válassz egy nevet a bal oldali listából — itt jelenik meg a részletes
            adatlap, a sajtóban dokumentált összegek eloszlása és a döntési műveletek.
          </p>
        </div>
      </div>
    );
  }

  const hasAmounts = person.p50 != null;
  return (
    <>
      <header className="detail-head">
        <div className="detail-rank">Dosszié</div>
        <h2 className="detail-name">{person.displayName}</h2>
        <div className="detail-meta">
          <span>
            <strong>{person.mentionCount.toLocaleString('hu-HU')}</strong> említés
          </span>
          <span className="sep" />
          <span>
            <strong>{person.articleCountWithAmount.toLocaleString('hu-HU')}</strong>{' '}
            cikk konkrét összeggel
          </span>
          <span className="sep" />
          <span className={`state-badge ${person.approvalState}`}>
            <span className="dot" />
            {STATE_BADGE_LABEL[person.approvalState]}
          </span>
          {person.caseId && (
            <>
              <span className="sep" />
              <code>{person.caseId}</code>
            </>
          )}
        </div>
        <button type="button" className="detail-close" onClick={onClose} aria-label="Bezár">
          ✕
        </button>
      </header>

      <section className="detail-section">
        <h4>
          Sajtóban dokumentált összegek <span className="aside">log skála · HUF</span>
        </h4>
        {hasAmounts ? (
          <div className="chart-card">
            <div className="chart-callout">
              <div>
                <small style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                  Összesen
                </small>
                <div className="median">{fmtFt(person.total)}</div>
              </div>
              <div className="spread">
                {person.articleCountWithAmount.toLocaleString('hu-HU')} cikk összegéből
                <br />
                medián: <strong>{fmtFt(person.p50)}</strong>
              </div>
            </div>
            <PercentileChart
              data={{
                p1: person.p1 == null ? null : BigInt(person.p1),
                p10: person.p10 == null ? null : BigInt(person.p10),
                p50: person.p50 == null ? null : BigInt(person.p50),
                p90: person.p90 == null ? null : BigInt(person.p90),
                p99: person.p99 == null ? null : BigInt(person.p99),
              }}
            />
          </div>
        ) : (
          <div className="chart-empty">
            Nincsenek számszerű összegek a cikkekben — döntés indokolt egyéb szempontok szerint.
          </div>
        )}
      </section>

      {person.topTopics.length > 0 && (
        <section className="detail-section">
          <h4>
            Vezető témák{' '}
            <span className="aside">{person.topTopics.length} kategória</span>
          </h4>
          <div className="chip-group">
            {person.topTopics.map((t, i) => (
              <span key={t.topic} className={`chip${i === 0 ? ' accent' : ''}`}>
                {t.topic} <span className="n">{t.count}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {person.topInstitutions.length > 0 && (
        <section className="detail-section">
          <h4>Intézményi kötődés</h4>
          <div className="chip-group">
            {person.topInstitutions.map((t) => (
              <span key={t.institution} className="chip">
                {t.institution} <span className="n">{t.count}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {person.topPersons.length > 0 && (
        <section className="detail-section">
          <h4>Gyakori együtt-említettek</h4>
          <div className="chip-group">
            {person.topPersons.map((t) => (
              <span key={t.person} className="chip">
                {t.person} <span className="n">{t.count}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="detail-section">
        <h4>
          Cikkek <span className="aside">{total.toLocaleString('hu-HU')} db · összeg szerint ↓</span>
        </h4>
        {error && (
          <div style={{ color: 'var(--accent)', fontSize: 12, marginBottom: 8 }}>
            Hiba: {error}
          </div>
        )}
        <div className="articles">
          {articles.map((a) => (
            <div key={a.newsId} className="article-item">
              <div>
                <a className="article-title" href={a.sourceUrl} target="_blank" rel="noopener noreferrer">
                  {a.title || '(cím nélkül)'}
                </a>
                <div className="article-meta">
                  {a.newspaper && <span className="source">{a.newspaper}</span>}
                  {a.pubTime && <span>{a.pubTime.slice(0, 10)}</span>}
                  {a.archiveUrl && (
                    <a className="archive" href={a.archiveUrl} target="_blank" rel="noopener noreferrer">
                      archive.org
                    </a>
                  )}
                </div>
              </div>
              <div className={`article-amount${a.amountHuf == null ? ' empty' : ''}`}>
                {fmtFt(a.amountHuf)}
              </div>
            </div>
          ))}
        </div>
        {articles.length < total && (
          <button type="button" className="article-more" disabled={loading} onClick={loadMore}>
            {loading ? 'Töltés…' : `További cikkek (${(total - articles.length).toLocaleString('hu-HU')})`}
          </button>
        )}
      </section>

      <PersonDecisionForm
        id={person.id}
        displayName={person.displayName}
        initialCaseId={person.caseId}
        current={person.approvalState}
        decidedAt={person.decidedAt}
        decidedBy={person.decidedBy}
      />
    </>
  );
}
