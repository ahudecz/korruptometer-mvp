import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';

import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const HEARTBEAT_MAX_AGE_MS = 10 * 60 * 1000;
const STARTUP_GRACE_MS = 5 * 60 * 1000;

const processStart = Date.now();

/**
 * Liveness gate (T172, FR-074, SC-029):
 *   - DB SELECT 1 must succeed
 *   - WorkerHeartbeat.at must be ≤ 10 min old
 *   - 5-minute startup grace window so deploys don't flap before the
 *     5-minute heartbeat cron has fired
 */
export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    const db = getDb();
    const dbCheck = await db.execute(sql`SELECT 1 AS ok`);
    if (!Array.isArray(dbCheck) || dbCheck.length === 0) {
      return NextResponse.json({ status: 'degraded' }, { status: 503, headers });
    }

    const beat = await db.execute<{ at: Date }>(sql`SELECT at FROM "WorkerHeartbeat" WHERE id = 'singleton'`);
    const row = (beat as unknown as Array<{ at: Date | string }>)[0];
    const beatAt = row?.at ? new Date(row.at) : null;
    const beatAge = beatAt ? Date.now() - beatAt.getTime() : Infinity;
    const inGrace = Date.now() - processStart < STARTUP_GRACE_MS;

    if (!inGrace && beatAge > HEARTBEAT_MAX_AGE_MS) {
      return NextResponse.json(
        { status: 'stale', heartbeatAgeMs: beatAge },
        { status: 503, headers },
      );
    }

    return NextResponse.json(
      { status: 'ok', heartbeatAgeMs: beatAge === Infinity ? null : beatAge },
      { headers },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    return NextResponse.json(
      { status: 'down', error: message },
      { status: 503, headers },
    );
  }
}
