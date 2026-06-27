import type { BenchmarkDto, DamageComponentDto } from '@korr/shared';

function fmtNum(s: string): string {
  try {
    return new Intl.NumberFormat('hu-HU', {
      maximumFractionDigits: 2,
    }).format(Number(s));
  } catch {
    return s;
  }
}

export function BenchmarksPanel({
  benchmarks,
  damageComponents = [],
}: {
  benchmarks: BenchmarkDto[];
  damageComponents?: DamageComponentDto[];
}) {
  if (!benchmarks || benchmarks.length === 0) {
    return (
      <section
        className="benchmarks-panel benchmarks-panel-empty"
        id="benchmarks-panel"
      >
        <h2>Benchmark</h2>
        <p>Nincs összehasonlító kohort. Futtass cross-reference-et a benchmark-kompozícióhoz.</p>
      </section>
    );
  }
  const cohortInDamage = new Set(
    damageComponents
      .map((c) => c.inputs.benchmarkCohortHash)
      .filter((h): h is string => Boolean(h)),
  );
  return (
    <section className="benchmarks-panel" id="benchmarks-panel">
      <h2>Benchmark</h2>
      <ul className="benchmark-list">
        {benchmarks.map((b) => (
          <li
            key={b.cohortHash}
            id={`benchmark-${b.cohortHash}`}
            className={`benchmark-card ${b.isOutlier ? 'is-outlier' : ''}`}
            title={`cohort ${b.cohortHash.slice(0, 12)}`}
          >
            <header>
              <span className="dimension">{b.dimension}</span>
              <span className="n">n = {b.n}</span>
              {b.isOutlier ? <span className="outlier">kiugró</span> : null}
            </header>
            <dl>
              <div>
                <dt>p10</dt>
                <dd>{fmtNum(b.p10)}</dd>
              </div>
              <div>
                <dt>p50</dt>
                <dd>{fmtNum(b.p50)}</dd>
              </div>
              <div>
                <dt>p90</dt>
                <dd>{fmtNum(b.p90)}</dd>
              </div>
              {b.investigationValue ? (
                <div>
                  <dt>nyomozás értéke</dt>
                  <dd>{fmtNum(b.investigationValue)}</dd>
                </div>
              ) : null}
            </dl>
            <p className="computed-at">
              Számítva: {new Date(b.computedAt).toLocaleString('hu-HU')}
            </p>
            {cohortInDamage.has(b.cohortHash) ? (
              <a className="damage-contrib-badge" href="#damage-panel">
                🔗 kárkomponensben használva
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
