'use client';
/* eslint-disable react/no-unescaped-entities -- Hungarian typographic quotes („ ") in display text */

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const PAGE_SIZE = 20;

const HU_MONTHS = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];

function fmtDate(d: Date): string {
  return `${d.getFullYear()}. ${HU_MONTHS[d.getMonth()]} ${d.getDate()}.`;
}

function platformIcon(platform: string): string {
  if (platform === 'twitter' || platform === 'x') return '𝕏';
  return platform[0]?.toUpperCase() ?? '?';
}

const AVATAR_COLORS = ['#1877f2', '#e31937', '#2d8a4e', '#7b3fa0', '#d97706', '#0891b2', '#be123c', '#15803d'];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? '#1877f2';
}

function authorInitial(name: string): string {
  return name.trim()[0]?.toUpperCase() ?? '?';
}

function safeUrl(url: string): string | undefined {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

type Post = Record<string, any>;

export function SocialFeedClient({ initialPosts, initialHasMore }: { initialPosts: Post[]; initialHasMore: boolean }) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
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
        {posts.map((post) => {
          const href = safeUrl(post.postUrl);
          const Wrapper = href ? 'a' : 'div';
          return (
            <Wrapper
              key={post.id}
              {...(href ? { href, target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="social-post-card"
            >
              <div className="social-post-header">
                <div className="social-post-author-wrap">
                  <div className="social-post-platform-badge" style={{ background: avatarColor(post.authorName) }}>
                    {authorInitial(post.authorName)}
                  </div>
                  <div>
                    <div className="social-post-author">{post.authorName}</div>
                    {post.authorHandle && (
                      <div className="social-post-handle">{post.authorHandle}</div>
                    )}
                  </div>
                </div>
                {post.postedAt && (
                  <div className="social-post-date">{fmtDate(new Date(post.postedAt))}</div>
                )}
              </div>
              <p className="social-post-content">{post.content}</p>
              {post.imageUrl && safeUrl(post.imageUrl) && (
                <div className="social-post-media">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={safeUrl(post.imageUrl)} alt="" />
                </div>
              )}
              {post.videoId && (
                <div className="social-post-media">
                  <div className="social-post-video-wrap">
                    <iframe
                      src={`https://www.youtube.com/embed/${post.videoId}`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              )}
              <div className="social-post-footer">
                {href && <span className="social-post-link">Poszt megtekintése →</span>}
              </div>
            </Wrapper>
          );
        })}
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
