import { atlatszo } from './atlatszo';
import { hvg } from './hvg';
import { magyarHang } from './magyar-hang';
import { negyNegyNegy } from './444';
import { telex } from './telex';
import type { OutletAdapter, OutletSlug } from './types';

export const adapters: Record<OutletSlug, OutletAdapter> = {
  telex,
  '444': negyNegyNegy,
  hvg,
  'magyar-hang': magyarHang,
  atlatszo,
};

export function getAdapter(slug: string): OutletAdapter | null {
  return (adapters as Record<string, OutletAdapter | undefined>)[slug] ?? null;
}

const hostToSlug: ReadonlyMap<string, OutletSlug> = buildHostIndex(adapters);

function buildHostIndex(
  source: Record<OutletSlug, OutletAdapter>,
): Map<string, OutletSlug> {
  const out = new Map<string, OutletSlug>();
  for (const [slug, adapter] of Object.entries(source) as [
    OutletSlug,
    OutletAdapter,
  ][]) {
    try {
      const host = new URL(adapter.homepage).hostname.toLowerCase();
      out.set(host, slug);
      if (host.startsWith('www.')) out.set(host.slice(4), slug);
      else out.set(`www.${host}`, slug);
    } catch {
      // Adapter homepage isn't a parseable URL — ignore and let the slug
      // route resolution miss this outlet; tests will catch the typo.
    }
  }
  return out;
}

export function routeOutletByUrl(url: string): OutletSlug | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  return hostToSlug.get(host) ?? null;
}
