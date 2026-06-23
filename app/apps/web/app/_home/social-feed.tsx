import { createClient } from '@supabase/supabase-js';
import { SocialFeedClient } from './social-feed-client';

const PAGE_SIZE = 20;

export async function SocialFeed() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) return null;

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: posts, error } = await supabase
      .from('SocialPost')
      .select('*')
      .order('createdAt', { ascending: false })
      .range(0, PAGE_SIZE - 1);

    if (error) {
      console.error('[SocialFeed] Supabase hiba:', error);
      return null;
    }
    if (!posts || posts.length === 0) return null;

    return (
      <section className="section social-feed-section" id="social">
        <div className="section-head">
          <div className="section-num">/ Oknyomozók, Események, Abszolút Parlament</div>
          <h2 className="section-title">A legfontosabb hangok.</h2>
        </div>
        <p className="rogues-deck" style={{ marginBottom: 32 }}>
          Független oknyomozók, események, az Abszolút Parlament és közéleti aktivista újságírók válogatott posztjai —
          amelyek közvetlenül kapcsolódnak az adatbázisban szereplő ügyekhez.
        </p>
        <SocialFeedClient initialPosts={posts} initialHasMore={posts.length === PAGE_SIZE} />
      </section>
    );
  } catch (e) {
    console.error('[SocialFeed] hiba:', e);
    return null;
  }
}
