import 'server-only';

import type {
  EvidenceGrade,
  ExternalRecordDto,
  RedFlagDto,
  RedflagSeverity,
  RedflagVerdict,
} from '@korr/shared';

/**
 * Declarative red-flag rule engine (FR-019 / FR-020, T067).
 *
 * Every rule returns one verdict per investigation with a mandatory
 * Hungarian observation string. Rules never emit a numeric "score";
 * the scoring engine (Slice I) consumes these verdicts.
 *
 * Input shape: the engine receives the cached ExternalRecord rows and
 * the per-cluster Benchmark deviations; it never makes a live call.
 */
export type RuleInput = {
  investigationId: string;
  records: ExternalRecordDto[];
  /** Computed benchmark deviations for this investigation, if any. */
  benchmarkDeviations: Array<{
    dimension: string;
    investigationValue: number | null;
    p90: number;
    p10: number;
  }>;
  /**
   * Optional cluster facts (party founded date, related-party hints, etc.)
   * surfaced from the ExternalRecord rawPayload. We accept a small
   * normalized blob so rules don't have to re-parse the same payload.
   */
  clusterFacts: {
    earliestContractDate: Date | null;
    contractorFoundedAt: Date | null;
    relatedPartyHints: string[];
    singleSourceDominanceShare: number | null;
  };
};

export type Rule = {
  ruleId: string;
  severity: RedflagSeverity;
  /** Evaluate the rule. Returns `null` to signal "not_applicable" with no observation. */
  evaluate(input: RuleInput): RuleOutput;
};

export type RuleOutput = {
  verdict: RedflagVerdict;
  observationHu: string;
  supportingRecordIds: string[];
};

function isContractNotice(r: ExternalRecordDto): boolean {
  return r.recordType === 'contract_notice';
}

function readBidCount(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  const candidates = ['bidCount', 'bidsCount', 'numberOfBids', 'bidders'];
  for (const k of candidates) {
    const v = p[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && /^\d+$/.test(v)) return Number.parseInt(v, 10);
  }
  return null;
}

function readAmendmentInflation(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.amendmentPctIncrease === 'number') return p.amendmentPctIncrease;
  if (
    typeof p.originalAmount === 'number'
    && typeof p.finalAmount === 'number'
    && p.originalAmount > 0
  ) {
    return ((p.finalAmount - p.originalAmount) / p.originalAmount) * 100;
  }
  return null;
}

const ruleSingleBidder: Rule = {
  ruleId: 'single_bidder',
  severity: 'high',
  evaluate({ records }) {
    const notices = records.filter(isContractNotice);
    if (notices.length === 0) {
      return {
        verdict: 'not_applicable',
        observationHu: 'Nincs közbeszerzési hirdetmény, ezért a versenyzői számot nem tudjuk értékelni.',
        supportingRecordIds: [],
      };
    }
    const singles = notices.filter((n) => readBidCount(n.rawPayload) === 1);
    if (singles.length === 0) {
      return {
        verdict: 'pass',
        observationHu: 'A közbeszerzési hirdetményeken nem találunk egy ajánlattevős eljárást.',
        supportingRecordIds: notices.map((n) => n.id),
      };
    }
    return {
      verdict: 'fail',
      observationHu:
        `${singles.length} közbeszerzési hirdetmény egyetlen ajánlattevőt rögzít — `
        + 'versenyhiányos eljárás (single-bidder).',
      supportingRecordIds: singles.map((n) => n.id),
    };
  },
};

const ruleAmendmentInflation: Rule = {
  ruleId: 'amendment_inflation_gt_20',
  severity: 'medium',
  evaluate({ records }) {
    const notices = records.filter(isContractNotice);
    if (notices.length === 0) {
      return {
        verdict: 'not_applicable',
        observationHu: 'Nincs hirdetmény-adat a szerződésmódosítás értékeléséhez.',
        supportingRecordIds: [],
      };
    }
    const inflated = notices.filter((n) => {
      const v = readAmendmentInflation(n.rawPayload);
      return typeof v === 'number' && v > 20;
    });
    if (inflated.length === 0) {
      return {
        verdict: 'pass',
        observationHu: 'A vizsgált szerződéseken nincs 20 %-ot meghaladó szerződésmódosítás.',
        supportingRecordIds: notices.map((n) => n.id),
      };
    }
    return {
      verdict: 'fail',
      observationHu:
        `${inflated.length} szerződésnél a módosítás 20 %-ot meghaladó áremelkedést hozott.`,
      supportingRecordIds: inflated.map((n) => n.id),
    };
  },
};

const ruleRelatedParty: Rule = {
  ruleId: 'related_party',
  severity: 'high',
  evaluate({ clusterFacts, records }) {
    if (clusterFacts.relatedPartyHints.length === 0) {
      return {
        verdict: 'not_applicable',
        observationHu:
          'Nincs jelzés közeli érdekeltségre az aktuális külső rekordokban.',
        supportingRecordIds: [],
      };
    }
    return {
      verdict: 'fail',
      observationHu:
        `Közeli érdekeltség gyanúja: ${clusterFacts.relatedPartyHints.join('; ')}.`,
      supportingRecordIds: records.map((r) => r.id),
    };
  },
};

const ruleNewContractor: Rule = {
  ruleId: 'contractor_founded_lt_6m_before_contract',
  severity: 'medium',
  evaluate({ clusterFacts, records }) {
    const earliest = clusterFacts.earliestContractDate;
    const founded = clusterFacts.contractorFoundedAt;
    if (!earliest || !founded) {
      return {
        verdict: 'not_applicable',
        observationHu:
          'Hiányzó alapítás/szerződéskötés dátum — a kritérium nem értékelhető.',
        supportingRecordIds: [],
      };
    }
    const sixMonthsMs = 1000 * 60 * 60 * 24 * 30 * 6;
    if (earliest.getTime() - founded.getTime() < sixMonthsMs) {
      return {
        verdict: 'fail',
        observationHu:
          'A nyertes vállalkozó a szerződéskötés előtti hat hónapban alakult.',
        supportingRecordIds: records.filter(isContractNotice).map((r) => r.id),
      };
    }
    return {
      verdict: 'pass',
      observationHu:
        'A nyertes vállalkozó a szerződés előtt legalább hat hónappal alakult.',
      supportingRecordIds: [],
    };
  },
};

const ruleSingleSourceDominance: Rule = {
  ruleId: 'single_source_dominance',
  severity: 'medium',
  evaluate({ clusterFacts, records }) {
    const share = clusterFacts.singleSourceDominanceShare;
    if (share == null) {
      return {
        verdict: 'not_applicable',
        observationHu: 'Forrás-eloszlás nem értékelhető — nincs elég hirdetmény.',
        supportingRecordIds: [],
      };
    }
    if (share >= 0.7) {
      return {
        verdict: 'fail',
        observationHu:
          `Az ügyhöz kapcsolódó szerződések ${Math.round(share * 100)} %-át egyetlen ajánlatkérő adta — koncentrált forrás.`,
        supportingRecordIds: records.map((r) => r.id),
      };
    }
    return {
      verdict: 'pass',
      observationHu: 'Nincs domináns egyetlen ajánlatkérő az ügyben.',
      supportingRecordIds: [],
    };
  },
};

const ruleBenchmarkDeviation: Rule = {
  ruleId: 'benchmark_p90_exceeded',
  severity: 'medium',
  evaluate({ benchmarkDeviations, records }) {
    if (!benchmarkDeviations || benchmarkDeviations.length === 0) {
      return {
        verdict: 'not_applicable',
        observationHu: 'Nincs benchmark-kohort az ügyhöz.',
        supportingRecordIds: [],
      };
    }
    const breached = benchmarkDeviations.filter(
      (d) => d.investigationValue != null && d.investigationValue > d.p90,
    );
    if (breached.length === 0) {
      return {
        verdict: 'pass',
        observationHu:
          'A vizsgált értékek nem lépik túl a vonatkozó kohort p90 értékét.',
        supportingRecordIds: [],
      };
    }
    return {
      verdict: 'fail',
      observationHu:
        `Az érték a következő kohorto(ka)n meghaladja a p90-et: ${breached
          .map((d) => d.dimension)
          .join(', ')}.`,
      supportingRecordIds: records.filter((r) => r.relevance === 'benchmark').map((r) => r.id),
    };
  },
};

export const RULES: Rule[] = [
  ruleSingleBidder,
  ruleAmendmentInflation,
  ruleRelatedParty,
  ruleNewContractor,
  ruleSingleSourceDominance,
  ruleBenchmarkDeviation,
];

export function evaluateAll(input: RuleInput): Array<RedFlagDto> {
  return RULES.map((r) => {
    const out = r.evaluate(input);
    return {
      ruleId: r.ruleId,
      severity: r.severity,
      verdict: out.verdict,
      observationHu: out.observationHu,
      supportingRecordIds: out.supportingRecordIds,
      evaluatedAt: new Date().toISOString(),
    };
  });
}

export function gradeWeight(g: EvidenceGrade | null): number {
  if (!g) return 0;
  const ordered: EvidenceGrade[] = [
    'rumor',
    'opinion_press',
    'opposition_politician',
    'investigative_journalism',
    'prosecutor_statement',
    'audit_report',
    'court_document',
  ];
  return ordered.indexOf(g);
}
