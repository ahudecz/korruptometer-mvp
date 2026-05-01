'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTransition } from 'react';

/**
 * T153 — `/hirek` filter UI. URL search-params are the only filter source so
 * the filtered URL is bit-for-bit reproducible across browser contexts (the
 * same SC-007 contract as `/adatbazis`).
 */

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
    <div
      role="region"
      aria-label="Hírszűrők"
      style={{
        display: 'flex',
        gap: 12,
        marginTop: 16,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}
    >
      <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
        <span>Forrás</span>
        <select
          value={currentOutlet}
          onChange={(e) => update({ outlet: e.target.value || undefined })}
        >
          <option value="">Mind</option>
          {outlets.map((o) => (
            <option key={o.slug} value={o.slug}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
        <span>Címke</span>
        <select
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
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
        <input
          type="checkbox"
          checked={currentFeatured}
          onChange={(e) => update({ featured: e.target.checked ? '1' : undefined })}
        />
        Csak kiemeltek
      </label>
      {isPending && <span style={{ fontSize: 12, color: 'var(--muted)' }}>frissítés…</span>}
    </div>
  );
}
