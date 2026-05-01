/**
 * T212 — envelope-size monitor. Captures the size of every emitted
 * sealed-box envelope and surfaces a Sentry breadcrumb when it exceeds
 * 90 % of the configured row-size budget (US 17 edge case "Envelope-size
 * growth").
 *
 * Default row-size budget is 1 MiB — a comfortable cushion for ~30
 * recipients. Override via `SEALED_BOX_ROW_BUDGET_BYTES` env var.
 */

const DEFAULT_BUDGET = 1 * 1024 * 1024;

export function envelopeBudgetBytes(): number {
  const raw = Number(process.env.SEALED_BOX_ROW_BUDGET_BYTES ?? '');
  if (Number.isFinite(raw) && raw > 0) return raw;
  return DEFAULT_BUDGET;
}

export type EnvelopeMonitorReport = {
  sizeBytes: number;
  budgetBytes: number;
  ratio: number;
  warning: boolean;
};

export function monitorEnvelopeSize(envelopeJson: string | object): EnvelopeMonitorReport {
  const json = typeof envelopeJson === 'string' ? envelopeJson : JSON.stringify(envelopeJson);
  const sizeBytes = Buffer.byteLength(json, 'utf8');
  const budgetBytes = envelopeBudgetBytes();
  const ratio = sizeBytes / budgetBytes;
  const warning = ratio > 0.9;
  if (warning && typeof globalThis !== 'undefined') {
    const sentry = (globalThis as { Sentry?: { addBreadcrumb?: (b: unknown) => void } }).Sentry;
    sentry?.addBreadcrumb?.({
      category: 'sealed-box',
      level: 'warning',
      message: `Envelope size ${sizeBytes}B exceeds 90% of budget (${budgetBytes}B)`,
      data: { sizeBytes, budgetBytes, ratio },
    });
  }
  return { sizeBytes, budgetBytes, ratio, warning };
}
