import type { InvestigationLeadDto } from '@korr/shared';

function kindLabel(k: InvestigationLeadDto['kind']): string {
  switch (k) {
    case 'hypothesis':
      return 'Hipotézis';
    case 'search_lead':
      return 'Kutatás';
    case 'reviewer_question':
      return 'Kérdés';
    case 'escalation':
      return 'Eszkaláció';
    case 'cluster_ambiguous':
      return 'Klaszter-vita';
  }
}

function statusLabel(s: InvestigationLeadDto['status']): string {
  switch (s) {
    case 'open':
      return 'nyitott';
    case 'tested':
      return 'tesztelve';
    case 'resolved':
      return 'lezárva';
    case 'rejected':
      return 'elutasítva';
  }
}

export function LeadsPanel({ leads }: { leads: InvestigationLeadDto[] }) {
  if (!leads || leads.length === 0) {
    return (
      <section className="leads-panel" id="leads-panel">
        <h2>Nyomok</h2>
        <p>Nincs nyitott nyom.</p>
      </section>
    );
  }
  return (
    <section className="leads-panel" id="leads-panel">
      <h2>Nyomok</h2>
      <ul>
        {leads.map((l) => (
          <li key={l.id} className={`lead lead-${l.kind} status-${l.status}`}>
            <header>
              <span className="lead-kind">{kindLabel(l.kind)}</span>
              <span className="lead-status">{statusLabel(l.status)}</span>
              {l.capFired ? <span className="lead-cap">cap: {l.capFired}</span> : null}
            </header>
            <p className="lead-question">{l.question}</p>
            {l.finding ? <p className="lead-finding">{l.finding}</p> : null}
            <p className="lead-meta">
              {new Date(l.createdAt).toLocaleString('hu-HU')} · {l.createdBy}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
