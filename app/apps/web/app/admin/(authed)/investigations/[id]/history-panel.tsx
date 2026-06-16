import type { InvestigationDetail } from '@korr/shared';

export function HistoryPanel({ history }: { history: InvestigationDetail['history'] }) {
  if (!history || history.publicCases.length === 0) {
    return (
      <section className="history-panel history-panel-empty">
        <h2>Publikálási előzmények</h2>
        <p>Még nem volt publikus eset ehhez a nyomozáshoz.</p>
      </section>
    );
  }
  return (
    <section className="history-panel">
      <h2>Publikálási előzmények</h2>
      <ul>
        {history.publicCases.map((c) => (
          <li key={c.id} className={c.depromotedAt ? 'depromoted' : 'active'}>
            <code>{c.id}</code>
            <span> · publikálva: {new Date(c.promotedAt).toLocaleString('hu-HU')}</span>
            {c.depromotedAt ? (
              <span> · visszavonva: {new Date(c.depromotedAt).toLocaleString('hu-HU')}</span>
            ) : (
              <span> · jelenleg élő</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
