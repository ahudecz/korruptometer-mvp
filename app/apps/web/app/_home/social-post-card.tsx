/* eslint-disable react/no-unescaped-entities -- Hungarian typographic quotes („ ") in display text */

import { isFacebookVideoUrl } from '@korr/shared/facebook-reel';

import { FbReelEmbed } from './fb-reel-embed';

const HU_MONTHS = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];

function fmtDate(d: Date): string {
  return `${d.getFullYear()}. ${HU_MONTHS[d.getMonth()]} ${d.getDate()}.`;
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

export type SocialPost = Record<string, any>;

export function SocialPostCard({ post }: { post: SocialPost }) {
  // 2026-09-14 — Facebook videó/reel: poszterkép (a mi Storage-unkból) +
  // lejátszás-jelölés.
  //
  // 2026-09-15 — a reeles posztok MOST MÁR helyben lejátszhatók: a korlát
  // sosem a Facebook volt, hanem a saját CSP-nk `frame-src`-ja, ami azóta
  // megkapta a www.facebook.com origint (l. next.config.js és
  // packages/shared/src/facebook-reel.ts). A lejátszó csak kattintásra
  // töltődik be. A többi (nem videós, vagy nem felismert alakú) poszt
  // változatlanul kifelé linkelő kártya marad.
  const videoHref = post.videoUrl ? safeUrl(post.videoUrl) : undefined;
  const href = safeUrl(post.postUrl) ?? videoHref;
  const imageHref = post.imageUrl ? safeUrl(post.imageUrl) : undefined;
  const reelHref = [videoHref, href].find((u) => u && isFacebookVideoUrl(u));
  // Beágyazott lejátszónál a kártya NEM lehet egyetlen nagy <a>: egy linken
  // belül nem állhat gomb/iframe (érvénytelen HTML, és a play gombra való
  // kattintás is a linket vinné). Ilyenkor a kártya sima <div>, a kifelé
  // mutató link pedig a láblécben él.
  const Wrapper = reelHref ? 'div' : href ? 'a' : 'div';
  return (
    <Wrapper
      {...(href && !reelHref ? { href, target: '_blank', rel: 'noopener noreferrer' } : {})}
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
      {reelHref && (
        <div className="social-post-media">
          <FbReelEmbed url={reelHref} posterUrl={imageHref} authorName={post.authorName} />
        </div>
      )}
      {!reelHref && imageHref && (
        <div className="social-post-media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageHref} alt="" />
          {videoHref && (
            <span className="social-post-play" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" focusable="false">
                <path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor" />
              </svg>
            </span>
          )}
        </div>
      )}
      {videoHref && !imageHref && !reelHref && (
        <div className="social-post-video-chip">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
            <path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor" />
          </svg>
          Videós poszt
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
        {href && reelHref ? (
          // Beágyazott lejátszónál a kártya nem link, ezért itt kell egy
          // valódi <a>, hogy a posztot továbbra is meg lehessen nyitni.
          <a className="social-post-link" href={href} target="_blank" rel="noopener noreferrer">
            Megnyitás a Facebookon →
          </a>
        ) : href ? (
          <span className="social-post-link">
            {videoHref ? 'Videó megtekintése →' : 'Poszt megtekintése →'}
          </span>
        ) : null}
      </div>
    </Wrapper>
  );
}
