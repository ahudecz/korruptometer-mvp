import { describe, expect, it } from 'vitest';
import { breakingCaption } from './social-caption';

describe('breakingCaption', () => {
  it('puts the hook (headline) in the FIRST line with its category emoji — 2026-09-08 brief', () => {
    const caption = breakingCaption('KIRÚGÁS', 'X: kirúgták!', 'pozíció, intézmény', '/lemondasok/1');
    const lines = caption.split('\n');
    expect(caption).not.toContain('undefined');
    expect(lines[0]).toBe('❌ X: kirúgták!');
    expect(lines[1]).toBe('');
  });

  it('inserts the flavor hook line right after the headline when given', () => {
    const caption = breakingCaption('LEMONDÁS', 'X: lemondott!', 'pozíció, intézmény', '/lemondasok/1', undefined, 'Friss távozás 👋');
    const lines = caption.split('\n');
    expect(lines[0]).toBe('👋 X: lemondott!');
    expect(lines[1]).toBe('Friss távozás 👋');
    expect(lines[2]).toBe('');
    expect(lines[3]).toBe('pozíció, intézmény');
  });

  it('uses the category-specific emoji per kicker (brief section 4)', () => {
    expect(breakingCaption('ÍTÉLET', 'X: 5 év', undefined).split('\n')[0]).toBe('⚖️ X: 5 év');
    expect(breakingCaption('VAGYONVISSZASZERZÉS', 'Ügy: 25 milliárd Ft', undefined).split('\n')[0]).toBe('💰 Ügy: 25 milliárd Ft');
    expect(breakingCaption('KVÍZ', 'Lehetnél te az NVVH legfőbb ügyésze?', undefined).split('\n')[0]).toBe('🧠 Lehetnél te az NVVH legfőbb ügyésze?');
    expect(breakingCaption('MEGSZŰNÉS', 'Mandiner: megszűnt', undefined).split('\n')[0]).toBe('📉 Mandiner: megszűnt');
  });

  it('falls back to the neutral 🚨 for an unlisted kicker', () => {
    expect(breakingCaption('ISMERETLEN', 'X', undefined).split('\n')[0]).toBe('🚨 X');
  });

  it('still includes the link, CTA and hashtag footer regardless of the hook line', () => {
    const caption = breakingCaption('KVÍZ', 'Kvíz', 'intro', '/kviz/mnb', 'Töltsd ki!', 'Kvízidő! 🎯');
    expect(caption).toContain('Részletek: kegyencjarat.hu/kviz/mnb');
    expect(caption).toContain('Töltsd ki!');
    expect(caption).toContain('#kegyencjarat #korrupció');
  });

  it('omits the detail line entirely when none is given (no empty gap)', () => {
    const caption = breakingCaption('LEMONDÁS', 'X: lemondott!', undefined, '/lemondasok/1');
    expect(caption).not.toContain('undefined');
    const lines = caption.split('\n');
    // headline, '', link, cta, hashtags — no dangling blank for a missing detail
    expect(lines).toEqual([
      '👋 X: lemondott!',
      '',
      'Részletek: kegyencjarat.hu/lemondasok/1',
      '👉 Kattints és olvasd el a legfrissebb híreket!',
      '#kegyencjarat #korrupció',
    ]);
  });
});
