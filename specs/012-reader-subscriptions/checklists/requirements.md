# Specification Quality Checklist: Reader subscriptions — public Telegram channel and email digest

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-01
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- **Deliberate deviations from the "no implementation details" default**, all carried from the
  reviewed source plan and all load-bearing:
  - The named-constants table keeps constant identifiers and values. The source plan settled
    them, and several requirements are only testable against a named value
    (`TELEGRAM_CHANNEL_RATE`, `HEALTH_HEARTBEAT_HOURS`).
  - Two channel names are product decisions, not implementation choices: the reader channel is
    a public Telegram channel, and the editor review surface is the existing Telegram bot.
  - Two constants name the email provider (`RESEND_DAILY_LIMIT`, `RESEND_MONTHLY_LIMIT`).
    The provider choice is a settled maintainer decision recorded in assumption A7.
  - FR-089 and FR-093 point at the existing shared honeypot check and the existing shared
    rate-limit factory. Naming them is the point of the requirement: the decision in A11 is
    to reuse the voting flow's proven parts, and a requirement that said "some honeypot" and
    "some limiter" would permit the bespoke second implementation the decision rules out.
    The Dependencies section already carried the same detail about the rate-limit module.
- **`SUBSCRIBE_CONFIRM_DAILY_CAP` is a security bound.** FR-052 now states the blast radius
  alongside the budget framing, because both are true and only the budget half was written.
  A capacity review must not treat that constant as a throughput setting.
- **Preconditions are not requirements.** P2, P3 and P4 are maintainer actions outside the
  repository. They are in their own section and are excluded from the numbered functional
  requirements on purpose. No later stage may emit them as agent tasks.
- **Assumptions A1 to A11 are assertions, not open questions.** They came from three rounds of
  review against the codebase, plus the 2026-09-01 anti-abuse decision recorded in A11. They
  must not be reopened or converted to clarification markers.
- **Withdrawn identifiers are deliberate, and are not defects.** The 2026-09-01 amendment
  removed Cloudflare Turnstile from this feature and put the public tip form out of scope.
  P1, P5, FR-001, FR-002, FR-003, FR-004 and SC-001 are withdrawn in place, with a stated
  reason, and their identifiers are not reused. Every surviving identifier keeps its original
  number. A reviewer who finds a gap in the numbering should read the withdrawal note, not
  renumber the document.
- **The replacement anti-abuse stack is FR-089 and FR-093 to FR-096.** They sit next to the
  subscription requirements rather than in numeric order, matching the document's existing
  practice of grouping by topic.
- **Rollback is deliberately absent** from spec.md. The "Deferred to plan.md" section states
  what stage 2 must carry into `plan.md`.
