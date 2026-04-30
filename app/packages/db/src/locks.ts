// Single source of truth for Postgres advisory-lock keys used across Inngest functions.
// Adding a new lock here means picking a fresh BigInt that has not been used before.

export const KPI_ROLLUP_LOCK = 8423501n;

// Re-export both shapes — handlers may want the bigint or the int form.
export const KPI_ROLLUP_LOCK_INT = 8423501;
