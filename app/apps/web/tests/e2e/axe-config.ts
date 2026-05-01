import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

/**
 * Shared axe configuration (T057). Every spec wires axe via this helper so
 * the CI gate enforces FR-021 / SC-004 with the same WCAG-AA tagset and the
 * colour-contrast rule enabled.
 */
export function axe(page: Page): AxeBuilder {
  return new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
    .options({
      rules: {
        'color-contrast': { enabled: true },
        region: { enabled: true },
      },
    });
}

type AxeLikeResults = {
  violations: { id: string; impact?: string | null; nodes: unknown[] }[];
};

export function expectNoSerious(results: AxeLikeResults) {
  const blocking = results.violations.filter((v) =>
    v.impact === 'serious' || v.impact === 'critical',
  );
  if (blocking.length === 0) return;
  const summary = blocking
    .map((v) => `${v.id} (${v.impact ?? 'unknown'}, ${v.nodes.length} nodes)`)
    .join('\n  ');
  throw new Error(`Accessibility violations:\n  ${summary}`);
}
