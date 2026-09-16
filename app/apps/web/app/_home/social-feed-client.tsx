'use client';

import { useState } from 'react';

import { SocialPostCard, type SocialPost } from './social-post-card';

const PAGE_SIZE = 20;

/**
 * A teljes, már sorba rakott feedet kapja a szervertől, és adagolva mutatja.
 *
 * Korábban a „Több poszt" gomb maga kérdezte le a következő 20 sort
 * Supabase-ből, `createdAt` szerint. Ez két dolgot rontott el: a lapok
 * sorrendje a beolvasás idejét tükrözte, és a szerzőnkénti keret sem tartható
 * lapozva (a 2. oldal nem tudja, ki hányszor szerepelt az elsőn). A rendezést
 * és a válogatást ezért a szerver végzi (l. social-feed-select.ts), itt már
 * csak szeletelünk — így a gomb hálózati hívás nélkül, azonnal működik.
 */
export function SocialFeedClient({ posts }: { posts: SocialPost[] }) {
  const [shown, setShown] = useState(PAGE_SIZE);
  const visible = posts.slice(0, shown);
  const hasMore = shown < posts.length;

  return (
    <>
      <div className="social-feed-masonry">
        {visible.map((post) => (
          <SocialPostCard key={post.id} post={post} />
        ))}
      </div>
      {hasMore && (
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <button className="social-load-more" onClick={() => setShown((n) => n + PAGE_SIZE)}>
            Több poszt
          </button>
        </div>
      )}
    </>
  );
}
