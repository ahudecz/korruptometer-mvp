// Single source of truth for Postgres advisory-lock keys used across Inngest functions.
// Adding a new lock here means picking a fresh BigInt that has not been used before.

export const KPI_ROLLUP_LOCK = 8423501n;

// Re-export both shapes — handlers may want the bigint or the int form.
export const KPI_ROLLUP_LOCK_INT = 8423501;

// 012-reader-subscriptions FR-049 — a draft → send átmenetet ez a zár burkolja,
// hogy egy összefoglalóhoz egyszerre csak egy küldő fusson.
export const SUBSCRIPTION_DIGEST_LOCK = 8423502n;
export const SUBSCRIPTION_DIGEST_LOCK_INT = 8423502;
