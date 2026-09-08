const HU_MONTHS = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];
function fmtDate(d: Date): string {
  return `${HU_MONTHS[d.getMonth()]} ${d.getDate()}.`;
}

// Szóhatáron vág, nem közepén tör el szót — ugyanaz a minta, mint a
// related-complaint-card.tsx shortLead()-je. 2026-09-08 user report: az
// eredeti 110 karakteres határ 1-2 sor után levágta a leírást — most kb.
// 5 sornyi (nagyobb betűméret mellett is elfér a kártyán).
function shortLead(text: string | null, maxChars = 260): string | undefined {
  if (!text) return undefined;
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxChars)}…`;
}

export type FeljelentesTeaserItem = {
  id: string;
  targetName: string;
  description: string | null;
  amountLabel: string | null;
  sourceUrl: string;
  sourceName: string;
  eventDate: Date;
  isFresh: boolean;
};

/**
 * Nyitóoldali "Feljelentették-e már?" teaser kártyája (2026-09-08 user
 * kérés) — SZÁNDÉKOSAN önálló, kompakt komponens, nem a
 * RelatedComplaintCard/.ugy-block-article-card újrafelhasználása: az mindig
 * egyoldalas, függőleges listára lett tervezve (l. ugyek/[id]/page.tsx,
 * related-complaint-card.tsx egyetlen hívási helye sem rács), itt viszont
 * sűrű, több oszlopos rácsban kell megállnia.
 */
export function FeljelentesTeaserCard({ item }: { item: FeljelentesTeaserItem }) {
  return (
    <a
      href={item.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`feljelentes-card${item.isFresh ? ' feljelentes-card--breaking' : ''}`}
    >
      {item.isFresh && (
        <div className="feljelentes-card-badge">
          <span className="feljelentes-card-badge-dot" />
          BREAKING — FELJELENTÉS
        </div>
      )}
      <div className="feljelentes-card-meta">
        <span className="feljelentes-card-source">{item.sourceName}</span>
        <span className="feljelentes-card-date">{fmtDate(item.eventDate)}</span>
      </div>
      <div className="feljelentes-card-headline">{item.targetName}</div>
      {shortLead(item.description) && <p className="feljelentes-card-lead">{shortLead(item.description)}</p>}
      <div className="feljelentes-card-foot">
        {item.amountLabel && <span className="feljelentes-card-amount">{item.amountLabel}</span>}
        <span className="feljelentes-card-arrow">Cikk olvasása →</span>
      </div>
    </a>
  );
}
