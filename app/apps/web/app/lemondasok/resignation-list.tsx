'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const SECTOR_OPTIONS = [
  { value: 'nemzetbiztonság', label: 'Nemzetbiztonság' },
  { value: 'fegyveres és rendvédelmi szervek', label: 'Fegyveres és rendvédelmi szervek' },
  { value: 'ügyészség', label: 'Ügyészség' },
  { value: 'honvédség', label: 'Honvédség' },
  { value: 'hatóságok, hivatalok, állami cégek', label: 'Hatóságok, hivatalok, állami cégek' },
  { value: 'egészségügy', label: 'Egészségügy' },
  { value: 'média', label: 'Média' },
  { value: 'sport és civil szervezetek', label: 'Sport és civil szervezetek' },
  { value: 'kultúra', label: 'Kultúra' },
  { value: 'közigazgatás', label: 'Közigazgatás' },
  { value: 'egyéb', label: 'Egyéb' },
];

export type SerializedResignation = {
  id: string;
  resignationDateFormatted: string;
  resignationType: string;
  name: string;
  position: string;
  institution: string;
  description: string | null;
  sector: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  breakingSourceUrl: string | null;
};

function typeLabel(t: string): string {
  if (t === 'lemondás') return '↓ Lemondás';
  if (t === 'kirúgás') return '✕ Kirúgás';
  if (t === 'felmentés') return '⟲ Felmentés';
  return t;
}

function typeColor(t: string): string {
  if (t === 'lemondás') return '#4B7AFF';
  if (t === 'kirúgás') return '#E31937';
  if (t === 'felmentés') return '#FF9D00';
  return '#666';
}

const cellStyle = { padding: '12px', color: '#666' } as const;

function Row({ r }: { r: SerializedResignation }) {
  const color = typeColor(r.resignationType);
  return (
    <tr className={r.breakingSourceUrl ? 'res-row-breaking' : undefined} style={{ borderBottom: '1px solid #f0f0f0' }}>
      <td className="res-col-date" style={{ ...cellStyle, whiteSpace: 'nowrap' as const }}>
        {r.resignationDateFormatted}
      </td>
      <td style={{ ...cellStyle, whiteSpace: 'nowrap' as const }}>
        <span style={{
          display: 'inline-block',
          padding: '4px 8px',
          borderRadius: '4px',
          backgroundColor: `${color}20`,
          color,
          fontSize: '12px',
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}>
          {typeLabel(r.resignationType)}
        </span>
      </td>
      <td style={{ ...cellStyle, fontWeight: 500, color: 'var(--ink)' }}>
        {r.name}
        {r.breakingSourceUrl && (
          <a
            href={r.breakingSourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="res-breaking-inline"
          >
            <span className="res-breaking-dot" />
            BREAKING
          </a>
        )}
      </td>
      <td style={cellStyle}>{r.position}</td>
      <td className="res-col-institution" style={cellStyle}>{r.institution}</td>
      <td className="res-col-desc" style={{ ...cellStyle, maxWidth: 320, fontSize: 13 }}>{r.description ?? '—'}</td>
      <td style={cellStyle}>
        {r.sourceUrl ? (
          <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="res-source-link">
            {r.sourceName ?? 'Forrás'} →
          </a>
        ) : '—'}
      </td>
    </tr>
  );
}

const tableHead = (
  <thead>
    <tr style={{ borderBottom: '1px solid #e5e5e5' }}>
      <th className="res-col-date" style={{ textAlign: 'left', padding: '12px', fontWeight: 600 }}>Dátum</th>
      <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600 }}>Státusz</th>
      <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600 }}>Név</th>
      <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600 }}>Pozíció</th>
      <th className="res-col-institution" style={{ textAlign: 'left', padding: '12px', fontWeight: 600 }}>Intézmény</th>
      <th className="res-col-desc" style={{ textAlign: 'left', padding: '12px', fontWeight: 600 }}>Leírás</th>
      <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600 }}>Forrás</th>
    </tr>
  </thead>
);

export function ResignationList({ rows, initialSectors = [] }: { rows: SerializedResignation[]; initialSectors?: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState('');
  const [sectors, setSectors] = useState<string[]>(initialSectors);

  // Csak az URL-t szinkronizáljuk (megosztható link kedvéért) — a lista
  // maga kliens-oldalon, a már betöltött rows tömbön szűr, nincs
  // oldalújratöltés/navigáció, ezért nincs felugrás a tetejére sem.
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (sectors.length === 0) params.delete('terulet'); else params.set('terulet', sectors.join(','));
    const next = params.toString();
    const current = searchParams.toString();
    if (next !== current) {
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- csak sectors váltásra fusson
  }, [sectors]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (sectors.length > 0 && (!r.sector || !sectors.includes(r.sector))) return false;
      if (q) {
        const haystack = `${r.name} ${r.position} ${r.institution}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, sectors]);

  const hasFilter = search !== '' || sectors.length > 0;

  function toggleSector(value: string) {
    setSectors(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  }

  function clearAll() {
    setSearch('');
    setSectors([]);
  }

  return (
    <>
      <div className="verdict-search-wrap">
        <div className="verdict-search-inner">
          <svg className="verdict-search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            className="verdict-search-input"
            type="text"
            placeholder="Keresés név, pozíció vagy intézmény alapján…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          {search && (
            <button className="verdict-search-clear" onClick={() => setSearch('')} type="button" aria-label="Törlés">✕</button>
          )}
        </div>
      </div>

      <div className="verdict-filters">
        <div className="verdict-filters-blocks">
          <div className="verdict-filter-block verdict-filter-block--dropdowns">
            <span className="verdict-filter-block-label">Terület</span>
            <p className="res-sector-desc">Itt szűrhetsz azokra a területekre, amik konkrétan érdekelnek.</p>
            <div className="res-sector-grid">
              {SECTOR_OPTIONS.map(o => (
                <label key={o.value} className={`res-sector-item${sectors.includes(o.value) ? ' res-sector-item--active' : ''}`}>
                  <input
                    type="checkbox"
                    checked={sectors.includes(o.value)}
                    onChange={() => toggleSector(o.value)}
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>

            {sectors.length > 0 && (
              <button type="button" className="verdict-clear-all" style={{ marginTop: 12 }} onClick={clearAll}>
                × Szűrők törlése
              </button>
            )}
          </div>
        </div>

        <div className="verdict-filters-footer">
          <span className="verdict-result-meta">
            {hasFilter
              ? `${filtered.length} találat (${rows.length} bejegyzésből)`
              : `${rows.length} bejegyzés összesen`}
          </span>
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="res-table-wrap">
          <table style={{ width: '100%', minWidth: 700, fontSize: '14px', lineHeight: '1.6' }}>
            {tableHead}
            <tbody>
              {filtered.map(r => <Row key={r.id} r={r} />)}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state" style={{ marginTop: 32 }}>Nincs találat ebben a kategóriában.</div>
      )}
    </>
  );
}
