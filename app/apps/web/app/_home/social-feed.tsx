import { createClient } from '@supabase/supabase-js';

const HU_MONTHS = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];

function fmtDate(d: Date): string {
  return `${d.getFullYear()}. ${HU_MONTHS[d.getMonth()]} ${d.getDate()}.`;
}

const AVATAR_COLORS = ['#1877f2', '#e31937', '#2d8a4e', '#7b3fa0', '#d97706', '#0891b2', '#be123c', '#15803d'];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
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

export async function SocialFeed() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) return null;

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: posts, error } = await supabase
      .from('SocialPost')
      .select('*')
      .order('postedAt', { ascending: false, nullsFirst: false })
      .limit(12);

    if (error) {
      console.error('[SocialFeed] Supabase hiba:', error);
      return null;
    }
    if (!posts || posts.length === 0) return null;
    console.log('[SocialFeed] posztok:', JSON.stringify(posts.map(p => ({ id: p.id, author: p.authorName, imageUrl: p.imageUrl, videoId: p.videoId }))));


    return (
      <section className="section social-feed-section" id="social">
        <div className="section-head">
          <div className="section-num">/ Oknyomozók, események, Abszolút Parlament</div>
          <h2 className="section-title">A legfontosabb hangok.</h2>
        </div>
        <p className="rogues-deck" style={{ marginBottom: 32 }}>
          Független oknyomozók, események, az Abszolút Parlament és közéleti aktivista újságírók válogatott posztjai —
          amelyek közvetlenül kapcsolódnak az adatbázisban szereplő ügyekhez.
        </p>
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
      </section>
    );
  } catch (e) {
    console.error('[SocialFeed] hiba:', e);
    return null;
  }
}
