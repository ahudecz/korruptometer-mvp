import type {
  ArticleClaimDto,
  DamageComponentDto,
  DamageEstimateDto,
  ExternalRecordDto,
} from '@korr/shared';

function mechanismLabel(m: DamageComponentDto['mechanism']): string {
  switch (m) {
    case 'overpricing':
      return 'Túlárazás';
    case 'no_bid':
      return 'Versenytárgyalás nélküli';
    case 'kickback':
      return 'Visszacsorgatás';
    case 'amendment_inflation':
      return 'Szerződésmódosítás-felfújás';
    case 'phantom_service':
      return 'Fantomteljesítés';
    case 'related_party':
      return 'Közeli érdekeltség';
    default:
      return 'Egyéb';
  }
}

function methodLabel(m: DamageComponentDto['method']): string {
  switch (m) {
    case 'benchmark_deviation':
      return 'Benchmark-eltérés';
    case 'claim_consolidation':
      return 'Állítás-konszolidáció';
    case 'amendment_delta':
      return 'Módosítás-delta';
    case 'industry_estimate':
      return 'Iparági becslés';
  }
}

function confidenceLabel(c: DamageEstimateDto['confidence']): string {
  switch (c) {
    case 'low':
      return 'alacsony';
    case 'medium':
      return 'közepes';
    case 'high':
      return 'magas';
  }
}

function fmtHuf(huf: string): string {
  try {
    return new Intl.NumberFormat('hu-HU').format(BigInt(huf)) + ' Ft';
  } catch {
    return `${huf} Ft`;
  }
}

function fmtRange(low: string, high: string): string {
  if (low === high) return fmtHuf(low);
  return `${fmtHuf(low)} – ${fmtHuf(high)}`;
}

export function DamagePanel({
  estimate,
  claims,
  externalRecords,
}: {
  estimate: DamageEstimateDto | null;
  claims: ArticleClaimDto[];
  externalRecords: ExternalRecordDto[];
}) {
  if (!estimate || estimate.components.length === 0) {
    return (
      <section className="damage-panel damage-panel-empty" id="damage-panel">
        <h2 className="panel-title">Kárbecslés</h2>
        <p className="damage-empty">
          Még nincs kárbecslés. A nyomozás külső rekordjainak és vörös
          zászlóinak megérkezésekor automatikusan számolunk.
        </p>
      </section>
    );
  }

  const claimById = new Map(claims.map((c) => [c.id, c]));
  const recordById = new Map(externalRecords.map((r) => [r.id, r]));

  return (
    <section className="damage-panel" id="damage-panel">
      <header className="damage-hero">
        <div>
          <h2 className="panel-title">Kárbecslés</h2>
          <p className="damage-foot">
            Forintban kifejezett alsó-felső becslés a komponensek összegéből;
            sapkázva a szerződés-értékre.
          </p>
        </div>
        <div className="damage-hero-num">
          <span className="damage-total">
            {fmtRange(estimate.totalLowHuf, estimate.totalHighHuf)}
          </span>
          <span
            className={`damage-confidence damage-confidence-${estimate.confidence}`}
            aria-label={`Bizonyosság: ${confidenceLabel(estimate.confidence)}`}
          >
            Bizonyosság: {confidenceLabel(estimate.confidence)}
          </span>
        </div>
      </header>
      <ul className="damage-component-list">
        {estimate.components.map((c, idx) => {
          const linkedClaims = (c.inputs.claimIds ?? [])
            .map((id) => claimById.get(id))
            .filter((c): c is ArticleClaimDto => Boolean(c));
          const linkedRecords = (c.inputs.externalRecordIds ?? [])
            .map((id) => recordById.get(id))
            .filter((r): r is ExternalRecordDto => Boolean(r));
          return (
            <li
              key={`${c.mechanism}-${idx}`}
              className="damage-component"
              id={`damage-${c.mechanism}-${idx}`}
            >
              <details open={idx === 0}>
                <summary>
                  <span className="damage-mech">
                    {mechanismLabel(c.mechanism)}
                  </span>
                  <span className="damage-method">{methodLabel(c.method)}</span>
                  <span className="damage-range">
                    {fmtRange(c.lowHuf, c.highHuf)}
                  </span>
                </summary>
                <dl className="damage-component-detail">
                  <dt>Képlet</dt>
                  <dd className="damage-formula">{c.inputs.formula}</dd>
                  {c.inputs.citation ? (
                    <>
                      <dt>Forrás</dt>
                      <dd>
                        <a
                          href={c.inputs.citation.sourceUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          {c.inputs.citation.studyId}
                        </a>{' '}
                        · ellenőrizve: {c.inputs.citation.lastVerifiedAt}
                      </dd>
                    </>
                  ) : null}
                  {linkedClaims.length > 0 ? (
                    <>
                      <dt>Hozzájáruló állítások</dt>
                      <dd>
                        <ul className="damage-input-list">
                          {linkedClaims.map((cl) => (
                            <li key={cl.id}>
                              <a href={`#claim-${cl.id}`}>
                                {cl.parties[0]?.name ?? 'Állítás'} ·{' '}
                                {mechanismLabel(cl.mechanism)}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </dd>
                    </>
                  ) : null}
                  {linkedRecords.length > 0 ? (
                    <>
                      <dt>Hozzájáruló rekordok</dt>
                      <dd>
                        <ul className="damage-input-list">
                          {linkedRecords.map((r) => (
                            <li key={r.id}>
                              <a href={`#record-${r.id}`}>
                                {r.sourceSystem} · {r.externalId}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </dd>
                    </>
                  ) : null}
                  {c.inputs.benchmarkCohortHash ? (
                    <>
                      <dt>Kohorsz</dt>
                      <dd>
                        <a
                          href={`#benchmark-${c.inputs.benchmarkCohortHash}`}
                        >
                          {c.inputs.benchmarkCohortHash.slice(0, 12)}…
                        </a>
                      </dd>
                    </>
                  ) : null}
                  {c.notes ? (
                    <>
                      <dt>Megjegyzés</dt>
                      <dd>{c.notes}</dd>
                    </>
                  ) : null}
                </dl>
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
