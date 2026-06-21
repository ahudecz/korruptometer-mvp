'use client';

import Link from 'next/link';
import { useState, useRef, useEffect, useMemo } from 'react';

export type SerializedVerdict = {
  id: string;
  personName: string;
  position: string;
  crimes: string[];
  sentenceYears: number;
  sentenceMonths: number | null;
  verdictType: string;
  verdictDateFormatted: string;
  court: string;
  summary: string;
  sourceUrls: string[];
  sourceNames: string[];
  sourceHeadlines: string[];
  sourceDates: string[];
  videoId: string | null;
  videoChannel: string | null;
  videoTitle: string | null;
  videoSummary: string | null;
  photoUrl: string | null;
  relatedUgy: { id: string; title: string; eyebrow: string; responsible?: string; summary: string } | null;
  relatedGaleria: { id: string; name: string; subtitle: string } | null;
};

const YEAR_RANGES: Record<string, [number, number | null]> = {
  '1-5':   [1,  5],
  '6-10':  [6,  10],
  '11-15': [11, 15],
  '15+':   [15, null],
};

function verdictTypeLabel(t: string) {
  if (t === 'jogerős') return 'Jogerős ítélet';
  if (t === 'elsőfokú') return 'Elsőfokú ítélet';
  if (t === 'fellebbezés alatt') return 'Fellebbezés alatt';
  return t;
}
function verdictTypeColor(t: string) {
  if (t === 'jogerős') return '#E31937';
  if (t === 'elsőfokú') return '#FF9D00';
  if (t === 'fellebbezés alatt') return '#4B7AFF';
  return '#888';
}

function VerdictCard({ r }: { r: SerializedVerdict }) {
  const initials = r.personName.split(' ').slice(0, 2).map(w => w[0]).join('');
  return (
    <div className="verdict-card">
      <div className="verdict-card-header">
        <div className="verdict-photo-wrap">
          {r.photoUrl ? (
            <img src={r.photoUrl} alt={r.personName} className="verdict-photo-img" />
          ) : (
            <div className="verdict-photo-placeholder"><span>{initials}</span></div>
          )}
        </div>

        <div className="verdict-person-info">
          <div className="verdict-name">{r.personName}</div>
          <div className="verdict-position">{r.position}</div>
          <div className="verdict-crimes">
            {r.crimes.map((c, i) => <span key={i} className="verdict-crime-tag">{c}</span>)}
          </div>
          <div className="verdict-court-line">
            <strong>{r.court}</strong>
            <span> · </span>
            <span>{r.verdictDateFormatted}</span>
            <span
              className="verdict-type-badge"
              style={{ background: `${verdictTypeColor(r.verdictType)}25`, color: verdictTypeColor(r.verdictType) }}
            >
              {verdictTypeLabel(r.verdictType)}
            </span>
          </div>
        </div>

        <div className="verdict-sentence-badge">
          <span className="verdict-sentence-years">{r.sentenceYears}</span>
          <span className="verdict-sentence-unit">ÉV</span>
          {r.sentenceMonths ? <span className="verdict-sentence-months">+{r.sentenceMonths}hó</span> : null}
        </div>
      </div>

      <div className="verdict-body">
        <p className="verdict-summary">{r.summary}</p>

        {r.videoId && (
          <div className="ugy-block-video verdict-video">
            <div className="ugy-block-video-meta">
              {r.videoChannel && <span className="ugy-block-video-label">{r.videoChannel}</span>}
              {r.videoTitle && <span className="ugy-block-video-title">{r.videoTitle}</span>}
            </div>
            {r.videoSummary && <p className="ugy-block-video-summary">{r.videoSummary}</p>}
            <div className="ugy-block-video-wrap">
              <iframe
                src={`https://www.youtube.com/embed/${r.videoId}`}
                title={r.videoTitle ?? r.personName}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        )}

        {r.sourceUrls.length > 0 && (
          <div className="verdict-sources-section">
            <div className="verdict-sources-heading">Sajtóforrások</div>
            <div className="verdict-source-cards">
              {r.sourceUrls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="person-news-item verdict-source-card">
                  <span className="person-news-source">{r.sourceNames[i] ?? 'Forrás'}</span>
                  {r.sourceDates[i] && <span className="person-news-date">{r.sourceDates[i]}</span>}
                  <span className="person-news-headline">{r.sourceHeadlines[i] ?? url}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {(r.relatedUgy || r.relatedGaleria) && (
          <div className="verdict-related-section">
            <div className="verdict-sources-heading">
              {r.relatedUgy ? 'Kapcsolódó ügy' : 'Kiemelt személy a galériában'}
            </div>
            {r.relatedUgy && (
              <Link href={`/ugyek/${r.relatedUgy.id}`} className="verdict-related-card">
                <div className="verdict-related-eyebrow">{(r.relatedUgy.eyebrow.split('·')[0] ?? '').trim()}</div>
                <div className="verdict-related-title">{r.relatedUgy.title}</div>
                {r.relatedUgy.responsible && <div className="verdict-related-sub">{r.relatedUgy.responsible}</div>}
                <p className="verdict-related-summary">{r.relatedUgy.summary}</p>
                <span className="verdict-related-cta">Az ügy részletei →</span>
              </Link>
            )}
            {!r.relatedUgy && r.relatedGaleria && (
              <Link href={`/galeria/${r.relatedGaleria.id}`} className="verdict-related-card">
                <div className="verdict-related-title">{r.relatedGaleria.name}</div>
                <div className="verdict-related-sub">{r.relatedGaleria.subtitle}</div>
                <span className="verdict-related-cta">Galériabeli profil →</span>
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function VerdictList({ rows }: { rows: SerializedVerdict[] }) {
  const [search, setSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [verdictTypeFilter, setVerdictTypeFilter] = useState('all');
  const [crimeFilter, setCrimeFilter] = useState<string[]>([]);
  const [yearRange, setYearRange] = useState('all');
  const [courtFilter, setCourtFilter] = useState('all');
  const [showCrimeDropdown, setShowCrimeDropdown] = useState(false);
  const [showCourtDropdown, setShowCourtDropdown] = useState(false);

  const crimeRef = useRef<HTMLDivElement>(null);
  const courtRef = useRef<HTMLDivElement>(null);

  const allCrimes = useMemo(() => [...new Set(rows.flatMap(r => r.crimes))].sort(), [rows]);
  const allCourts = useMemo(() => [...new Set(rows.map(r => r.court))].sort(), [rows]);

  const suggestions = useMemo(() => {
    if (search.length < 3) return [];
    const q = search.toLowerCase();
    return [...new Set(rows.map(r => r.personName))].filter(n => n.toLowerCase().includes(q));
  }, [search, rows]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (crimeRef.current && !crimeRef.current.contains(e.target as Node)) setShowCrimeDropdown(false);
      if (courtRef.current && !courtRef.current.contains(e.target as Node)) setShowCourtDropdown(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const filtered = useMemo(() => rows.filter(r => {
    if (search && !r.personName.toLowerCase().includes(search.toLowerCase())) return false;
    if (verdictTypeFilter !== 'all' && r.verdictType !== verdictTypeFilter) return false;
    if (crimeFilter.length > 0 && !crimeFilter.some(c => r.crimes.includes(c))) return false;
    if (yearRange !== 'all') {
      const range = YEAR_RANGES[yearRange];
      if (range) {
        const [min, max] = range;
        if (r.sentenceYears < min || (max !== null && r.sentenceYears > max)) return false;
      }
    }
    if (courtFilter !== 'all' && r.court !== courtFilter) return false;
    return true;
  }), [rows, search, verdictTypeFilter, crimeFilter, yearRange, courtFilter]);

  const hasFilter = search || verdictTypeFilter !== 'all' || crimeFilter.length > 0 || yearRange !== 'all' || courtFilter !== 'all';
  const totalYears = filtered.reduce((s, r) => s + r.sentenceYears, 0);
  const jogerosCount = filtered.filter(r => r.verdictType === 'jogerős').length;

  function clearAll() {
    setSearch(''); setVerdictTypeFilter('all'); setCrimeFilter([]); setYearRange('all'); setCourtFilter('all');
  }

  return (
    <>
      {/* Stats — szűrés alapján frissülnek */}
      <div className="megszunt-stats megszunt-stats--3">
        <div className="megszunt-stat">
          <div className="megszunt-stat-value">{filtered.length}</div>
          <div className="megszunt-stat-label">Ítélet összesen</div>
        </div>
        <div className="megszunt-stat">
          <div className="megszunt-stat-value megszunt-stat-value--red">{totalYears}</div>
          <div className="megszunt-stat-label">Kiszabott börtönév</div>
        </div>
        <div className="megszunt-stat">
          <div className="megszunt-stat-value">{jogerosCount}</div>
          <div className="megszunt-stat-label">Jogerős ítélet</div>
        </div>
      </div>

      {/* Kereső */}
      <div className="verdict-search-wrap">
        <div className="verdict-search-inner">
          <svg className="verdict-search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            className="verdict-search-input"
            type="text"
            placeholder="Keresés neve alapján... (min. 3 karakter)"
            value={search}
            onChange={e => { setSearch(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 160)}
            autoComplete="off"
            spellCheck={false}
          />
          {search && (
            <button className="verdict-search-clear" onClick={() => setSearch('')} type="button" aria-label="Törlés">✕</button>
          )}
        </div>
        {showSuggestions && suggestions.length > 0 && (
          <ul className="verdict-suggestions" role="listbox">
            {suggestions.slice(0, 8).map(name => (
              <li key={name} role="option">
                <button
                  type="button"
                  className="verdict-suggestion-item"
                  onMouseDown={() => { setSearch(name); setShowSuggestions(false); }}
                >
                  {name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Szűrők */}
      <div className="verdict-filters">
        {/* Ítélet típusa */}
        <div className="verdict-filter-group">
          <span className="verdict-filter-label">Típus</span>
          <div className="verdict-pills">
            {[
              { val: 'all',                label: 'Összes' },
              { val: 'elsőfokú',           label: 'Elsőfokú' },
              { val: 'jogerős',            label: 'Jogerős' },
              { val: 'fellebbezés alatt',  label: 'Fellebbezés alatt' },
            ].map(({ val, label }) => (
              <button
                key={val}
                type="button"
                className={`verdict-pill${verdictTypeFilter === val ? ' verdict-pill--active' : ''}`}
                onClick={() => setVerdictTypeFilter(val)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Kiszabott évek */}
        <div className="verdict-filter-group">
          <span className="verdict-filter-label">Kiszabott évek</span>
          <div className="verdict-pills">
            {[
              { val: 'all',   label: 'Összes' },
              { val: '1-5',   label: '1–5 év' },
              { val: '6-10',  label: '6–10 év' },
              { val: '11-15', label: '11–15 év' },
              { val: '15+',   label: '15+ év' },
            ].map(({ val, label }) => (
              <button
                key={val}
                type="button"
                className={`verdict-pill${yearRange === val ? ' verdict-pill--active' : ''}`}
                onClick={() => setYearRange(val)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Dropdown sor */}
        <div className="verdict-filter-dropdowns">
          {/* Bűncselekmény */}
          <div className="verdict-dropdown-wrap" ref={crimeRef}>
            <button
              type="button"
              className={`verdict-dropdown-btn${crimeFilter.length > 0 ? ' verdict-dropdown-btn--active' : ''}`}
              onClick={() => { setShowCrimeDropdown(v => !v); setShowCourtDropdown(false); }}
            >
              Bűncselekmény
              {crimeFilter.length > 0 && <span className="verdict-dropdown-badge">{crimeFilter.length}</span>}
              <span className="verdict-dropdown-arrow">{showCrimeDropdown ? '▲' : '▼'}</span>
            </button>
            {showCrimeDropdown && (
              <div className="verdict-dropdown-panel">
                {allCrimes.map(c => (
                  <label key={c} className="verdict-checkbox-item">
                    <input type="checkbox" checked={crimeFilter.includes(c)} onChange={() => setCrimeFilter(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c])} />
                    <span>{c}</span>
                  </label>
                ))}
                {crimeFilter.length > 0 && (
                  <button type="button" className="verdict-dropdown-clear" onClick={() => setCrimeFilter([])}>Szűrő törlése</button>
                )}
              </div>
            )}
          </div>

          {/* Bíróság — csak ha >1 különböző */}
          {allCourts.length > 1 && (
            <div className="verdict-dropdown-wrap" ref={courtRef}>
              <button
                type="button"
                className={`verdict-dropdown-btn${courtFilter !== 'all' ? ' verdict-dropdown-btn--active' : ''}`}
                onClick={() => { setShowCourtDropdown(v => !v); setShowCrimeDropdown(false); }}
              >
                Bíróság
                {courtFilter !== 'all' && <span className="verdict-dropdown-badge">1</span>}
                <span className="verdict-dropdown-arrow">{showCourtDropdown ? '▲' : '▼'}</span>
              </button>
              {showCourtDropdown && (
                <div className="verdict-dropdown-panel">
                  {['all', ...allCourts].map(c => (
                    <label key={c} className="verdict-checkbox-item">
                      <input type="radio" name="court-filter" checked={courtFilter === c} onChange={() => setCourtFilter(c)} />
                      <span>{c === 'all' ? 'Összes bíróság' : c}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {hasFilter && (
            <button type="button" className="verdict-clear-all" onClick={clearAll}>
              × Szűrők törlése
            </button>
          )}
        </div>

        {/* Találatok száma */}
        <div className="verdict-result-meta">
          {hasFilter
            ? `${filtered.length} találat (${rows.length} ítéletből)`
            : `${rows.length} ítélet összesen`}
        </div>
      </div>

      {/* Kártyák */}
      <div className="verdict-list" style={{ marginTop: 20 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: '#888', border: '1px dashed #e0e0e0', borderRadius: 12 }}>
            Nincs a feltételeknek megfelelő ítélet.
          </div>
        ) : (
          filtered.map(r => <VerdictCard key={r.id} r={r} />)
        )}
      </div>
    </>
  );
}
