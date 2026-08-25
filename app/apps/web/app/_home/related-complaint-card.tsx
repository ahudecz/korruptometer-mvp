import type { RelatedComplaint } from '@/lib/related-complaints';

const HU_MONTHS = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];
function fmtDate(d: Date): string {
  return `${d.getFullYear()}. ${HU_MONTHS[d.getMonth()]} ${d.getDate()}.`;
}

// Rövid összefoglaló a "lead"-hez (user kérés) — szóhatáron vág, nem
// közepén tör el szót.
function shortLead(text: string | null, maxChars = 220): string | undefined {
  if (!text) return undefined;
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxChars)}…`;
}

/**
 * Galéria-személyhez/kiemelt ügyhöz kapcsolódó feljelentés — kiemelt
 * keretes hírként, az ügyek-oldali article-card formátummal (l.
 * feedback-keretes-format memória: "keretes" mindig ez a forma,
 * forrás/dátum/cím/lead/"Cikk olvasása →", kép nélkül). ≤7 napos
 * feljelentésnél BREAKING jelölést kap, ugyanúgy, mint a
 * /ugyek/nka-botrany oldal breaking article-card-jai.
 */
export function RelatedComplaintCard({ complaint }: { complaint: RelatedComplaint }) {
  return (
    <a
      href={complaint.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`ugy-block-article-card${complaint.isFresh ? ' ugy-block-article-card--breaking' : ''}`}
    >
      {complaint.isFresh && (
        <div className="ugy-block-article-breaking-badge">
          <span className="ugy-block-article-breaking-dot" />
          BREAKING — FELJELENTÉS
        </div>
      )}
      <div className="ugy-block-article-meta">
        <span className="ugy-block-article-source">{complaint.sourceName}</span>
        <span className="ugy-block-article-date">{fmtDate(complaint.eventDate)}</span>
      </div>
      <div className="ugy-block-article-headline">{complaint.targetName}</div>
      {shortLead(complaint.description) && <p className="ugy-block-article-lead">{shortLead(complaint.description)}</p>}
      <span className="ugy-block-article-arrow">Cikk olvasása →</span>
    </a>
  );
}
