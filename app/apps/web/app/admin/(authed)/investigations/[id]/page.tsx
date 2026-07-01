import 'server-only';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';

import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { pickNextStep } from '@/lib/investigation/next-step';
import { readJobStates } from '@/lib/investigation/job-state';
import type {
  DamageComponentDto,
  DamageEstimateDto,
  DisclosureTier,
  InvestigationDetail,
  InvestigationJobStateDto,
  InvestigationStatus,
  SignalContributionDto,
} from '@korr/shared';

import { InvestigationClaimsPanel } from './claims-panel';
import { LeadsPanel } from './leads-panel';
import { ExternalRecordsPanel } from './external-records-panel';
import { BenchmarksPanel } from './benchmarks-panel';
import { RedFlagsPanel } from './redflags-panel';
import { HistoryPanel } from './history-panel';
import { ActionBar } from './action-bar';
import { DamagePanel } from './damage-panel';
import { SignalTable } from './signal-table';
import { PipelinePanel } from './pipeline-panel';
import { NextStepBanner } from './next-step-banner';

export const dynamic = 'force-dynamic';

async function fetchDetail(id: string): Promise<InvestigationDetail | null> {
  const h = await headers();
  const cookie = h.get('cookie') ?? '';
  const host = h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const res = await fetch(
    `${proto}://${host}/api/admin/investigations/${id}`,
    { headers: { cookie }, cache: 'no-store' },
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`admin investigations detail fetch failed: ${res.status}`);
  }
  return (await res.json()) as InvestigationDetail;
}

async function fetchDamageEstimate(
  id: string,
): Promise<DamageEstimateDto | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.damageEstimates)
    .where(eq(schema.damageEstimates.investigationId, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    investigationId: row.investigationId,
    totalLowHuf: row.totalLowHuf.toString(),
    totalHighHuf: row.totalHighHuf.toString(),
    confidence: row.confidence,
    components: (row.components as DamageComponentDto[]) ?? [],
    inputsHash: row.inputsHash,
    computedAt: row.computedAt.toISOString(),
  };
}

async function fetchSignalContributions(
  id: string,
): Promise<SignalContributionDto[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.signalContributions)
    .where(eq(schema.signalContributions.investigationId, id));
  return rows.map((r) => ({
    id: r.id,
    sourceKind: r.sourceKind as SignalContributionDto['sourceKind'],
    sourceId: r.sourceId,
    baseWeight: r.baseWeight,
    stalenessMultiplier: r.stalenessMultiplier,
    effectiveWeight: r.effectiveWeight ?? '0',
    addedAt: r.addedAt.toISOString(),
  }));
}

function statusLabel(s: InvestigationStatus): string {
  switch (s) {
    case 'new':
      return 'Új';
    case 'dismissed':
      return 'Elvetve';
    case 'merged':
      return 'Összevonva';
  }
}

function tierLabel(t: DisclosureTier): string {
  switch (t) {
    case 'internal':
      return 'Belső';
    case 'journalist':
      return 'Újságírói';
    case 'prosecutor':
      return 'Ügyészi';
    case 'public':
      return 'Publikus';
  }
}

function fmtBigHuf(huf: string | null | undefined): {
  value: string;
  unit: string;
} {
  if (huf === null || huf === undefined) return { value: '—', unit: '' };
  const n = Number(huf);
  if (!Number.isFinite(n) || n <= 0) return { value: '0', unit: 'Ft' };
  const f = new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 1 });
  if (n >= 1_000_000_000_000) return { value: f.format(n / 1_000_000_000_000), unit: 'Bil Ft' };
  if (n >= 1_000_000_000) return { value: f.format(n / 1_000_000_000), unit: 'Mrd Ft' };
  if (n >= 1_000_000) return { value: f.format(n / 1_000_000), unit: 'M Ft' };
  return { value: new Intl.NumberFormat('hu-HU').format(n), unit: 'Ft' };
}

function fmtDamageRange(
  low: string | null | undefined,
  high: string | null | undefined,
): { primary: string; unit: string } | null {
  if (low === null || low === undefined || high === null || high === undefined) {
    return null;
  }
  const lo = Number(low);
  const hi = Number(high);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  if (lo <= 0 && hi <= 0) return null;
  const pick = (n: number): { div: number; unit: string } => {
    if (n >= 1_000_000_000_000) return { div: 1_000_000_000_000, unit: 'Bil Ft' };
    if (n >= 1_000_000_000) return { div: 1_000_000_000, unit: 'Mrd Ft' };
    if (n >= 1_000_000) return { div: 1_000_000, unit: 'M Ft' };
    return { div: 1, unit: 'Ft' };
  };
  const { div, unit } = pick(hi);
  const f = new Intl.NumberFormat('hu-HU', {
    maximumFractionDigits: div === 1 ? 0 : 1,
  });
  const loStr = f.format(lo / div);
  const hiStr = f.format(hi / div);
  if (loStr === hiStr) return { primary: hiStr, unit };
  return { primary: `${loStr}–${hiStr}`, unit };
}

function qualityShort(g: string | null | undefined): string {
  if (!g) return '—';
  switch (g) {
    case 'court_document':
      return 'bírósági';
    case 'audit_report':
      return 'audit';
    case 'prosecutor_statement':
      return 'ügyészi';
    case 'investigative_journalism':
      return 'újságírói';
    case 'opposition_politician':
      return 'ellenzéki';
    case 'opinion_press':
      return 'vélemény';
    case 'rumor':
      return 'pletyka';
    default:
      return g;
  }
}

export default async function InvestigationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireEditor();
  const { id } = await params;
  const [detail, damage, signals, jobStateRows] = await Promise.all([
    fetchDetail(id),
    fetchDamageEstimate(id),
    fetchSignalContributions(id),
    readJobStates(id),
  ]);
  if (!detail) notFound();

  const inv = detail.investigation;
  const status = inv.status as InvestigationStatus;
  const tier = inv.disclosureTier as DisclosureTier;

  const jobStates: InvestigationJobStateDto[] = jobStateRows.map((r) => ({
    jobKind: r.jobKind,
    state: r.state,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt,
    inngestRunId: r.inngestRunId,
    summary: r.summary,
    errorMessage: r.errorMessage,
    updatedAt: r.updatedAt,
  }));

  const newestExternalRecordFetchedAt =
    detail.externalRecords[0]?.fetchedAt ?? null;
  const banner = pickNextStep({
    jobStates,
    newestExternalRecordFetchedAt,
    hasExternalRecords: detail.externalRecords.length > 0,
    hasRedFlags: detail.redFlags.length > 0,
    availableActions: detail.availableActions,
  });

  return (
    <main className="admin-investigation-detail">
      <header className="detail-hero" id="detail-hero">
        <div className="detail-left">
          <nav className="breadcrumb" aria-label="Navigáció">
            <Link href="/admin/investigations">Nyomozások</Link>
            <span className="sep">/</span>
            <span>№ {inv.id.slice(0, 8)}</span>
            <span className="sep">/</span>
            <span className="breadcrumb-status">{statusLabel(status)}</span>
          </nav>
          <h1 className="detail-name">
            {inv.primaryPersonName ?? '— (névtelen klaszter)'}
          </h1>
          <p className="detail-entity">
            {inv.primaryEntityName ?? 'Szervezet ismeretlen'}
          </p>
          <ul className="detail-meta">
            <li>
              <strong>{inv.articleCount}</strong> cikk
            </li>
            <li className="dot" aria-hidden="true" />
            <li>
              <strong>{detail.claims.length}</strong> állítás
            </li>
            <li className="dot" aria-hidden="true" />
            <li>
              <strong>{detail.externalRecords.length}</strong> külső rekord
            </li>
            <li className="dot" aria-hidden="true" />
            <li>
              <strong>{detail.redFlags.length}</strong> vörös zászló
            </li>
          </ul>
        </div>
        <aside className="detail-right" aria-label="Pontozás">
          {(() => {
            const dmgRange = damage
              ? fmtDamageRange(damage.totalLowHuf, damage.totalHighHuf)
              : null;
            const corroboratingSources = new Set(
              detail.externalRecords
                .filter((r) => r.relevance === 'corroborates')
                .map((r) => r.sourceSystem),
            ).size;
            const redFlagsFailing = detail.redFlags.filter(
              (r) => r.verdict === 'fail',
            ).length;
            const redFlagsTotal = detail.redFlags.length;
            return (
              <>
                <div className="score-block">
                  <div className="score-label">
                    Becsült kár
                    <span>
                      {dmgRange
                        ? `${dmgRange.primary} ${dmgRange.unit}`
                        : 'n/a'}
                    </span>
                  </div>
                  <div
                    className={`score-value compact${dmgRange ? ' accent' : ''}`}
                  >
                    {dmgRange ? (
                      <>
                        {dmgRange.primary}
                        <small> {dmgRange.unit}</small>
                      </>
                    ) : (
                      '—'
                    )}
                  </div>
                  <div className="score-foot">
                    {dmgRange
                      ? 'DamageEstimate komponensek összege; sapkázva a szerződésértékre.'
                      : 'Külső rekord után automatikusan számolunk.'}
                  </div>
                </div>
                <div className="score-block">
                  <div className="score-label">
                    Független források<span>{corroboratingSources} reg.</span>
                  </div>
                  <div className="score-value compact">
                    {corroboratingSources}
                  </div>
                  <div className="score-foot">
                    Különböző regiszterekből származó, megerősítő (relevance =
                    corroborates) ExternalRecord-ok száma.
                  </div>
                </div>
                <div className="score-block">
                  <div className="score-label">
                    Vörös zászlók
                    <span>
                      {redFlagsTotal > 0
                        ? `${redFlagsFailing} / ${redFlagsTotal}`
                        : 'nincs futtatva'}
                    </span>
                  </div>
                  <div
                    className={`score-value compact${
                      redFlagsFailing > 0 ? ' accent' : ''
                    }`}
                  >
                    {redFlagsTotal > 0 ? redFlagsFailing : '—'}
                  </div>
                  <div className="score-foot">
                    {redFlagsTotal > 0
                      ? `${redFlagsTotal} szabály lefutott, ${redFlagsFailing} fail`
                      : 'Futtasd a vörös zászló ellenőrzést az akciósorról.'}
                  </div>
                </div>
                <div className="score-block">
                  <div className="score-label">
                    Minőségi szint<span>{qualityShort(inv.qualityScore)}</span>
                  </div>
                  <div className="score-value compact">
                    {inv.qualityScore ?? '—'}
                  </div>
                  <div className="score-foot">
                    Legmagasabb látott evidence_grade az evidenciák között.
                  </div>
                </div>
                <div className="score-block">
                  <div className="score-label">
                    Disclosure-szint<span>{tierLabel(tier)}</span>
                  </div>
                  <div className="score-value compact">
                    {inv.disclosureTier}
                  </div>
                  <div className="score-foot">
                    Promotálás <code>journalist</code> / <code>prosecutor</code>{' '}
                    / <code>public</code> szintre csak counsel-jóváhagyással.
                  </div>
                </div>
              </>
            );
          })()}
        </aside>
      </header>

      {banner ? <NextStepBanner banner={banner} /> : null}

      <ActionBar
        investigationId={inv.id}
        updatedAt={inv.updatedAt}
        availableActions={detail.availableActions}
      />

      <section className="panels panels-1col">
        <div className="panel wide">
          <DamagePanel
            estimate={damage}
            claims={detail.claims}
            externalRecords={detail.externalRecords}
          />
        </div>
      </section>

      <section className="panels panels-1col">
        <div className="panel wide">
          <SignalTable
            quantityScore={inv.quantityScore}
            rows={signals}
          />
        </div>
      </section>

      <section className="panels panels-1col">
        <div className="panel wide">
          <PipelinePanel
            investigationId={inv.id}
            initialStates={jobStates}
          />
        </div>
      </section>

      <section className="panels panels-1col">
        <div className="panel wide">
          <InvestigationClaimsPanel
            claims={detail.claims}
            damageComponents={damage?.components ?? []}
          />
        </div>
      </section>

      <section className="panels panels-2col">
        <div className="panel">
          <ExternalRecordsPanel
            records={detail.externalRecords}
            damageComponents={damage?.components ?? []}
          />
        </div>
        <div className="panel">
          <RedFlagsPanel
            redFlags={detail.redFlags}
            signals={signals}
          />
        </div>
      </section>

      <section className="panels panels-2col">
        <div className="panel">
          <section className="investigation-articles">
            <h2 className="panel-title">
              Kapcsolódó cikkek{' '}
              <span className="count">{detail.articles.length}</span>
            </h2>
            <ul className="article-list">
              {detail.articles.map((a) => (
                <li key={`${a.source}:${a.id}`} className="article">
                  <span className="article-src">{a.source}</span>
                  <a href={a.sourceUrl} target="_blank" rel="noreferrer noopener">
                    {a.headline}
                  </a>
                  {a.role !== 'primary' ? (
                    <span className="article-role">{a.role}</span>
                  ) : (
                    <span className="article-role">primary</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
        <div className="panel">
          <BenchmarksPanel
            benchmarks={detail.benchmarks}
            damageComponents={damage?.components ?? []}
          />
        </div>
      </section>

      <section className="panels panels-1col">
        <div className="panel wide">
          <h2 className="audit-title">Audit &amp; előzmények</h2>
          <LeadsPanel leads={detail.leads} />
          <HistoryPanel history={detail.history} />
        </div>
      </section>
    </main>
  );
}
