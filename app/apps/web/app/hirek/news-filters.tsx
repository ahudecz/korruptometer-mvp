'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTransition } from 'react';

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

  return (
    <div className="db-controls" role="region" aria-label="Hírszűrők">
      <div className="db-control search">
        <label htmlFor="news-outlet">Forrás</label>
        <select
          id="news-outlet"
          value={currentOutlet}
          onChange={(e) => update({ outlet: e.target.value || undefined })}
          style={{ color: '#fff' }}
        >
          <option value="">Minden forrás</option>
          {outlets.map((o) => (
            <option key={o.slug} value={o.slug}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
      <div className="db-control">
        <label htmlFor="news-tag">Címke</label>
        <select
          id="news-tag"
          value={currentTag}
          onChange={(e) => update({ tag: e.target.value || undefined })}
        >
          <option value="">Mind</option>
          {tags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div className="db-control">
        <label htmlFor="news-featured">Kiemeltek</label>
        <select
          id="news-featured"
          value={currentFeatured ? '1' : ''}
          onChange={(e) => update({ featured: e.target.value || undefined })}
        >
          <option value="">Mind</option>
          <option value="1">Csak kiemeltek</option>
        </select>
      </div>
      <div className="db-control" style={{ alignSelf: 'center' }}>
        <label>&nbsp;</label>
        <span style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.12em' }}>
          {isPending ? 'Frissítés…' : `${tags.length} címke`}
        </span>
      </div>
      <div className="db-control" style={{ alignSelf: 'center' }}>
        <label>&nbsp;</label>
        <span />
      </div>
      <button
        type="button"
        className="db-control btn"
        onClick={() => {
          const params = new URLSearchParams();
          startTransition(() => router.replace(pathname + (params.toString() ? `?${params}` : '')));
        }}
      >
        <span>Szűrők törlése</span>
      </button>
    </div>
  );
}
