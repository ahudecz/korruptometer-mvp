import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { SocialPostCard, type SocialPost } from './social-post-card';
import { pickDiverse } from './social-feed-select';

const TEASER_SIZE = 18;
const FETCH_POOL = 400; // elég nagy merítés, hogy minden aktív oldalhoz jusson legalább 1 poszt

export async function SocialFeed() {
  try {
    // 2026-09-21: ez a lekérdezés a Supabase REST API-n (supabase-js) ment, és
    // a projekt egyik napról a másikra 402-t kezdett adni rá
    // ("exceed_egress_quota"). A hiba a catch-ágon némán null-t adott vissza,
    // ezért tűnt el az EGÉSZ szekció a nyitóoldalról, és lett üres a
    // /legfontosabb-hangok — miközben az adatbázisban minden poszt megvolt.
    // Ugyanaz a Postgres, csak a közvetlen kapcsolaton át (mint az összes
    // többi oldalunk), amit az egress-korlát nem érint.
    const db = getDb();
    const pool = await db
      .select()
      .from(schema.socialPosts)
      .where(eq(schema.socialPosts.hidden, false))
      // A megjelenés ideje szerint, nem a beolvasásé szerint — l. social-feed-select.ts
      .orderBy(desc(schema.socialPosts.postedAt))
      .limit(FETCH_POOL);

    if (pool.length === 0) return null;

    // Oldalanként csak 1 (a legfrissebb) poszt, hogy a teaser változatos legyen,
    // és a sorrend időrendi maradjon — a legfrissebb elöl.
    const posts = pickDiverse(pool as SocialPost[], { perAuthor: 1, limit: TEASER_SIZE });

    return (
      <section className="section social-feed-section" id="social">
        <div className="section-head">
          <div className="section-num">10 / Oknyomozók, Bloggerek, Események, Abszolút Parlament</div>
          <h2 className="section-title">A legfontosabb hangok.</h2>
        </div>
        <p className="section-lead">
          Független oknyomozók, események, az Abszolút Parlament és közéleti aktivista újságírók válogatott posztjai —
          amelyek közvetlenül kapcsolódnak az adatbázisban szereplő ügyekhez.
        </p>
        <div className="social-feed-masonry">
          {posts.map((post) => (
            <SocialPostCard key={post.id} post={post} />
          ))}
        </div>
        <div className="elszamoltatas-more">
          <Link href="/legfontosabb-hangok" className="btn-red">Az összes hang megtekintése →</Link>
        </div>
      </section>
    );
  } catch (e) {
    console.error('[SocialFeed] hiba:', e);
    return null;
  }
}
