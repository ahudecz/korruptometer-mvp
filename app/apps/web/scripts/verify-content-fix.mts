/**
 * Post-fix verification: after correcting a piece of content (wrong name,
 * wrong description, etc.) in the DB, checks every public page that could
 * be showing the OLD (wrong) text whether it still does, and whether the
 * NEW (corrected) text has actually landed.
 *
 * Written 2026-08-02 after a real incident: a MediaClosure row's `name`
 * was fixed directly via the Supabase REST API (bypassing the app's normal
 * admin/review approve flow), so the homepage's `unstable_cache`-backed
 * "legfrissebb megszűnések" section (getCachedLatestClosures in page.tsx,
 * revalidate: 300) kept serving the stale, wrong name for a while — the DB
 * was right, the site wasn't. This script exists so that claim is always
 * checked, not assumed.
 *
 * Usage:
 *   npx tsx scripts/verify-content-fix.mts \
 *     --old "Mandiner" --new "Mathias Corvinus Collegium Alapítvány" \
 *     [--base https://www.kegyencjarat.hu] \
 *     [--urls /,/megszunt,/lemondasok,/birosagi-iteletek,/adatbazis]
 *
 * On Windows Git Bash, MSYS mangles a bare "/" or "/foo" argument into a
 * filesystem path (e.g. "C:/Program Files/Git/") before Node ever sees it —
 * prefix the command with `MSYS_NO_PATHCONV=1` when passing --urls there.
 *
 * Exits non-zero if any checked page still contains --old, or if NONE of
 * the checked pages contain --new (the fix might not have landed anywhere
 * publicly visible, which is itself worth flagging).
 */

const DEFAULT_URLS = ['/', '/megszunt', '/lemondasok', '/birosagi-iteletek', '/hirek'];

function parseArgs(argv: string[]) {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a?.startsWith('--')) {
      out[a.slice(2)] = argv[i + 1] ?? '';
      i++;
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const oldText = args.old;
  const newText = args.new;
  const base = args.base ?? 'https://www.kegyencjarat.hu';
  const urls = (args.urls ?? DEFAULT_URLS.join(',')).split(',').map((u) => u.trim()).filter(Boolean);

  if (!oldText || !newText) {
    console.error('Usage: verify-content-fix.mts --old "<wrong text>" --new "<corrected text>" [--base URL] [--urls /,/megszunt,...]');
    process.exit(2);
  }

  console.log(`Ellenőrzés: "${oldText}" -> "${newText}"\n${urls.length} oldal, alap URL: ${base}\n`);

  let stillWrongSomewhere = false;
  let fixedSomewhere = false;

  for (const path of urls) {
    const url = `${base}${path}`;
    let html: string;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'verify-content-fix-script' } });
      html = await res.text();
    } catch (err) {
      console.log(`  ? ${path} — lekérés sikertelen (${(err as Error).message})`);
      continue;
    }

    const hasOld = html.includes(oldText);
    const hasNew = html.includes(newText);

    if (hasOld) {
      stillWrongSomewhere = true;
      console.log(`  ✗ ${path} — MÉG MINDIG a régi szöveget mutatja`);
    } else if (hasNew) {
      fixedSomewhere = true;
      console.log(`  ✓ ${path} — a javított szöveg látszik`);
    } else {
      console.log(`  · ${path} — se a régi, se az új szöveg nem szerepel itt (valószínűleg nem is jelenik meg ezen az oldalon)`);
    }
  }

  console.log('');
  if (stillWrongSomewhere) {
    console.log('EREDMÉNY: a javítás NEM ért el mindenhová — van legalább egy oldal, ahol a régi, hibás szöveg még mindig látszik (cache? másik adatforrás?).');
    process.exit(1);
  }
  if (!fixedSomewhere) {
    console.log('EREDMÉNY: a javított szöveg SEHOL nem jelent meg a vizsgált oldalakon — érdemes ellenőrizni, hogy valóban itt kellene-e megjelennie.');
    process.exit(1);
  }
  console.log('EREDMÉNY: rendben — a régi szöveg sehol, az új szöveg legalább egy helyen megjelenik.');
}

main();
