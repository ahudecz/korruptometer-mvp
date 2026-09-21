import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { SocialFeedClient } from '../_home/social-feed-client';
import { orderFeed } from '../_home/social-feed-select';

// Az egész feedet egyben kérjük le, és itt, a szerveren rakjuk sorba: a
// szerzőnkénti keretet nem lehet SQL-lapozással megtartani (a 2. oldal nem
// tudná, ki hányszor szerepelt az elsőn). A tábla pár száz soros, ez olcsó.
const FETCH_POOL = 1000;
const PER_AUTHOR = 2;

export const dynamic = 'force-dynamic';

export const metadata = {
  title: { absolute: 'A legfontosabb hangok' },
  description: 'Független oknyomozók és kritikus közösségi oldalak, akiknek szerepe volt a NER lebontásában. Összegyűjtve, egy helyen.',
};

export default async function LegfontosabbHangokPage() {
  // 2026-09-21: a Supabase REST API helyett közvetlen Postgres-kapcsolat —
  // a REST 402-t ad ("exceed_egress_quota"), l. social-feed.tsx.
  let posts: Record<string, any>[] = [];
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.socialPosts)
      .where(eq(schema.socialPosts.hidden, false))
      // A megjelenés ideje szerint, nem a beolvasásé szerint — l. social-feed-select.ts
      .orderBy(desc(schema.socialPosts.postedAt))
      .limit(FETCH_POOL);
    posts = orderFeed(rows, PER_AUTHOR);
  } catch (e) {
    console.error('[LegfontosabbHangok] DB hiba:', e);
  }

  return (
    <div className="news-section-wrap">
      <section className="section" id="legfontosabb-hangok">
        <div className="section-head">
          <div className="section-num">/ Oknyomozók, Bloggerek, Események, Abszolút Parlament</div>
          <h2 className="section-title">A legfontosabb hangok.</h2>
        </div>

        <p className="modszertan-lead">
          Akikre érdemes figyelni a hivatalos hírfolyamon túl.
        </p>

        <p className="section-lead">
          Itt gyűjtöttünk össze néhány — messze nem az összes — Facebook-oldalt független oknyomozóktól, aktivistáktól
          és kritikus hangoktól, akik a rendszerváltásért dolgoznak, vagy azt már végre is hajtják. A cél, hogy
          folyamatosan képben maradhass, és hozzád is eljussanak azok a hírek, amiket a nagy hírportálok nem írnak meg.
          A lista folyamatosan bővül, és nem törekszik teljességre.
        </p>

        {posts.length === 0 ? (
          <p>Jelenleg nincs megjeleníthető poszt.</p>
        ) : (
          <SocialFeedClient posts={posts} />
        )}

        <div className="modszertan-back">
          <Link href="/">← Főoldal</Link>
        </div>
      </section>
    </div>
  );
}
