'use client';

import { useEffect, useRef, useState } from 'react';
import type {
  InvestigationJobStateDto,
  JobKind,
  JobState,
} from '@korr/shared';

type StepKey = JobKind | 'extract_claims' | 'cluster';

type StepSpec = {
  key: StepKey;
  label: string;
  description: string;
  anchor: string;
  /** When true, the step is treated as already done before any job tracking starts. */
  alwaysDone?: boolean;
};

const STEP_ORDER: StepSpec[] = [
  {
    key: 'extract_claims',
    label: 'Állítás-kinyerés',
    description:
      'A cikk szövegéből Haiku 4.5 állításokat (mechanizmus + összeg + idézet) emel ki. Az eredmény az Állítások panelen látszik.',
    anchor: '#claims-panel',
    alwaysDone: true,
  },
  {
    key: 'cluster',
    label: 'Klaszterezés',
    description:
      'Az ugyanazon személyhez tartozó állításokat egy nyomozásba fűzi össze. Az eredmény maga ez a nyomozás-rekord.',
    anchor: '#detail-hero',
    alwaysDone: true,
  },
  {
    key: 'xref',
    label: 'Cross-reference',
    description:
      'Hivatalos rekordokat húz be (TED, EKR, Pályázat.gov, Cégjegyzék, OLAF…) és megerősítő / cáfoló külső rekordokká alakítja őket. Az eredmény a Külső evidencia panelen látszik.',
    anchor: '#external-records-panel',
  },
  {
    key: 'redflags',
    label: 'Vörös zászlók',
    description:
      'A szabályrendszer (egy ajánlattevő, módosítás > 20 %, közeli érdekeltség…) végigfut és minden szabályra pass / fail / nem alkalmazható verdiktet ír. Az eredmény a Vörös zászlók panelen látszik.',
    anchor: '#redflags-panel',
  },
  {
    key: 'hypothesis_loop',
    label: 'Hipotézis-hurok',
    description:
      'A modell célzott kérdéseket tesz fel a már meglévő evidenciákhoz, és nyomokat hagy (eszközhívás-, token- és időkerettel sapkázva). Az eredmény a Nyomok listán látszik.',
    anchor: '#leads-panel',
  },
  {
    key: 'benchmarks',
    label: 'Benchmark',
    description:
      'A nyomozást ár / km, túlárazás %, single-source dominancia stb. kohorsz-percentilisekhez méri. A kiugró értékek a Benchmark panelen kapnak címkét.',
    anchor: '#benchmarks-panel',
  },
  {
    key: 'damage_recompute',
    label: 'Kárbecslés',
    description:
      'A komponenseket (túlárazás, módosítás-delta, single-bidder felár, közeli érdekeltség, fantom-szolgáltatás) képletek és benchmarkok alapján Ft-tartománnyá önti, és sapkáz a szerződésértékre. Az eredmény a Kárbecslés panelen látszik.',
    anchor: '#damage-panel',
  },
];

function stateLabel(s: JobState | 'done'): string {
  switch (s) {
    case 'idle':
      return 'inaktív';
    case 'running':
      return 'fut';
    case 'done':
      return 'kész';
    case 'failed':
      return 'hiba';
  }
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('hu-HU');
}

type Props = {
  investigationId: string;
  initialStates: InvestigationJobStateDto[];
};

export function PipelinePanel({ investigationId, initialStates }: Props) {
  const [states, setStates] = useState<InvestigationJobStateDto[]>(initialStates);
  const sseRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const url = `/api/admin/investigations/${investigationId}/job-state`;

    function startPoll() {
      if (pollRef.current) return;
      const interval = Number(
        process.env.NEXT_PUBLIC_JOB_STATE_POLL_INTERVAL_MS ?? '2000',
      );
      pollRef.current = setInterval(async () => {
        try {
          const r = await fetch(url, {
            headers: { accept: 'application/json' },
            cache: 'no-store',
          });
          if (!r.ok) return;
          const body = (await r.json()) as InvestigationJobStateDto[];
          if (!cancelled) setStates(body);
        } catch {
          // swallow; the next tick retries.
        }
      }, Math.max(1000, interval));
    }

    try {
      const es = new EventSource(url);
      sseRef.current = es;
      es.addEventListener('JobStateChanged', (ev) => {
        try {
          const update = JSON.parse(
            (ev as MessageEvent).data,
          ) as InvestigationJobStateDto;
          setStates((prev) => {
            const others = prev.filter((p) => p.jobKind !== update.jobKind);
            return [...others, update].sort((a, b) =>
              a.jobKind.localeCompare(b.jobKind),
            );
          });
        } catch {
          // ignore malformed payloads
        }
      });
      es.onerror = () => {
        es.close();
        sseRef.current = null;
        startPoll();
      };
    } catch {
      startPoll();
    }

    return () => {
      cancelled = true;
      if (sseRef.current) sseRef.current.close();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [investigationId]);

  const byKind = new Map(states.map((s) => [s.jobKind, s]));

  return (
    <section className="pipeline-panel" id="pipeline-panel">
      <h2 className="panel-title">Folyamat</h2>
      <p className="pipeline-intro">
        Minden lépés egy panelt tölt fel evidenciával. Kattints a sorra, hogy az
        eredmény panelre ugorj.
      </p>
      <table className="pipeline-table">
        <thead>
          <tr>
            <th scope="col">Lépés</th>
            <th scope="col">Állapot</th>
            <th scope="col">Kezdés</th>
            <th scope="col">Befejezés</th>
            <th scope="col">Összegzés / hiba</th>
          </tr>
        </thead>
        <tbody>
          {STEP_ORDER.map((step) => {
            const row = step.alwaysDone
              ? undefined
              : byKind.get(step.key as JobKind);
            const state: JobState | 'done' = step.alwaysDone
              ? 'done'
              : (row?.state ?? 'idle');
            const detail =
              state === 'failed'
                ? row?.errorMessage ?? ''
                : state === 'done' && step.alwaysDone
                ? 'A nyomozás létrejöttekor lefutott.'
                : row?.summary ?? '';
            return (
              <tr
                key={step.key}
                className={`pipeline-row state-${state}`}
              >
                <th scope="row">
                  <a className="pipeline-step-link" href={step.anchor}>
                    <span className="pipeline-step-name">{step.label}</span>
                    <span className="pipeline-step-desc">
                      {step.description}
                    </span>
                  </a>
                </th>
                <td>
                  <span className={`pipeline-state state-${state}`}>
                    {stateLabel(state)}
                  </span>
                </td>
                <td>{fmtTime(row?.startedAt)}</td>
                <td>{fmtTime(row?.finishedAt)}</td>
                <td className="pipeline-detail">{detail}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
