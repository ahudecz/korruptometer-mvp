import type { BreakingUpdate } from './ugyek-config';
import { PodcastVideoBox } from './podcast-video-box';

// Breaking-update táblázat "24,4 M EUR (1208 gép)" alakú celláinak szétvágása
// — a zárójeles rész mindig saját sorba kerül (user kérés, 2026-09-03),
// nem a CSS-re bízva (a white-space:nowrap más celláknál kell, itt viszont
// megbízhatóbb a JSX-szintű törés, mint egy törékeny regex-alapú CSS-trükk).
function splitParen(value: string): { main: string; detail: string | null } {
  const m = value.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  return m ? { main: m[1]!, detail: m[2]! } : { main: value, detail: null };
}

/**
 * Az ügyoldal tetején ülő BREAKING frissítés (UgyekConfig.breakingUpdate).
 * 2026-10-01: kiszervezve az /ugyek/[id] oldalból, hogy az ügy SEO-aloldalai
 * (/ugyek/<ügy>/<téma>, SubpageBlock 'breaking') ugyanezt a dobozt mutassák
 * — user kérés: Hankó letartóztatása az NKA-ügyoldalon ÉS az
 * nka-letartoztatas aloldalon is. A videó facade (kattintásra tölt), l.
 * project-youtube-embed-perf.
 */
export function BreakingUpdateBox({ update }: { update: BreakingUpdate }) {
  return (
    <div className="ugy-breaking-update">
      <div className="ugy-breaking-update-header">
        <div className="ugy-breaking-box-label">
          <span className="ugy-breaking-box-dot" />
          BREAKING · {update.dateLabel}
        </div>
        <div className="ugy-breaking-group-headline">{update.headline}</div>
        <p className="ugy-breaking-box-lead">{update.lead}</p>
      </div>
      {update.companies.length > 0 && (
        <div className="ugy-breaking-update-table-wrap">
          <table className="ugy-breaking-update-table">
            <thead>
              <tr>
                <th>Cég</th>
                <th>Beszerzési ár</th>
                <th>KKM fizetett</th>
                <th>Haszon / túlárazás</th>
                <th>Árbevétel-változás</th>
              </tr>
            </thead>
            <tbody>
              {update.companies.map((c, i) => (
                <tr key={i}>
                  <td>
                    {c.name}
                    {c.note && <span className="ugy-breaking-update-table-note"> ({c.note})</span>}
                  </td>
                  <td>
                    {splitParen(c.purchasePrice).main}
                    {splitParen(c.purchasePrice).detail && (
                      <span className="ugy-breaking-update-paren"> ({splitParen(c.purchasePrice).detail})</span>
                    )}
                  </td>
                  <td>{c.received}</td>
                  <td>{c.profit}</td>
                  <td>{c.revenueGrowth ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* 2026-09-15 (Volánbusz-ügy): céges táblázat helyett — vagy amellett —
          keretes hírkártyák, ugyanabban a formában, mint a pinnedNews. */}
      {update.articles?.map((a, i) => (
        <a key={`bu-${i}`} href={a.url} target="_blank" rel="noopener noreferrer" className="ugy-block-article-card">
          <div className="ugy-block-article-meta">
            <span className="ugy-block-article-source">{a.source}</span>
            {a.date && <span className="ugy-block-article-date">{a.date}</span>}
          </div>
          <div className="ugy-block-article-headline">{a.headline}</div>
          {a.lead && <p className="ugy-block-article-lead">{a.lead}</p>}
          <span className="ugy-block-article-arrow">Cikk olvasása →</span>
        </a>
      ))}
      {update.video && (
        <div className="ugy-extra-video ugy-breaking-update-video">
          <div className="ugy-extra-video-meta">
            <span className="ugy-extra-video-label">{update.video.label}</span>
            <span className="ugy-extra-video-title">{update.video.title}</span>
            <p className="ugy-extra-video-summary">{update.video.summary}</p>
          </div>
          <PodcastVideoBox videoId={update.video.id} title={update.video.title} wrapClassName="ugy-extra-video-wrap" />
        </div>
      )}
      {update.companiesNote && <p className="ugy-breaking-update-footnote">{update.companiesNote}</p>}
      {update.sourceUrl && (
        <a href={update.sourceUrl} target="_blank" rel="noopener noreferrer" className="ugy-breaking-update-source">
          Forrás: {update.sourceLabel} →
        </a>
      )}
    </div>
  );
}
