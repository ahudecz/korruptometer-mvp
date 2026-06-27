import type {
  ArticleClaimDto,
  ExtractionRunDto,
  Party,
} from '@korr/shared';

type Props = {
  runs: ExtractionRunDto[];
};

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

function formatAmount(huf: string | null): string {
  if (!huf) return '—';
  try {
    return new Intl.NumberFormat('hu-HU').format(BigInt(huf)) + ' Ft';
  } catch {
    return huf;
  }
}

function PartiesChips({ parties }: { parties: Party[] }) {
  if (!parties || parties.length === 0) return null;
  return (
    <ul className="parties-chips" aria-label="Érintettek">
      {parties.map((p, i) => (
        <li key={`${p.normalizedName}-${i}`} className={`party-chip party-${p.kind}`}>
          <strong>{p.name}</strong>
          {p.role ? <span className="party-role"> — {p.role}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function ClaimCard({ claim }: { claim: ArticleClaimDto }) {
  // FR-038 defense-in-depth UI guard: refuse to render any claim missing
  // the three re-verifiability fields. The schema CHECK already enforces
  // this at the DB layer; this is the second line of defense.
  if (
    !claim.sourceUrl
    || !claim.paragraphLocator
    || !claim.evidenceQuote
  ) {
    return null;
  }
  const href = `${claim.sourceUrl}#${encodeURIComponent(claim.paragraphLocator)}`;
  return (
    <article className="claim-card" aria-label={`#${claim.claimOrdinal} állítás`}>
      <header className="claim-card-head">
        <span className="claim-mechanism">{mechanismLabel(claim.mechanism)}</span>
        <span className="claim-amount">
          {formatAmount(claim.allegedAmountHuf)}
          {claim.amountBasis ? ` (${claim.amountBasis})` : ''}
        </span>
        <span className="claim-confidence">conf {claim.confidence}%</span>
      </header>
      <PartiesChips parties={claim.parties} />
      <blockquote className="claim-quote">{claim.evidenceQuote}</blockquote>
      <a className="claim-source" href={href} target="_blank" rel="noreferrer noopener">
        Forrás · {claim.paragraphLocator}
      </a>
    </article>
  );
}

export function ClaimsPanel({ runs }: Props) {
  if (!runs || runs.length === 0) {
    return (
      <section className="claims-panel claims-panel-empty">
        <h2>Állítások</h2>
        <p>Nincs még kinyerés ehhez a cikkhez.</p>
      </section>
    );
  }
  return (
    <section className="claims-panel">
      <h2>Állítások</h2>
      {runs.map((run) => (
        <details
          key={`${run.extractorVersion}-${run.extractedAt}`}
          className="extraction-run"
          open={run.isCurrent}
        >
          <summary>
            <code>{run.extractorVersion}</code>
            <span className="run-meta">
              {run.isCurrent ? ' · jelenlegi' : ' · korábbi'} · {run.claimCount}{' '}
              állítás · {new Date(run.extractedAt).toLocaleString('hu-HU')}
            </span>
          </summary>
          {run.claims.length === 0 ? (
            <p className="run-zero">Nincs kinyert állítás ezen a verzión.</p>
          ) : (
            <div className="claim-list">
              {run.claims.map((c) => (
                <ClaimCard key={c.id} claim={c} />
              ))}
            </div>
          )}
        </details>
      ))}
    </section>
  );
}
