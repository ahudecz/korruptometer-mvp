'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTransition } from 'react';

const HU_GIVEN_NAMES = new Set([
  'gyula', 'máté', 'andrás', 'gábor', 'józsef', 'zsolt', 'bálint',
  'viktor', 'péter', 'tamás', 'sándor', 'ákos', 'antal', 'bence',
  'gergely', 'attila', 'imre', 'balázs', 'dániel', 'márton', 'ádám',
  'tibor', 'istván', 'zoltán', 'norbert', 'csaba', 'mihály', 'lászló',
  'lajos', 'kornél', 'róbert', 'richárd', 'péterné', 'istvánné',
  'zsuzsa', 'zsuzsanna', 'katalin', 'erzsébet', 'andrea', 'ágnes',
  'anna', 'mária', 'judit', 'krisztina', 'erika', 'nikolett',
]);

function formatTag(tag: string): string {
  const words = tag.trim().split(/\s+/);
  const cased = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  // Ha az első szó keresztnév (nyugati sorrend), fordíts magyar sorrendbe
  if (cased.length === 2 && HU_GIVEN_NAMES.has(words[0]!.toLowerCase())) {
    return `${cased[1]} ${cased[0]}`;
  }
  return cased.join(' ');
}

const SELECT_STYLE: React.CSSProperties = {
  appearance: 'none',
  WebkitAppearance: 'none',
  background: '#fff url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'8\' viewBox=\'0 0 12 8\'%3E%3Cpath d=\'M1 1l5 5 5-5\' stroke=\'%23333\' strokeWidth=\'1.5\' fill=\'none\' strokeLinecap=\'round\'/%3E%3C/svg%3E") no-repeat right 10px center',
  border: '1px solid #d0d0d0',
  borderRadius: 6,
  color: '#111',
  cursor: 'pointer',
  fontSize: 13,
  fontFamily: 'inherit',
  padding: '8px 32px 8px 12px',
  minWidth: 160,
  outline: 'none',
  transition: 'border-color 0.15s',
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#666',
  marginBottom: 4,
  display: 'block',
};

const FIELD_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
};

export function NewsFilters({
  tags,
  outlets,
}: {
  tags: string[];
  outlets: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentTag = sp.get('tag') ?? '';
  const currentOutlet = sp.get('outlet') ?? '';
  const currentFeatured = sp.get('featured') === '1';

  function update(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) {
      if (!v) params.delete(k);
      else params.set(k, v);
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  function clearAll() {
    startTransition(() => router.replace(pathname));
  }

  const hasFilter = !!(currentTag || currentOutlet || currentFeatured);

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        alignItems: 'flex-end',
        padding: '16px 0',
        borderBottom: '1px solid #e8e8e8',
        marginBottom: 8,
      }}
      role="region"
      aria-label="Hírszűrők"
    >
      <div style={FIELD_STYLE}>
        <label htmlFor="news-outlet" style={LABEL_STYLE}>Forrás</label>
        <select
          id="news-outlet"
          value={currentOutlet}
          onChange={(e) => update({ outlet: e.target.value || undefined })}
          style={SELECT_STYLE}
        >
          <option value="">Minden forrás</option>
          {outlets.map((o) => (
            <option key={o.slug} value={o.slug}>
              {o.name}
            </option>
          ))}
        </select>
      </div>

      <div style={FIELD_STYLE}>
        <label htmlFor="news-tag" style={LABEL_STYLE}>Témakör</label>
        <select
          id="news-tag"
          value={currentTag}
          onChange={(e) => update({ tag: e.target.value || undefined })}
          style={SELECT_STYLE}
        >
          <option value="">Minden téma</option>
          {tags.map((t) => (
            <option key={t} value={t}>
              {formatTag(t)}
            </option>
          ))}
        </select>
      </div>

      <div style={FIELD_STYLE}>
        <label htmlFor="news-featured" style={LABEL_STYLE}>Szerkesztői</label>
        <select
          id="news-featured"
          value={currentFeatured ? '1' : ''}
          onChange={(e) => update({ featured: e.target.value || undefined })}
          style={SELECT_STYLE}
        >
          <option value="">Mind</option>
          <option value="1">Csak kiemelt</option>
        </select>
      </div>

      {hasFilter && (
        <div style={FIELD_STYLE}>
          <label style={LABEL_STYLE}>&nbsp;</label>
          <button
            type="button"
            onClick={clearAll}
            style={{
              background: 'none',
              border: '1px solid #d0d0d0',
              borderRadius: 6,
              color: '#555',
              cursor: 'pointer',
              fontSize: 13,
              fontFamily: 'inherit',
              padding: '8px 14px',
              transition: 'border-color 0.15s, color 0.15s',
            }}
          >
            ✕ Szűrők törlése
          </button>
        </div>
      )}

      {isPending && (
        <div style={{ ...FIELD_STYLE, justifyContent: 'flex-end' }}>
          <label style={LABEL_STYLE}>&nbsp;</label>
          <span style={{ fontSize: 12, color: '#999', padding: '8px 0' }}>Frissítés…</span>
        </div>
      )}
    </div>
  );
}
