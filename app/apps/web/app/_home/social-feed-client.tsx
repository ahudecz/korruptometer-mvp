'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

import { SocialPostCard, type SocialPost } from './social-post-card';

const PAGE_SIZE = 20;

export function SocialFeedClient({ initialPosts, initialHasMore }: { initialPosts: SocialPost[]; initialHasMore: boolean }) {
  const [posts, setPosts] = useState<SocialPost[]>(initialPosts);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    setLoading(true);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const from = posts.length;
    const to = from + PAGE_SIZE - 1;
    const { data } = await supabase
      .from('SocialPost')
      .select('*')
      .eq('hidden', false)
      .order('createdAt', { ascending: false })
      .range(from, to);

    if (data) {
      setPosts((prev) => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoading(false);
  }

  return (
    <>
      <div className="social-feed-masonry">
        {posts.map((post) => (
          <SocialPostCard key={post.id} post={post} />
        ))}
      </div>
      {hasMore && (
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <button className="social-load-more" onClick={loadMore} disabled={loading}>
            {loading ? 'Betöltés...' : 'Több poszt'}
          </button>
        </div>
      )}
    </>
  );
}
