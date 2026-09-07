import { describe, expect, it } from 'vitest';
import { breakingCaption } from './social-caption';

describe('breakingCaption', () => {
  it('omits the hook line entirely when none is given (unchanged behavior)', () => {
    const caption = breakingCaption('LEMONDÁS', 'X: lemondott!', 'pozíció, intézmény', '/lemondasok/1');
    expect(caption).not.toContain('undefined');
    expect(caption.split('\n')[0]).toBe('🚨 LEMONDÁS');
    expect(caption.split('\n')[1]).toBe('');
  });

  it('inserts the hook line right after the kicker when given', () => {
    const caption = breakingCaption('LEMONDÁS', 'X: lemondott!', 'pozíció, intézmény', '/lemondasok/1', undefined, 'Friss távozás 👋');
    const lines = caption.split('\n');
    expect(lines[0]).toBe('🚨 LEMONDÁS');
    expect(lines[1]).toBe('Friss távozás 👋');
    expect(lines[2]).toBe('');
    expect(lines[3]).toBe('X: lemondott!');
  });

  it('still includes the link, CTA and hashtag footer regardless of the hook line', () => {
    const caption = breakingCaption('KVÍZ', 'Kvíz', 'intro', '/kviz/mnb', 'Töltsd ki!', 'Kvízidő! 🎯');
    expect(caption).toContain('Részletek: kegyencjarat.hu/kviz/mnb');
    expect(caption).toContain('Töltsd ki!');
    expect(caption).toContain('#kegyencjarat #korrupció');
  });
});
