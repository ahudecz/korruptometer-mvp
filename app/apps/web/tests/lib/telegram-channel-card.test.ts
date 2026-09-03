import { afterEach, describe, expect, it } from 'vitest';
import React from 'react';

// A vitest-beállítás a klasszikus JSX-futásidőt használja ezekre a fájlokra,
// az pedig egy globális `React`-et vár. A projektben ez az első komponens-
// teszt, ezért itt tesszük elérhetővé — a közös vitest-konfiguráció
// átállítása minden meglévő tesztre hatna, és az nem ennek a változásnak a
// dolga.
(globalThis as unknown as { React: typeof React }).React = React;

import { TelegramChannelCard } from '../../app/_home/telegram-channel-card';

afterEach(() => {
  delete process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_URL;
});

/**
 * 012-reader-subscriptions, User Story 2 — a nyilvános csatorna olvasói
 * belépője. Ugyanaz a kikapcsoló-elv, mint a küldésnél (FR-022): amíg a
 * csatorna nincs beállítva, az olvasó nem lát rá mutató linket.
 */
describe('TelegramChannelCard', () => {
  it('nem jelenik meg, amíg a NEXT_PUBLIC_TELEGRAM_CHANNEL_URL nincs beállítva', () => {
    expect(TelegramChannelCard()).toBeNull();
  });

  it('a beállított címre mutat, új lapon, referrer nélkül', () => {
    process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_URL = 'https://t.me/pelda';
    const tree = JSON.stringify(TelegramChannelCard());
    expect(tree).toContain('https://t.me/pelda');
    expect(tree).toContain('noopener noreferrer');
    expect(tree).toContain('_blank');
  });

  it('nem kér telefonszámot — A4: telefonszámot soha nem tárolunk', () => {
    process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_URL = 'https://t.me/pelda';
    const tree = JSON.stringify(TelegramChannelCard());
    expect(tree).not.toContain('input');
    expect(tree).toContain('semmit nem tárolunk rólad');
  });
});
