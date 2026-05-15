'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { PersonDetailPanel, type PersonHeader } from './person-detail-panel';

export type FilterState = {
  q: string;
  state: 'all' | 'pending' | 'approved' | 'rejected';
  topic: string;
  sort: 'mentions' | 'total' | 'name' | 'recent';
  dir: 'asc' | 'desc';
  page: number;
};

export const STATE_BADGE_LABEL: Record<PersonHeader['approvalState'], string> = {
  pending: 'Sorban',
  approved: 'Jóváhagyva',
  rejected: 'Elutasítva',
};

const STATE_OPTIONS: { value: FilterState['state']; label: string; dot: string | null }[] = [
  { value: 'all', label: 'Mind', dot: null },
  { value: 'pending', label: 'Sorban', dot: '#8b5a00' },
  { value: 'approved', label: 'Jóváhagyva', dot: '#0a5c2e' },
  { value: 'rejected', label: 'Elutasítva', dot: '#c41530' },
];

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

function fmtRank(i: number): string {
  return String(i).padStart(3, '0');
}

// Default direction per sort key. Click on an inactive header lands here.
const DEFAULT_DIR: Record<FilterState['sort'], FilterState['dir']> = {
  mentions: 'desc',
  total: 'desc',
  name: 'asc',
  recent: 'desc',
};

function buildHref(filter: FilterState, overrides: Partial<FilterState>): string {
  const merged = { ...filter, ...overrides };
  const next: Record<string, string> = {};
  if (merged.q) next.q = merged.q;
  if (merged.state !== 'all') next.state = merged.state;
  if (merged.topic) next.topic = merged.topic;
  if (merged.sort !== 'mentions') next.sort = merged.sort;
  if (merged.dir !== DEFAULT_DIR[merged.sort]) next.dir = merged.dir;
  if (merged.page > 1) next.page = String(merged.page);
  const qs = new URLSearchParams(next).toString();
  return qs ? `/admin/kmonitor-persons?${qs}` : '/admin/kmonitor-persons';
}

type Pop = 'topic' | 'state' | null;

export function PersonsList({
  rows,
  filter,
  filteredTotal,
  totalPages,
  topicUniverse,
  stateCounts,
}: {
  rows: PersonHeader[];
  filter: FilterState;
  filteredTotal: number;
  totalPages: number;
  topicUniverse: string[];
  stateCounts: { all: number; pending: number; approved: number; rejected: number };
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(rows[0]?.id ?? null);
  const [pop, setPop] = useState<Pop>(null);
  const [searchValue, setSearchValue] = useState(filter.q);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );

  // Sync search input when URL changes.
  useEffect(() => {
    setSearchValue(filter.q);
  }, [filter.q]);

  useEffect(() => {
    if (!selectedId && rows[0]) setSelectedId(rows[0].id);
    else if (selectedId && !rows.find((r) => r.id === selectedId)) {
      setSelectedId(rows[0]?.id ?? null);
    }
  }, [rows, selectedId]);

  const moveSelection = useCallback(
    (delta: number) => {
      if (rows.length === 0) return;
      const idx = rows.findIndex((r) => r.id === selectedId);
      const next = idx < 0 ? 0 : Math.min(rows.length - 1, Math.max(0, idx + delta));
      setSelectedId(rows[next]!.id);
    },
    [rows, selectedId],
  );

  // Global keyboard shortcuts.
  useEffect(() => {
    function isEditable(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
    }
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/' && !isEditable(e.target)) {
        e.preventDefault();
        document.getElementById('kmp-q')?.focus();
        return;
      }
      if (isEditable(e.target)) return;
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        moveSelection(1);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        moveSelection(-1);
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        rootRef.current?.querySelector<HTMLButtonElement>('[data-decision="approved"]')?.click();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        rootRef.current?.querySelector<HTMLButtonElement>('[data-decision="rejected"]')?.click();
      } else if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        rootRef.current?.querySelector<HTMLButtonElement>('[data-decision="pending"]')?.click();
      } else if (e.key === 'Escape' && pop) {
        setPop(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moveSelection, pop]);

  // Close popover on outside click.
  useEffect(() => {
    if (!pop) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest('.list-pop') || target.closest('[data-pop-trigger]')) return;
      setPop(null);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [pop]);

  function go(overrides: Partial<FilterState>) {
    setPop(null);
    router.push(buildHref(filter, { page: 1, ...overrides }));
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    go({ q: searchValue.trim() });
  }

  function clearSearch() {
    setSearchValue('');
    go({ q: '' });
  }

  function toggleSort(target: FilterState['sort']) {
    // Clicking the active sort flips direction; clicking another column resets
    // to that column's default direction.
    if (filter.sort === target) {
      go({ sort: target, dir: filter.dir === 'desc' ? 'asc' : 'desc' });
    } else {
      go({ sort: target, dir: DEFAULT_DIR[target] });
    }
  }

  const sortIs = (s: FilterState['sort']) => filter.sort === s;
  const sortCaret = (s: FilterState['sort']) =>
    sortIs(s) ? (filter.dir === 'asc' ? '↑' : '↓') : '';

  const stateOption = STATE_OPTIONS.find((o) => o.value === filter.state) ?? STATE_OPTIONS[0]!;

  const prevDisabled = filter.page <= 1;
  const nextDisabled = filter.page >= totalPages;

  return (
    <>
      <div className="kmp-tools">
        <form className="kmp-search" onSubmit={submitSearch}>
          <span className="kmp-search-prefix">Keresés</span>
          <input
            id="kmp-q"
            type="search"
            placeholder="Mészáros, Tiborcz, Rogán… (Enter)"
            autoComplete="off"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
          {searchValue && (
            <button type="button" className="clear" onClick={clearSearch} aria-label="Törlés">
              ✕
            </button>
          )}
        </form>
        <div className="kmp-tools-meta">
          <span>
            <strong>{rows.length.toLocaleString('hu-HU')}</strong> /{' '}
            <strong>{filteredTotal.toLocaleString('hu-HU')}</strong> személy
          </span>
          <span className="pager">
            Oldal <strong>{filter.page}</strong> / <strong>{totalPages}</strong>
            <a
              href={buildHref(filter, { page: Math.max(1, filter.page - 1) })}
              aria-label="Előző oldal"
              aria-disabled={prevDisabled || undefined}
            >
              ‹
            </a>
            <a
              href={buildHref(filter, { page: Math.min(totalPages, filter.page + 1) })}
              aria-label="Következő oldal"
              aria-disabled={nextDisabled || undefined}
            >
              ›
            </a>
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="workbench">
          <section
            className="wb-pane"
            style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}
          >
            Nincs a szűrésnek megfelelő személy.
          </section>
        </div>
      ) : (
        <main className="workbench" ref={rootRef}>
          <section className="wb-pane">
            <div className="list-head">
              <div className="th num">#</div>
              <button
                type="button"
                className={`th${sortIs('mentions') ? ' is-active' : ''}`}
                onClick={() => toggleSort('mentions')}
                title="Sort by mentions"
              >
                Név · említések
                <span className="caret">{sortCaret('mentions')}</span>
              </button>
              <button
                type="button"
                className={`th num${sortIs('total') ? ' is-active' : ''}`}
                onClick={() => toggleSort('total')}
                title="Sort by total stolen amount"
              >
                Ellopott összeg
                <span className="caret">{sortCaret('total')}</span>
              </button>
              <div className="th-wrap hide-sm">
                <button
                  type="button"
                  className={`th${filter.topic ? ' is-active' : ''}`}
                  data-pop-trigger
                  onClick={() => setPop(pop === 'topic' ? null : 'topic')}
                >
                  Vezető téma
                  <span className="caret">{filter.topic ? '●' : '▾'}</span>
                </button>
                {pop === 'topic' && (
                  <div className="list-pop" role="menu">
                    <button
                      type="button"
                      className={filter.topic === '' ? 'is-active' : ''}
                      onClick={() => go({ topic: '' })}
                    >
                      <span>Mind</span>
                    </button>
                    <div className="sep" />
                    {topicUniverse.map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={filter.topic === t ? 'is-active' : ''}
                        onClick={() => go({ topic: t })}
                      >
                        <span>{t}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div
                className="th-wrap hide-sm badge-cell-th"
                style={{ position: 'relative', justifySelf: 'end' }}
              >
                <button
                  type="button"
                  className={`th${filter.state !== 'all' ? ' is-active' : ''}`}
                  data-pop-trigger
                  onClick={() => setPop(pop === 'state' ? null : 'state')}
                >
                  Állapot
                  <span className="caret">{filter.state !== 'all' ? '●' : '▾'}</span>
                </button>
                {pop === 'state' && (
                  <div className="list-pop" role="menu" data-align="right">
                    {STATE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={filter.state === opt.value ? 'is-active' : ''}
                        onClick={() => go({ state: opt.value })}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          {opt.dot && (
                            <span
                              style={{
                                width: 7,
                                height: 7,
                                borderRadius: '50%',
                                background: opt.dot,
                                display: 'inline-block',
                              }}
                            />
                          )}
                          {opt.label}
                        </span>
                        <span className="n">{stateCounts[opt.value].toLocaleString('hu-HU')}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="list-scroll">
              {rows.map((p, i) => {
                const isSelected = p.id === selectedId;
                const topTopic = p.topTopics[0]?.topic ?? null;
                const topPerson = p.topPersons[0]?.person ?? null;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`list-row${isSelected ? ' is-selected' : ''}`}
                    onClick={() => setSelectedId(p.id)}
                    data-id={p.id}
                  >
                    <div className="rank">
                      {fmtRank((filter.page - 1) * 50 + i + 1)}
                    </div>
                    <div className="person">
                      <div className="name">{p.displayName}</div>
                      <div className="meta">
                        <span>
                          <strong>{p.mentionCount.toLocaleString('hu-HU')}</strong> említés
                        </span>
                        <span className="sep" />
                        <span>
                          <strong>{p.articleCountWithAmount.toLocaleString('hu-HU')}</strong> cikk
                          összeggel
                        </span>
                        {topPerson && (
                          <>
                            <span className="sep" />
                            <span>
                              együtt: <strong>{topPerson}</strong>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className={`p50${p.total == null ? ' empty' : ''}`}>
                      {fmtFt(p.total)}
                    </div>
                    <div className="hide-sm">
                      {topTopic ? (
                        <span className="tag" title={topTopic}>
                          {topTopic}
                        </span>
                      ) : (
                        <span className="tag empty">—</span>
                      )}
                    </div>
                    <div className="hide-sm badge-cell">
                      <span className={`state-badge ${p.approvalState}`}>
                        <span className="dot" />
                        {STATE_BADGE_LABEL[p.approvalState]}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="wb-pane detail">
            <PersonDetailPanel person={selected} onClose={() => setSelectedId(null)} />
          </aside>
        </main>
      )}
    </>
  );
}
