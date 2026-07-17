import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

import { SocialFeedClient } from '../_home/social-feed-client';

const PAGE_SIZE = 20;

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'A legfontosabb hangok',
  description: 'Független oknyomozók, aktivisták és kritikus Facebook-oldalak, amikről a nagy hírportálok nem mindig írnak. Kattints, és kövesd őket!',
};

export default async function LegfontosabbHangokPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let posts: Record<string, any>[] = [];
  if (supabaseUrl && supabaseKey) {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from('SocialPost')
      .select('*')
      .eq('hidden', false)
      .order('createdAt', { ascending: false })
      .range(0, PAGE_SIZE - 1);
    if (error) console.error('[LegfontosabbHangok] Supabase hiba:', error);
    if (data) posts = data;
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
          <SocialFeedClient initialPosts={posts} initialHasMore={posts.length === PAGE_SIZE} />
        )}

        <div className="modszertan-back">
          <Link href="/">← Főoldal</Link>
        </div>
      </section>
    </div>
  );
}
