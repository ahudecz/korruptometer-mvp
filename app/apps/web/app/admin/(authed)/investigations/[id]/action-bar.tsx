'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { AvailableAction } from '@korr/shared';

type Props = {
  investigationId: string;
  updatedAt: string;
  availableActions: AvailableAction[];
};

const ACTION_LABELS: Record<AvailableAction, string> = {
  run_xref: 'Cross-reference futtatása',
  run_redflags: 'Vörös zászlók ellenőrzése',
  run_hypothesis_loop: 'Hipotézis-hurok futtatása',
  escalate_paid_lookup: 'Mélytulajdoni lekérés eszkalálása',
  write_paid_result: 'Fizetős eredmény rögzítése',
  promote_journalist: 'Újságírói szintre',
  promote_prosecutor: 'Ügyészi szintre',
  promote_public: 'Publikálás',
  depromote_public: 'Publikus visszavonása',
  dismiss: 'Elvetés',
  merge_into: 'Összevonás…',
  edit_summary: 'Összefoglaló szerkesztése',
};

const PROMOTION_HOVER: Record<
  'promote_journalist' | 'promote_prosecutor' | 'promote_public',
  string
> = {
  promote_journalist:
    'Átkapcsolja a nyomozást újságírói szintre — a részletoldal megosztható lesz egy újságíróval. Előfeltétel: mennyiségi ≥ 2 ÉS minőség ≥ investigative_journalism.',
  promote_prosecutor:
    'Ügyészi szintre küldi a nyomozást — handoff-csomag és audit-naplóbejegyzés készül. Előfeltétel: mennyiségi ≥ 2 ÉS minőség ≥ investigative_journalism.',
  promote_public:
    'Publikussá teszi a nyomozást — anonimizált publikus eset jön létre. Előfeltétel: a fenti gát + legalább egy korroboráló rekord {TED, EKR, palyazat, integritas, olaf} forrásból.',
};

async function callAction(
  investigationId: string,
  action: AvailableAction,
  updatedAt: string,
  router: ReturnType<typeof useRouter>,
): Promise<{ ok: boolean; errorCode?: string }> {
  switch (action) {
    case 'run_xref':
      return fireSimple(`/api/admin/investigations/${investigationId}/xref`, updatedAt);
    case 'run_redflags':
      return fireSimple(`/api/admin/investigations/${investigationId}/redflags`, updatedAt);
    case 'run_hypothesis_loop':
      return fireSimple(
        `/api/admin/investigations/${investigationId}/hypothesis-loop`,
        updatedAt,
      );
    case 'escalate_paid_lookup': {
      const note = typeof window !== 'undefined'
        ? window.prompt('Eszkaláció oka (1 mondat):')?.trim() ?? ''
        : '';
      if (!note) return { ok: false, errorCode: 'cancelled' };
      const r = await fetch(`/api/admin/investigations/${investigationId}/escalate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'If-Match': updatedAt },
        body: JSON.stringify({ lookupKind: 'deep_ownership', note }),
      });
      router.refresh();
      if (r.ok) return { ok: true };
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      return { ok: false, errorCode: j.error ?? statusToCode(r.status) };
    }
    case 'write_paid_result':
      return { ok: false, errorCode: 'not_wired' };
    case 'promote_journalist':
    case 'promote_prosecutor':
    case 'promote_public':
      return firePromote(investigationId, action, updatedAt, router);
    case 'depromote_public':
      return fireSimple(
        `/api/admin/investigations/${investigationId}/depromote`,
        updatedAt,
        router,
      );
    case 'dismiss':
    case 'merge_into':
    case 'edit_summary':
      return { ok: false, errorCode: 'use_row_menu' };
  }
}

function statusToCode(status: number): string {
  if (status === 401) return 'not_authorized';
  if (status === 403) return 'webauthn_required';
  if (status === 409) return 'stale';
  if (status === 422) return 'predicate_failed';
  if (status === 429) return 'rate_limited';
  if (status >= 500 && status < 600) return 'internal_error';
  return `http_${status}`;
}

async function fireSimple(
  url: string,
  updatedAt: string,
  router?: ReturnType<typeof useRouter>,
): Promise<{ ok: boolean; errorCode?: string }> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'If-Match': updatedAt },
  });
  if (router) router.refresh();
  if (r.ok) return { ok: true };
  const j = (await r.json().catch(() => ({}))) as { error?: string };
  return { ok: false, errorCode: j.error ?? statusToCode(r.status) };
}

async function firePromote(
  id: string,
  action: 'promote_journalist' | 'promote_prosecutor' | 'promote_public',
  updatedAt: string,
  router: ReturnType<typeof useRouter>,
): Promise<{ ok: boolean; errorCode?: string }> {
  const tier = action === 'promote_journalist'
    ? 'journalist'
    : action === 'promote_prosecutor'
    ? 'prosecutor'
    : 'public';
  const r = await fetch(`/api/admin/investigations/${id}/promote`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'If-Match': updatedAt },
    body: JSON.stringify({ tier }),
  });
  router.refresh();
  if (r.ok) return { ok: true };
  const j = (await r.json().catch(() => ({}))) as { error?: string };
  return { ok: false, errorCode: j.error ?? statusToCode(r.status) };
}

/**
 * Hungarian-only translator mirror of `lib/investigation/i18n-errors.ts`.
 * The server-only helper cannot be imported from a client component, so
 * the registry is duplicated here. Tests (T127) assert the two registries
 * stay aligned.
 */
const CLIENT_REGISTRY: Record<string, string> = {
  stale: 'A nyomozás közben módosult. Frissítsd az oldalt.',
  loop_in_flight:
    'A hipotézis-hurok már fut ezen a nyomozáson — várd meg a végét.',
  already_promoted: 'Ez a nyomozás már promotálva van.',
  predicate_failed:
    'A promotálás előfeltételei nem teljesülnek (mennyiségi vagy minőségi szint).',
  job_timeout: 'A futás időtúllépés miatt megszakadt. Próbáld újra.',
  job_canceled: 'A futást megszakították.',
  job_unknown_error: 'A futás ismeretlen hibával ért véget.',
  cap_tool_calls:
    'Eszközhívás-keret elfogyott (8). Szűkítsd a kérdést, vagy várd a következő futtatást.',
  cap_tokens:
    'Token-keret elfogyott (50 000). Vágd szűkebbre a kérdést, vagy várj a nightly-refresh-ig.',
  cap_wall_clock:
    'Időkeret elfogyott (90 mp). A nyomozás túl szerteágazó a hipotézis-hurokhoz.',
  ted_timeout: 'TED API időtúllépés. Próbáld újra később.',
  ekr_timeout: 'EKR API időtúllépés. Próbáld újra később.',
  adapter_parse_failure:
    'A külső forrás válasza nem volt értelmezhető. Az üzemeltetők értesülnek.',
  adapter_blocked_by_robots:
    'A külső forrás letiltotta a lekérést (robots.txt). Hagyd ki ezt a forrást.',
  cohort_too_thin:
    'A benchmark-kohorsz túl kicsi (n<10) — szakmai becslés helyett várd ki a több adatpontot.',
  cohort_window_drift:
    'A benchmark időablaka már nem fedi a szerződés évét.',
  claim_record_conflict:
    'Az állítás és a külső rekord összege ellentmond — reviewer-i felülvizsgálat szükséges.',
  score_invariant_drift:
    'A pontszám és a részjegyzések összege eltér. Az üzemeltetők értesülnek.',
  not_authorized: 'Nincs jogosultságod ehhez a művelethez.',
  webauthn_required: 'Erős hitelesítés (WebAuthn) szükséges a folytatáshoz.',
  rate_limited: 'Túl sok kérés — várj egy percet, és próbáld újra.',
  internal_error:
    'A szerver hibát jelzett. Az üzemeltetők értesülnek; próbáld újra később.',
  upstream_unavailable:
    'A külső szolgáltatás nem elérhető — próbáld újra később.',
  not_wired:
    'Ez a művelet az API-n keresztül érhető el — lásd contracts/admin-investigations.md.',
  use_row_menu: 'Használd a soron belüli menüt ehhez a művelethez.',
  cancelled: '',
};

function tErrorClient(code: string): string {
  if (Object.prototype.hasOwnProperty.call(CLIENT_REGISTRY, code)) {
    return CLIENT_REGISTRY[code]!;
  }
  return 'Ismeretlen hiba történt — próbáld újra később.';
}

function isPromotion(
  a: AvailableAction,
): a is 'promote_journalist' | 'promote_prosecutor' | 'promote_public' {
  return (
    a === 'promote_journalist'
    || a === 'promote_prosecutor'
    || a === 'promote_public'
  );
}

export function ActionBar({ investigationId, updatedAt, availableActions }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="action-bar" role="group" aria-label="Nyomozás akciók">
      {availableActions.length === 0 ? (
        <p>Nincs elérhető akció (a nyomozás nincs `new` állapotban).</p>
      ) : (
        availableActions.map((a) => {
          const button = (
            <button
              key={a}
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const r = await callAction(investigationId, a, updatedAt, router);
                  if (!r.ok && r.errorCode && r.errorCode !== 'cancelled') {
                    setError(tErrorClient(r.errorCode));
                  }
                })
              }
            >
              {ACTION_LABELS[a]}
            </button>
          );
          if (isPromotion(a)) {
            return (
              <span key={a} className="action-with-hover">
                {button}
                <span className="action-hover" role="tooltip">
                  {PROMOTION_HOVER[a]}
                </span>
              </span>
            );
          }
          return button;
        })
      )}
      {error ? (
        <p role="alert" className="action-bar-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
