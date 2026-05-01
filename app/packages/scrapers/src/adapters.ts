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
