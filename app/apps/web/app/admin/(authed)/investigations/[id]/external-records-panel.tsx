import type {
  DamageComponentDto,
  ExternalRecordDto,
  Relevance,
} from '@korr/shared';

function sourceLabel(s: ExternalRecordDto['sourceSystem']): string {
  if (s.startsWith('manual_')) return s.replace('manual_', 'kézi: ');
  return s;
}

function relevanceLabel(r: Relevance | null): string {
  switch (r) {
    case 'corroborates':
      return 'megerősíti';
    case 'contradicts':
      return 'cáfolja';
    case 'context':
      return 'kontextus';
    case 'benchmark':
      return 'benchmark';
    default:
      return '—';
  }
}

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

function fmtMrdRange(low: string, high: string): string {
  const lo = Number(low) / 1_000_000_000;
  const hi = Number(high) / 1_000_000_000;
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return `${low}–${high} Ft`;
  const fmt = new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 2 });
  if (lo === hi) return `${fmt.format(lo)} Mrd Ft`;
  return `${fmt.format(lo)}–${fmt.format(hi)} Mrd Ft`;
}

function ContributesBadges({
  recordId,
  components,
}: {
  recordId: string;
  components: DamageComponentDto[];
}) {
  const hits = components.filter((c) =>
    c.inputs.externalRecordIds?.includes(recordId),
  );
  if (hits.length === 0) return null;
  return (
    <a className="damage-contrib-badge" href="#damage-panel">
      {hits
        .map(
          (c) =>
            `🔗 hozzájárul: ${mechanismLabel(c.mechanism)} (${fmtMrdRange(c.lowHuf, c.highHuf)})`,
        )
        .join(' · ')}
    </a>
  );
}

export function ExternalRecordsPanel({
  records,
  damageComponents = [],
}: {
  records: ExternalRecordDto[];
  damageComponents?: DamageComponentDto[];
}) {
  if (!records || records.length === 0) {
    return (
      <section
        className="external-records-panel external-records-panel-empty"
        id="external-records-panel"
      >
        <h2>Külső evidencia</h2>
        <p>Nincs még külső rekord. Indíts cross-reference-et az akciósorból.</p>
      </section>
    );
  }
  return (
    <section className="external-records-panel" id="external-records-panel">
      <h2>Külső evidencia ({records.length})</h2>
      <ul className="external-record-list">
        {records.map((r) => {
          if (!r.canonicalUrl || !r.fetchedAt) return null;
          return (
            <li
              key={r.id}
              id={`record-${r.id}`}
              className={`external-record source-${r.sourceSystem}`}
            >
              <header>
                <span className="source-badge">{sourceLabel(r.sourceSystem)}</span>
                <span className="record-type">{r.recordType}</span>
                {r.evidenceGrade ? (
                  <span className="evidence-grade">{r.evidenceGrade}</span>
                ) : null}
                <span className="relevance">{relevanceLabel(r.relevance)}</span>
              </header>
              <p className="record-meta">
                <a href={r.canonicalUrl} target="_blank" rel="noreferrer noopener">
                  {r.canonicalUrl}
                </a>
              </p>
              <p className="record-fetched">
                Lekérve: {new Date(r.fetchedAt).toLocaleString('hu-HU')}
              </p>
              <ContributesBadges
                recordId={r.id}
                components={damageComponents}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
