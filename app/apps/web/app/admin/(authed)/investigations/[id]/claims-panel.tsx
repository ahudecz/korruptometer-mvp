import type {
  ArticleClaimDto,
  DamageComponentDto,
  Party,
} from '@korr/shared';

function mechanismLabel(m: ArticleClaimDto['mechanism']): string {
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

function fmtAmount(huf: string | null): string {
  if (!huf) return '—';
  try {
    return new Intl.NumberFormat('hu-HU').format(BigInt(huf)) + ' Ft';
  } catch {
    return huf;
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

function PartyList({ parties }: { parties: Party[] }) {
  if (!parties || parties.length === 0) return null;
  return (
    <ul className="parties-chips">
      {parties.map((p, i) => (
        <li key={`${p.normalizedName}-${i}`} className={`party-chip party-${p.kind}`}>
          <strong>{p.name}</strong>
          {p.role ? <span className="party-role"> — {p.role}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function ContributesBadges({
  claimId,
  components,
}: {
  claimId: string;
  components: DamageComponentDto[];
}) {
  const hits = components.filter((c) => c.inputs.claimIds?.includes(claimId));
  if (hits.length === 0) return null;
  return (
    <a className="damage-contrib-badge" href="#damage-panel">
      {hits
        .map((c) => `🔗 hozzájárul: ${mechanismLabel(c.mechanism)} (${fmtMrdRange(c.lowHuf, c.highHuf)})`)
        .join(' · ')}
    </a>
  );
}

export function InvestigationClaimsPanel({
  claims,
  damageComponents = [],
}: {
  claims: ArticleClaimDto[];
  damageComponents?: DamageComponentDto[];
}) {
  if (!claims || claims.length === 0) {
    return (
      <section className="claims-panel claims-panel-empty" id="claims-panel">
        <h2>Állítások</h2>
        <p>Nincs még kinyert állítás ehhez a nyomozáshoz.</p>
      </section>
    );
  }
  return (
    <section className="claims-panel" id="claims-panel">
      <h2>Állítások</h2>
      <ul className="claim-list">
        {claims.map((c) => {
          if (!c.sourceUrl || !c.paragraphLocator || !c.evidenceQuote) return null;
          const href = `${c.sourceUrl}#${encodeURIComponent(c.paragraphLocator)}`;
          return (
            <li key={c.id} id={`claim-${c.id}`} className="claim-card">
              <header>
                <span className="claim-mechanism">{mechanismLabel(c.mechanism)}</span>
                <span className="claim-amount">
                  {fmtAmount(c.allegedAmountHuf)}
                  {c.amountBasis ? ` (${c.amountBasis})` : ''}
                </span>
                <span className="claim-confidence">conf {c.confidence}%</span>
              </header>
              <PartyList parties={c.parties} />
              <blockquote>{c.evidenceQuote}</blockquote>
              <a href={href} target="_blank" rel="noreferrer noopener">
                Forrás · {c.paragraphLocator}
              </a>
              <ContributesBadges claimId={c.id} components={damageComponents} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
