/**
 * Write-target guard for one-off DB maintenance scripts.
 *
 * Local dev databases are disposable; the live (Supabase Cloud) DB is the
 * single source of truth. A destructive or import script must never hit live
 * by accident just because a prod `DATABASE_URL` happened to be loaded from
 * `.env`. Call `assertWriteTarget()` at the very top of `main()`: it prints the
 * resolved target host and refuses to run against a non-local database unless
 * `ALLOW_PROD_WRITE=1` is explicitly set.
 *
 *   import { assertWriteTarget } from './guard';
 *   async function main() {
 *     assertWriteTarget('delete-duplicates');
 *     ...
 *   }
 */
export function assertWriteTarget(scriptName?: string): void {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  let host = '(unparseable)';
  try {
    host = new URL(url).host;
  } catch {
    /* keep placeholder */
  }
  const isLocal = /^(127\.0\.0\.1|localhost|\[::1\])(:|$)/.test(host);
  const label = scriptName ? `[${scriptName}] ` : '';

  console.log(
    `${label}DB write target: ${host}${isLocal ? ' (local)' : ' (REMOTE / LIVE)'}`,
  );

  if (!isLocal && process.env.ALLOW_PROD_WRITE !== '1') {
    throw new Error(
      `${label}Refusing to run against a non-local database (${host}). ` +
        `This looks like the LIVE DB. If you really intend to write to production, ` +
        `re-run with ALLOW_PROD_WRITE=1.`,
    );
  }
}
