/**
 * Single source of truth for the /bejelentes trust-posture text. The Phase-2
 * truthful copy ships first; once SUBMISSIONS_SEALED_BOX_ENABLED=true the
 * Phase-4 strong-promise text replaces it (T214). Editorial sign-off is
 * tracked in app/docs/trust-posture-signoff.md.
 */

const PHASE_2_COPY =
  'A bejelentésedet titkosítva tároljuk és csak a szerkesztőség férhet hozzá. Az IP-címedet az adatbázisban nem tároljuk; CDN- és platformszintű hozzáférési naplók ideiglenesen rögzíthetik, ezeket legfeljebb 7 napig őrizzük. Súlyosan bizalmas anyagokhoz használj Tor-böngészőt.';

const PHASE_4_COPY =
  'Beérkezésed végpont-titkosítva tároljuk és csak a szerkesztőség férhet hozzá. Az IP-címedet az adatbázisban nem tároljuk; CDN- és platformszintű hozzáférési naplók ideiglenesen rögzíthetik, ezeket legfeljebb 7 napig őrizzük. Súlyosan bizalmas anyagokhoz használj Tor-böngészőt.';

export function trustCopy(): string {
  return process.env.SUBMISSIONS_SEALED_BOX_ENABLED === 'true'
    ? PHASE_4_COPY
    : PHASE_2_COPY;
}

export function TrustCopy() {
  return (
    <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>
      {trustCopy()}
    </p>
  );
}
