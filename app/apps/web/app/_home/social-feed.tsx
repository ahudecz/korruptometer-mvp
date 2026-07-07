import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { SocialPostCard, type SocialPost } from './social-post-card';

const TEASER_SIZE = 18;
const FETCH_POOL = 200; // elég nagy merítés, hogy minden aktív oldalhoz jusson legalább 1 poszt

export async function SocialFeed() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) return null;

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: pool, error } = await supabase
      .from('SocialPost')
      .select('*')
      .eq('hidden', false)
      .order('createdAt', { ascending: false })
      .range(0, FETCH_POOL - 1);

    if (error) {
      console.error('[SocialFeed] Supabase hiba:', error);
      return null;
    }
    if (!pool || pool.length === 0) return null;

    // Oldalanként csak 1 (a legfrissebb) poszt, hogy a teaser változatosnak tűnjön.
    const seenAuthors = new Set<string>();
    const posts: SocialPost[] = [];
    for (const post of pool) {
      const authorKey = post.authorHandle ?? post.authorName;
      if (seenAuthors.has(authorKey)) continue;
      seenAuthors.add(authorKey);
      posts.push(post);
      if (posts.length >= TEASER_SIZE) break;
    }

    return (
      <section className="section social-feed-section" id="social">
        <div className="section-head">
          <div className="section-num">/ Oknyomozók, Bloggerek, Események, Abszolút Parlament</div>
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
