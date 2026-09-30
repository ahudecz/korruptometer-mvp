import { facebookPostEmbedUrl } from '@korr/shared/facebook-reel';

/**
 * Facebook SZÖVEGES poszt beágyazása (plugins/post.php).
 *
 * User kérés, 2026-09-30: a poszt kattintás nélkül, AUTOMATIKUSAN töltődjön
 * be — ebben eltér az FbReelEmbed kétkattintásos mintájától. A `loading=
 * "lazy"` miatt az iframe (és vele a Facebook-kérés) csak akkor indul, amikor
 * a poszt a képernyő közelébe ér, nem az oldal betöltésekor.
 *
 * A CSP `frame-src`-ja a www.facebook.com origint már engedi (next.config.js);
 * az URL-validálás a `facebookPostEmbedUrl()`-ben van (@korr/shared).
 */
export function FbPostEmbed({ url, authorName }: { url: string; authorName: string }) {
  const embedUrl = facebookPostEmbedUrl(url);
  if (!embedUrl) return null;

  return (
    <div className="fb-post">
      <iframe
        src={embedUrl}
        title={`${authorName} Facebook-bejegyzése`}
        className="fb-post-frame"
        loading="lazy"
        frameBorder="0"
        allow="clipboard-write; encrypted-media; picture-in-picture; web-share"
      />
      <a className="fb-post-link" href={url} target="_blank" rel="noopener noreferrer">
        Megnyitás a Facebookon →
      </a>
    </div>
  );
}
