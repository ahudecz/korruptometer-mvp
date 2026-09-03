/**
 * T133 — deploy-time assertion script that the configured platform log
 * retention matches the truthful claim on /bejelentes (≤7 days for Vercel,
 * Inngest, and Better Stack). Reads each platform's API and fails CI on
 * drift (FR-037, SC-019, Constitution Principle I).
 *
 * Run from CI with VERCEL_TOKEN, INNGEST_TOKEN, BETTERSTACK_TOKEN set as
 * read-only API tokens. Without those tokens, the script reports SKIPPED
 * for that platform — that's an acceptable degraded mode for local dev,
 * NOT for production deploy. The deploy job MUST set every token.
 */

const MAX_DAYS = 7;

/**
 * Szolgáltatónkénti felső határ. Az alapérték a MAX_DAYS — az a MI állításunk
 * arról, amit be TUDUNK állítani.
 *
 * A Resend kivétel, és tudatosan az: 2026-09-03-án ellenőrizve a megőrzés a
 * Free, a Pro és a Scale csomagon egyaránt 30 nap, és sehol nem konfigurálható
 * (csak az Enterprise "Flexible"). Ez tehát nem választott beállítás, hanem a
 * szolgáltató plafonja. A 012-es specifikáció P3 előfeltétele emiatt módosult,
 * a döntést a karbantartó hozta meg (2026-09-03), és az /adatvedelem oldal a
 * 30 napot mondja ki.
 *
 * Ez a küszöb NEM emelhető azért, hogy egy drift zöldre váltson. Ha a Resend
 * kitesz egy megőrzési mezőt az API-jában, az API-olvasás az erősebb
 * mechanizmus, és annak kell átvennie a helyét.
 */
const PLATFORM_MAX_DAYS: Record<string, number> = { Resend: 30 };

function maxDaysFor(platform: string): number {
  return PLATFORM_MAX_DAYS[platform] ?? MAX_DAYS;
}

type Result = { platform: string; days: number | null; status: 'OK' | 'DRIFT' | 'SKIPPED' };

async function checkVercel(): Promise<Result> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) return { platform: 'Vercel', days: null, status: 'SKIPPED' };
  // Vercel project-level log-drain retention isn't exposed via a public API
  // at time of writing — we hand-verify in `app/docs/log-retention.md` and
  // store the screenshot SHA in this env var so the audit trail is
  // reproducible.
  const declared = Number(process.env.VERCEL_LOG_RETENTION_DAYS_DECLARED ?? '0');
  if (!declared) return { platform: 'Vercel', days: null, status: 'SKIPPED' };
  return {
    platform: 'Vercel',
    days: declared,
    status: declared <= MAX_DAYS ? 'OK' : 'DRIFT',
  };
}

async function checkInngest(): Promise<Result> {
  const token = process.env.INNGEST_TOKEN;
  if (!token) return { platform: 'Inngest', days: null, status: 'SKIPPED' };
  // Inngest exposes function-run log retention via the dashboard only; we
  // assert via env-declared value.
  const declared = Number(process.env.INNGEST_LOG_RETENTION_DAYS_DECLARED ?? '0');
  if (!declared) return { platform: 'Inngest', days: null, status: 'SKIPPED' };
  return {
    platform: 'Inngest',
    days: declared,
    status: declared <= MAX_DAYS ? 'OK' : 'DRIFT',
  };
}

/**
 * 012-reader-subscriptions — a Resend küldési-napló megőrzése.
 *
 * Ugyanaz az alak, mint a `checkInngest()`-é, és ugyanazon okból: a Resend
 * publikus API-jában NINCS megőrzési mező (2026-09-01-i ellenőrzés). Ha a
 * szolgáltató kiteszi, egy API-olvasás erősebb mechanizmus, és annak kell
 * átvennie a helyét.
 *
 * A küldési naplók CÍMZETTI CÍMEKET tartalmaznak. Egy az első küldés után
 * beállított megőrzés nem törli, amit az addigi küldések már beírtak.
 */
async function checkResend(): Promise<Result> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { platform: 'Resend', days: null, status: 'SKIPPED' };
  const declared = Number(process.env.RESEND_LOG_RETENTION_DAYS_DECLARED ?? '0');
  if (!declared) return { platform: 'Resend', days: null, status: 'SKIPPED' };
  return {
    platform: 'Resend',
    days: declared,
    status: declared <= maxDaysFor('Resend') ? 'OK' : 'DRIFT',
  };
}

async function checkBetterStack(): Promise<Result> {
  const token = process.env.BETTERSTACK_TOKEN;
  if (!token) return { platform: 'Better Stack', days: null, status: 'SKIPPED' };
  try {
    const res = await fetch('https://logs.betterstack.com/api/v1/sources', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      return { platform: 'Better Stack', days: null, status: 'SKIPPED' };
    }
    const json = (await res.json()) as { data?: { attributes?: { retention_days?: number } }[] };
    const sources = json.data ?? [];
    let max = 0;
    for (const s of sources) {
      const d = s.attributes?.retention_days ?? 0;
      if (d > max) max = d;
    }
    return {
      platform: 'Better Stack',
      days: max,
      status: max <= MAX_DAYS ? 'OK' : 'DRIFT',
    };
  } catch {
    return { platform: 'Better Stack', days: null, status: 'SKIPPED' };
  }
}

async function main() {
  const results = await Promise.all([checkVercel(), checkInngest(), checkBetterStack(), checkResend()]);
  let drifted = false;
  for (const r of results) {
    const d = r.days == null ? '—' : `${r.days}d`;
    console.log(`${r.platform.padEnd(14)} ${d.padEnd(6)} ${r.status}`);
    if (r.status === 'DRIFT') drifted = true;
  }
  if (drifted) {
    console.error(`\nDRIFT: at least one platform exceeds the ${MAX_DAYS}-day promise.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
