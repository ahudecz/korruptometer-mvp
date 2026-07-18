import { NextResponse } from 'next/server';
import { sql as rawSql } from 'drizzle-orm';
import { getDb } from '@/lib/db';

/**
 * One-off migration runner for 0044_news_breaking_pinned.sql — deployed
 * because the sandbox's direct Postgres connection to the Supabase pooler
 * was intermittently failing (ECONNRESET) on 2026-07-18, so `drizzle-kit
 * migrate` couldn't run from there. This route lets Vercel's own (working)
 * DB connection apply the DDL instead. Delete this route once the migration
 * has been confirmed applied — it's single-purpose, not a general migration
 * runner.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const secret = process.env.INTERNAL_MIGRATE_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'not configured' }, { status: 503 });
  }
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 403 });
  }

  const db = getDb();
  try {
    await db.execute(rawSql`ALTER TABLE "NewsArticle" ADD COLUMN IF NOT EXISTS "breakingPinnedUntil" timestamptz`);
    await db.execute(rawSql`CREATE INDEX IF NOT EXISTS "NewsArticle_breakingPinnedUntil_idx" ON "NewsArticle" ("breakingPinnedUntil")`);
    return NextResponse.json({ ok: true, migration: '0044_news_breaking_pinned' });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
