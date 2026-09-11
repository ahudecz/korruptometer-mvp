import { describe, expect, it } from 'vitest';

import { breakingCaption, resignationLinkPath, safeLinkPath, summaryCaption } from './social-caption';


// ═══ user report, 2026-09-11: „az összes kbaszott telegramra küldött fb poszt
// linkje 404". Mérés: a prod SocialPostOutbox minden `resignation` sora
// /lemondasok/<UUID>-ra mutatott, ami garantáltan 404 — a végoldal csak a 8
// WATCH_LIST-es slugot ismeri. A többi trigger linkje (adatbazis/ugyek/kviz/
// szavazas/birosagi-iteletek/megszunt) 200-at adott. ═══

describe('safeLinkPath', () => {
  it('leszedi a nyers UUID-szegmenst — inkább listaoldal, mint 404', () => {
    expect(safeLinkPath('/lemondasok/49e034c8-c0be-4629-b642-9ab710085538')).toBe('/lemondasok');
  });

  it('a slugos utakat érintetlenül hagyja', () => {
    expect(safeLinkPath('/lemondasok/sulyok-tamas')).toBe('/lemondasok/sulyok-tamas');
    expect(safeLinkPath('/adatbazis/nemeth-szilard-bortemplom')).toBe('/adatbazis/nemeth-szilard-bortemplom');
    expect(safeLinkPath('/birosagi-iteletek')).toBe('/birosagi-iteletek');
  });

  it('hiányzó path esetén üres sztring', () => {
    expect(safeLinkPath(undefined)).toBe('');
  });
});

describe('a caption sose tartalmazhat nyers UUID-t', () => {
  it('breakingCaption', () => {
    const c = breakingCaption('TÁVOZÁS', 'X: lemondott!', 'pozíció', '/lemondasok/49e034c8-c0be-4629-b642-9ab710085538');
    expect(c).toContain('kegyencjarat.hu/lemondasok');
    expect(c).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i);
  });

  it('summaryCaption', () => {
    const c = summaryCaption(['egy sor'], '/adatbazis/49e034c8-c0be-4629-b642-9ab710085538');
    expect(c).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i);
  });
});

describe('resignationLinkPath', () => {
  it('watchlistes emberre az ő végoldalára mutat', () => {
    expect(resignationLinkPath('Sulyok Tamás')).toBe('/lemondasok/sulyok-tamas');
  });

  it('ékezet/kisbetű eltérés nem akadály', () => {
    expect(resignationLinkPath('polt péter')).toBe('/lemondasok/polt-peter');
  });

  it('nem watchlistes emberre a listaoldalra — sose UUID-ra', () => {
    expect(resignationLinkPath('Egry Attila')).toBe('/lemondasok');
    expect(resignationLinkPath('Mike Ferenc')).toBe('/lemondasok');
  });
});
