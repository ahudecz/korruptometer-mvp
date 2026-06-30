/**
 * Procedural-stage stepper (FR-006) over the criminal-justice ladder. Terminal
 * "no charge"/"acquitted" outcomes render as a single terminal badge instead of
 * a half-finished ladder.
 */
const LADDER: { key: string; label: string }[] = [
  { key: 'reported', label: 'Feljelentés' },
  { key: 'investigating', label: 'Nyomozás' },
  { key: 'suspect_charged', label: 'Gyanúsítás' },
  { key: 'indicted', label: 'Vádemelés' },
  { key: 'on_trial', label: 'Bírósági szakasz' },
  { key: 'verdict_first_instance', label: 'Elsőfokú ítélet' },
  { key: 'final_verdict', label: 'Jogerős ítélet' },
];

const AUTHORITY_HU: Record<string, string> = {
  national_police: 'Rendőrség',
  prosecution: 'Ügyészség',
  integrity_authority: 'Integritás Hatóság',
  state_audit_asz: 'Állami Számvevőszék',
  olaf: 'OLAF',
  eppo: 'Európai Ügyészség',
  court: 'Bíróság',
  eu_commission: 'Európai Bizottság',
  other: 'Egyéb hatóság',
};

export function CaseTimeline({
  stage,
  authority,
}: {
  stage: string | null;
  authority: string | null;
}) {
  const authorityLabel = authority ? AUTHORITY_HU[authority] : null;

  if (stage === 'closed_no_charge' || stage === 'acquitted') {
    return (
      <div className="case-timeline">
        <div className="case-timeline-terminal">
          <span className="case-timeline-terminal-dot" />
          {stage === 'acquitted' ? 'Felmentés' : 'Eljárás megszüntetve'}
        </div>
        {authorityLabel && <div className="case-timeline-authority">{authorityLabel}</div>}
      </div>
    );
  }

  const currentIdx = LADDER.findIndex((s) => s.key === stage);

  return (
    <div className="case-timeline">
      <ol className="case-timeline-steps">
        {LADDER.map((s, i) => {
          const state =
            currentIdx < 0 ? 'pending' : i < currentIdx ? 'done' : i === currentIdx ? 'current' : 'pending';
          return (
            <li key={s.key} className={`case-timeline-step is-${state}`}>
              <span className="case-timeline-marker" />
              <span className="case-timeline-step-label">{s.label}</span>
            </li>
          );
        })}
      </ol>
      {authorityLabel && (
        <div className="case-timeline-authority">Eljáró hatóság: {authorityLabel}</div>
      )}
      {currentIdx < 0 && (
        <p className="case-timeline-note">Az eljárás stádiuma egyelőre nem besorolt.</p>
      )}
    </div>
  );
}
