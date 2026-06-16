import { notFound } from 'next/navigation';

import { PUBLIC_TIER_ENABLED } from '@/lib/env';

export const dynamic = 'force-dynamic';

/**
 * T095 — public-tier case detail. Gated by `PUBLIC_TIER_ENABLED`
 * (FR-032 / FR-033). The promote endpoint creates a `Case` row
 * regardless of the flag, so reviewers can stage public promotions
 * internally; the render path stays off until counsel signs off on
 * `app/docs/public-tier-redaction-policy.md`.
 *
 * Until the flag flips, every request to `/galeria/<id>` returns 404 —
 * no claim text, evidence quote, or party name reaches a public route
 * (SC-009).
 */
export default async function PublicCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!PUBLIC_TIER_ENABLED) {
    notFound();
  }
  const { id } = await params;
  // The actual public-tier render lands behind counsel-approved
  // redaction policy. Until that PR ships, the route just confirms the
  // gate is wired.
  return (
    <main>
      <h1>Public case page (gated stub)</h1>
      <p>id: {id}</p>
    </main>
  );
}
