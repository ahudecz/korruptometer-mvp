import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ getDb: () => { throw new Error('no db in unit test'); }, schema: {} }));

import { previewToken, verifyPreviewToken } from '@/lib/dicsosegfal-publish';

describe('Dicsőségfal előnézeti kulcs', () => {
  const secret = 'teszt-titok';

  it('a helyes kulcsot elfogadja', () => {
    const k = previewToken('puzser-robert', secret)!;
    expect(k).toHaveLength(32);
    expect(verifyPreviewToken('puzser-robert', k, secret)).toBe(true);
  });

  it('másik profil kulcsával nem nyit', () => {
    const k = previewToken('hadhazy-akos', secret)!;
    expect(verifyPreviewToken('puzser-robert', k, secret)).toBe(false);
  });

  it('hiányzó kulcs, rossz hossz vagy hiányzó titok: elutasít', () => {
    expect(verifyPreviewToken('puzser-robert', undefined, secret)).toBe(false);
    expect(verifyPreviewToken('puzser-robert', 'abc', secret)).toBe(false);
    expect(previewToken('puzser-robert', '')).toBeNull();
    expect(verifyPreviewToken('puzser-robert', 'x'.repeat(32), '')).toBe(false);
  });
});
