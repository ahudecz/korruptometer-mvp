import type { SignalContributionDto } from '@korr/shared';

function sourceLabel(k: SignalContributionDto['sourceKind']): string {
  switch (k) {
    case 'external_record':
      return 'Külső rekord';
    case 'red_flag':
      return 'Vörös zászló';
    case 'claim_corroboration':
      return 'Állítás-megerősítés';
    case 'benchmark_deviation':
      return 'Benchmark-eltérés';
  }
}

function fmt(n: string): string {
  return Number(n).toFixed(2);
}

export function SignalTable({
  quantityScore,
  rows,
}: {
  quantityScore: string;
  rows: SignalContributionDto[];
}) {
  const sum = rows.reduce((acc, r) => acc + Number(r.effectiveWeight), 0);
  const sumFixed = sum.toFixed(2);
  const headlineFixed = Number(quantityScore).toFixed(2);
  const drift = Math.abs(Number(quantityScore) - sum) > 0.01;
  const hasDecayedRow = rows.some((r) => Number(r.stalenessMultiplier) < 1.0);

  return (
    <section className="signal-table-panel" id="signal-table">
      <h2 className="panel-title">
        Mennyiségi pont <span className="score-headline">{headlineFixed}</span>
      </h2>
      {rows.length === 0 ? (
        <p className="signal-table-empty">
          Még nincs független jelzés ezen a nyomozáson.
        </p>
      ) : (
        <>
          <table className="signal-table">
            <thead>
              <tr>
                <th scope="col">Jelzés</th>
                <th scope="col">Súly</th>
                <th scope="col">Staleness</th>
                <th scope="col">Eff.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className={
                    Number(r.stalenessMultiplier) < 1.0 ? 'is-decayed' : ''
                  }
                >
                  <td>
                    <strong>{sourceLabel(r.sourceKind)}</strong>{' '}
                    <code>{r.sourceId.slice(0, 24)}</code>
                  </td>
                  <td>{fmt(r.baseWeight)}</td>
                  <td>× {fmt(r.stalenessMultiplier)}</td>
                  <td>{fmt(r.effectiveWeight)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className={drift ? 'has-drift' : ''}>
                <th scope="row">Σ effektív</th>
                <td />
                <td />
                <td>{sumFixed}</td>
              </tr>
            </tfoot>
          </table>
          {hasDecayedRow ? (
            <p className="signal-foot">
              A × &lt; 1,00 staleness-szorzó az evidencia korával csökken; a
              friss érték{' '}
              <code>1.00</code> a vörös zászló kiváltó pillanatában.
            </p>
          ) : null}
          {drift ? (
            <p className="signal-drift" role="alert">
              Eltérés a tárolt <code>quantityScore</code> ({headlineFixed}) és
              a részjegyzések összege ({sumFixed}) között — az üzemeltetők
              értesülnek.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
