/**
 * Wire-format DTOs shared between the admin API routes
 * (apps/web/app/api/admin/investigations/**) and the admin UI
 * (apps/web/app/admin/(authed)/investigations/**).
 *
 * Re-exported from packages/shared/src/index.ts.
 */

export type ArticleSource = 'news' | 'kmonitor';

export type PartyKind = 'person' | 'entity';

export type CorruptionMechanism =
  | 'overpricing'
  | 'no_bid'
  | 'kickback'
  | 'amendment_inflation'
  | 'phantom_service'
  | 'related_party'
  | 'other';

export type AmountBasis = 'stated' | 'computed' | 'estimated';

export type InvestigationStatus = 'new' | 'dismissed' | 'merged';

export type DisclosureTier = 'internal' | 'journalist' | 'prosecutor' | 'public';

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
  | 'webarchive'
  | 'manual_opten'
  | 'manual_other';

export type Relevance = 'corroborates' | 'contradicts' | 'context' | 'benchmark';

export type EvidenceGrade =
  | 'rumor'
  | 'opinion_press'
  | 'opposition_politician'
  | 'investigative_journalism'
  | 'prosecutor_statement'
  | 'audit_report'
  | 'court_document';

export type RedflagSeverity = 'low' | 'medium' | 'high' | 'critical';

export type RedflagVerdict = 'pass' | 'fail' | 'not_applicable';

export type LeadKind =
  | 'hypothesis'
  | 'search_lead'
  | 'reviewer_question'
  | 'escalation'
  | 'cluster_ambiguous';

export type LeadStatus = 'open' | 'tested' | 'resolved' | 'rejected';

export type LeadActorKind = 'agent' | 'reviewer' | 'system';

export type HypothesisCapKind = 'tool_calls' | 'tokens' | 'wall_clock';

export type AvailableAction =
  | 'run_xref'
  | 'run_redflags'
  | 'run_hypothesis_loop'
  | 'escalate_paid_lookup'
  | 'write_paid_result'
  | 'promote_journalist'
  | 'promote_prosecutor'
  | 'promote_public'
  | 'depromote_public'
  | 'dismiss'
  | 'merge_into'
  | 'edit_summary';

export const EVIDENCE_GRADE_ORDER: EvidenceGrade[] = [
  'rumor',
  'opinion_press',
  'opposition_politician',
  'investigative_journalism',
  'prosecutor_statement',
  'audit_report',
  'court_document',
];

export type Party = {
  kind: PartyKind;
  name: string;
  normalizedName: string;
  role: string;
};

export type InvestigationListItem = {
  id: string;
  status: InvestigationStatus;
  primaryPersonName: string | null;
  primaryEntityName: string | null;
  articleCount: number;
  /** Numeric as string to match `bigint`-rendered-as-string convention. */
  quantityScore: string;
  qualityScore: EvidenceGrade | null;
  disclosureTier: DisclosureTier;
  publicCaseId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ArticleClaimDto = {
  id: string;
  articleSource: ArticleSource;
  articleId: string;
  claimOrdinal: number;
  extractorVersion: string;
  mechanism: CorruptionMechanism;
  /** HUF bigint serialized as a numeric string, or null. */
  allegedAmountHuf: string | null;
  amountBasis: AmountBasis | null;
  parties: Party[];
  evidenceQuote: string;
  sourceUrl: string;
  paragraphLocator: string;
  confidence: number;
  createdAt: string;
};

export type ExternalRecordDto = {
  id: string;
  sourceSystem: ExternalSourceSystem;
  externalId: string;
  canonicalUrl: string;
  fetchedAt: string;
  fetchHash: string;
  recordType: string;
  relevance: Relevance | null;
  evidenceGrade: EvidenceGrade | null;
  /** The unmodified normalized adapter response. Shape is adapter-specific. */
  rawPayload: unknown;
};

export type RedFlagDto = {
  ruleId: string;
  severity: RedflagSeverity;
  verdict: RedflagVerdict;
  observationHu: string;
  supportingRecordIds: string[];
  evaluatedAt: string;
};

export type InvestigationLeadDto = {
  id: string;
  kind: LeadKind;
  status: LeadStatus;
  question: string;
  finding: string | null;
  createdBy: LeadActorKind;
  capFired: HypothesisCapKind | null;
  createdAt: string;
  resolvedAt: string | null;
};

export type BenchmarkDto = {
  cohortHash: string;
  dimension: string;
  /** HUF (or other unit) value the investigation contributes. */
  investigationValue: string | null;
  p10: string;
  p50: string;
  p90: string;
  n: number;
  computedAt: string;
  isOutlier: boolean;
};

export type InvestigationArticleDto = {
  source: ArticleSource;
  id: string;
  headline: string;
  sourceUrl: string;
  role: string;
};

export type InvestigationDetail = {
  investigation: InvestigationListItem & {
    summary: string | null;
    mergedIntoId: string | null;
  };
  articles: InvestigationArticleDto[];
  claims: ArticleClaimDto[];
  externalRecords: ExternalRecordDto[];
  redFlags: RedFlagDto[];
  leads: InvestigationLeadDto[];
  benchmarks: BenchmarkDto[];
  history: {
    publicCases: Array<{
      id: string;
      promotedAt: string;
      depromotedAt: string | null;
    }>;
  };
  availableActions: AvailableAction[];
};

export type ExtractionRunDto = {
  extractorVersion: string;
  isCurrent: boolean;
  extractedAt: string;
  claimCount: number;
  model: string;
  claims: ArticleClaimDto[];
};

export type ArticleClaimsBundle = {
  article: {
    source: ArticleSource;
    id: string;
    headline: string;
    sourceUrl: string;
  };
  extractionRuns: ExtractionRunDto[];
};

export type LlmUsageRow = {
  day: string;
  model: string;
  inputTokens: string;
  outputTokens: string;
  estimatedHufSpend: string;
  callCount: number;
};

export type LlmUsageView = {
  ceilingHuf: string;
  rows: LlmUsageRow[];
  extractionPaused: boolean;
};

export type ErrorEnvelope = {
  error: string;
  detail?: string | Record<string, unknown> | null;
};

// ─── Addendum 2026-05-19: Damage→Evidence Spine ─────────────────────────────
// See specs/002-investigation-engine/spec.md §"Addendum 2026-05-19".

export type DamageConfidence = 'low' | 'medium' | 'high';

export type DamageMethod =
  | 'benchmark_deviation'
  | 'claim_consolidation'
  | 'amendment_delta'
  | 'industry_estimate';

export type SignalSourceKind =
  | 'external_record'
  | 'red_flag'
  | 'claim_corroboration'
  | 'benchmark_deviation';

export type JobKind =
  | 'xref'
  | 'redflags'
  | 'hypothesis_loop'
  | 'benchmarks'
  | 'damage_recompute';

export type JobState = 'idle' | 'running' | 'done' | 'failed';

export type DamageCitation = {
  studyId: string;
  sourceUrl: string;
  /** ISO date string (YYYY-MM-DD) of the last verification. */
  lastVerifiedAt: string;
};

export type DamageComponentDto = {
  mechanism: CorruptionMechanism;
  /** Bigint serialized as a numeric string. */
  lowHuf: string;
  highHuf: string;
  method: DamageMethod;
  inputs: {
    claimIds?: string[];
    externalRecordIds?: string[];
    benchmarkCohortHash?: string;
    /** Hungarian, human-readable. Mandatory. */
    formula: string;
    citation?: DamageCitation;
  };
  /** Hungarian, ≤ 200 chars. Empty string allowed. */
  notes: string;
};

export type DamageEstimateDto = {
  investigationId: string;
  /** Σ components[*].lowHuf as a bigint-serialized string. */
  totalLowHuf: string;
  totalHighHuf: string;
  confidence: DamageConfidence;
  components: DamageComponentDto[];
  /** sha256 hex of the canonicalized input-id JSON. */
  inputsHash: string;
  computedAt: string;
};

export type SignalContributionDto = {
  id: string;
  sourceKind: SignalSourceKind;
  sourceId: string;
  /** Numeric-as-string convention. */
  baseWeight: string;
  stalenessMultiplier: string;
  effectiveWeight: string;
  addedAt: string;
};

export type SignalContributionsView = {
  /** Headline `Investigation.quantityScore`, for the invariant SUM check. */
  quantityScore: string;
  rows: SignalContributionDto[];
};

export type InvestigationJobStateDto = {
  jobKind: JobKind;
  state: JobState;
  startedAt: string | null;
  finishedAt: string | null;
  inngestRunId: string | null;
  /** Hungarian one-liner; non-null on `done`. */
  summary: string | null;
  /** Hungarian, pre-translated through tError(); non-null on `failed`. */
  errorMessage: string | null;
  updatedAt: string;
};

export type NextStepBannerKind =
  | 'job_failed'
  | 'stale_external_record'
  | 'missing_xref'
  | 'missing_redflags'
  | 'predicate_newly_passes';

export type NextStepBannerDto = {
  kind: NextStepBannerKind;
  /** Hungarian, single line. */
  messageHu: string;
  /** Action route to fire (e.g., `/api/admin/investigations/:id/xref`). */
  actionHref?: string;
  /** Hungarian button label. */
  actionLabelHu?: string;
};

/**
 * Frozen registry contract: every value in the i18n-errors registry is a
 * Hungarian phrase. Keys are internal codes; the catch-all key is `*`.
 */
export type ErrorTranslator = (code: string) => string;
