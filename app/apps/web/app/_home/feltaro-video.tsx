import { PodcastVideoBox } from './podcast-video-box';

/**
 * Egységes videókártya a Dicsőségfalhoz.
 *
 * 2026-09-16, user kifogás: a korábbi megoldás a `ugy-block-video` volt, ahol
 * a leírás a lejátszó FÖLÉ került, keret nélkül. Az oldalnak már van saját,
 * bevált videó-designja — a `podcast-card`: előbb a lejátszó (kattintásra
 * betöltődő thumbnail + piros play-gomb), alatta piros csatorna-címke és cím.
 * Ez a komponens azt viszi tovább, hogy a falon és a végoldalakon ugyanaz a
 * formanyelv legyen, mint a /podcastok oldalon.
 *
 * A kattintásra-iframe viselkedés nem csak esztétika: így egy kilenc videós
 * oldal sem húz be kilenc YouTube-lejátszót induláskor.
 */
export function FeltaroVideo({
  videoId,
  title,
  label,
  summary,
  variant,
  playlistId,
  note,
}: {
  videoId: string;
  title: string;
  label?: string;
  summary?: string;
  /** Lábjegyzet egy külső hivatkozással — l. FeltaroVideoRef.note. */
  note?: { text: string; linkText: string; href: string };
  /** 'wide': a szövegoszlop teljes szélességében, egyedülálló videóhoz. */
  variant?: 'wide';
  /** Egy egész sorozat egyetlen kereten belül (user kérés, 2026-09-17: a
   *  NER100 egy 65 részes lejátszási lista, ne kelljen érte átmenni). */
  playlistId?: string;
}) {
  return (
    <div className={`podcast-card feltaro-video${variant === 'wide' ? ' feltaro-video--wide' : ''}`}>
      <PodcastVideoBox
        videoId={videoId}
        title={title}
        wrapClassName="podcast-video-wrap"
        playlistId={playlistId}
      />
      {label && (
        <div className="podcast-meta">
          <span className="podcast-channel">{label}</span>
        </div>
      )}
      <h3 className="podcast-title feltaro-video-title">{title}</h3>
      {summary && <p className="feltaro-video-summary">{summary}</p>}
      {note && (
        <p className="feltaro-video-note">
          {note.text}{' '}
          <a href={note.href} target="_blank" rel="noopener noreferrer">
            {note.linkText}
          </a>
        </p>
      )}
    </div>
  );
}
