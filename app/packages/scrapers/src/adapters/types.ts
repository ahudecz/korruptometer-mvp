/**
 * Free-tier external-record adapter contract (research.md §3,
 * contracts/inngest-events.md §Adapter contract).
 *
 * Every adapter under this directory implements the `Adapter` interface
 * and is dispatched from the `investigation.xref` Inngest function. The
 * function takes a per-source-system Postgres advisory lock (FR-016) and
 * the adapter is additionally responsible for the in-process 2-second
 * per-host gate.
 */

export type ExternalSourceSystem =
  | 'TED'
  | 'EKR'
  | 'KE'
  | 'palyazat'
  | 'ecegjegyzek'
  | 'opencorporates'
  | 'integritas'
  | 'olaf'
  | 'ksh'
  | 'eurostat'
  | 'kmonitor'
  | 'atlatszo'
  | 'webarchive';

export type AdapterQuery = {
  /** Investigation primary party name (normalized). */
  primaryPersonName?: string;
  /** Investigation primary entity name (the contractor / authority). */
  primaryEntityName?: string;
  /** Date range from the cluster's claim dates ± window. ISO date string. */
  fromDate?: string;
  toDate?: string;
  /** Adapter-specific extras. */
  extra?: Record<string, unknown>;
};

export type Relevance = 'corroborates' | 'contradicts' | 'context' | 'benchmark';

export type RawExternalRecord = {
  sourceSystem: ExternalSourceSystem;
  externalId: string;
  canonicalUrl: string;
  recordType: string;
  rawPayload: unknown;
  evidenceGrade?: string;
  /**
   * Adapter's best-guess relevance. The reviewer can override post-hoc in
   * the admin UI. Primary-source procurement records (TED, KE, EKR,
   * palyazat) default to `corroborates`; statistics (Eurostat, KSH) default
   * to `benchmark`; press / archive records default to `context`.
   */
  relevance?: Relevance;
};

export type Adapter = {
  sourceSystem: ExternalSourceSystem;
  /** Staleness threshold (FR-015). */
  freshnessDays: number;
  /** Per-host gate ≥ 2000 (FR-016). */
  perHostGateMs: number;
  fetch(query: AdapterQuery): Promise<RawExternalRecord[]>;
};
