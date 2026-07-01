import type { RedFlagDto, SignalContributionDto } from '@korr/shared';

function verdictLabel(v: RedFlagDto['verdict']): string {
  switch (v) {
    case 'pass':
      return 'megfelelő';
    case 'fail':
      return 'gyanús';
    case 'not_applicable':
      return 'nincs adat';
  }
}

function ruleLabel(id: string): string {
  switch (id) {
    case 'single_bidder':
      return 'Egy ajánlattevő';
    case 'amendment_inflation_gt_20':
      return 'Szerződésmódosítás > 20 %';
    case 'related_party':
      return 'Közeli érdekeltség';
    case 'contractor_founded_lt_6m_before_contract':
      return 'Új vállalkozó';
    case 'single_source_dominance':
      return 'Forrás-koncentráció';
    case 'benchmark_p90_exceeded':
      return 'Benchmark p90 átlépés';
    default:
      return id;
  }
}

export function RedFlagsPanel({
  redFlags,
  signals = [],
}: {
  redFlags: RedFlagDto[];
  signals?: SignalContributionDto[];
}) {
  if (!redFlags || redFlags.length === 0) {
    return (
      <section
        className="redflags-panel redflags-panel-empty"
        id="redflags-panel"
      >
        <h2>Vörös zászlók</h2>
        <p>Még nem futott a szabályrendszer ezen a nyomozáson.</p>
      </section>
    );
  }
  const signalByRule = new Map(
    signals
      .filter((s) => s.sourceKind === 'red_flag')
      .map((s) => [s.sourceId, s]),
  );
  return (
    <section className="redflags-panel" id="redflags-panel">
      <h2>Vörös zászlók</h2>
      <ul className="redflag-list">
        {redFlags.map((r) => {
          if (
            !r.observationHu
            && (!r.supportingRecordIds || r.supportingRecordIds.length === 0)
          ) {
            return null;
          }
          const signal = signalByRule.get(r.ruleId);
          return (
            <li
              key={r.ruleId}
              id={`redflag-${r.ruleId}`}
              className={`redflag verdict-${r.verdict} sev-${r.severity}`}
            >
              <header>
                <span className="rule-id">{ruleLabel(r.ruleId)}</span>
                <span className="severity">{r.severity}</span>
                <span className="verdict">{verdictLabel(r.verdict)}</span>
                {signal ? (
                  <a className="signal-contrib-badge" href="#signal-table">
                    súly: {Number(signal.baseWeight).toFixed(2)} → eff.{' '}
                    {Number(signal.effectiveWeight).toFixed(2)}
                  </a>
                ) : null}
              </header>
              <p className="observation">{r.observationHu}</p>
              {r.supportingRecordIds.length > 0 ? (
                <p className="supporting-records">
                  Alátámasztó rekordok ({r.supportingRecordIds.length}):{' '}
                  {r.supportingRecordIds.map((id) => (
                    <code key={id}>{id.slice(0, 8)}</code>
                  ))}
                </p>
              ) : null}
              <p className="evaluated-at">
                {new Date(r.evaluatedAt).toLocaleString('hu-HU')}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
