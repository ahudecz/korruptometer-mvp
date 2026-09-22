'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Poszt-kép — a TELJES médiadobozzal együtt eltűnik, ha a kép nem töltődik be.
 *
 * Miért kell: a poszt-képeket a saját Supabase Storage-unkból szolgáljuk ki,
 * és az 2026-09-17 óta 402-t ad („exceed_egress_quota"), JSON hibatörzzsel. A
 * böngésző ezt nem tudja képként értelmezni (Chrome: ERR_BLOCKED_BY_ORB),
 * ezért a helyén üres, szürke doboz marad — a nyitóoldalon egyszerre tizenöt
 * is. Egy kész oldal így néz ki félkésznek, „még tölt"-nek.
 *
 * Nem a hibát fedi el: a 402 okát (számlázás) csak a projekt tulajdonosa tudja
 * rendezni, a kártya viszont kép nélkül is teljes értékű — szerző, szöveg,
 * dátum és kifelé mutató link mind megvan. Amint a Storage újra kiszolgál, a
 * képek maguktól visszajönnek, kódváltoztatás nélkül.
 *
 * Szándékosan nem próbálkozik újra és nem tesz tartalék képet a helyére: a 402
 * nem tranziens hiba, az újrapróbálkozás csak újabb kérés lenne ugyanarra a
 * kimerített kvótára. A `<div>` maga is itt van (nem a hívóban), mert egy kép
 * nélküli médiadoboz pont ugyanaz a szürke folt lenne.
 */
export function SocialPostImage({ src, showPlay }: { src: string; showPlay?: boolean }) {
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Az `onError` ÖNMAGÁBAN nem elég, és ez itt a lényeg: a kép a
  // szerver-oldali HTML-ben érkezik, a böngésző tehát már a hidratálás ELŐTT
  // elkezdi tölteni. Mire a React felteszi a hibakezelőt, a hibaesemény rég
  // lezajlott, és soha többé nem sül el — pont a 402-es képeknél, amelyek
  // azonnal elhasalnak. Ezért mountoláskor egyszer kézzel is megnézzük:
  // betöltött, de nulla szélességű kép = elbukott.
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) return null;
  return (
    <div className="social-post-media">
      {/* eslint-disable-next-line @next/next/no-img-element -- külső poszt-kép, nem a Next képoptimalizálón át */}
      <img ref={imgRef} src={src} alt="" onError={() => setFailed(true)} />
      {showPlay && (
        <span className="social-post-play" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" focusable="false">
            <path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor" />
          </svg>
        </span>
      )}
    </div>
  );
}
