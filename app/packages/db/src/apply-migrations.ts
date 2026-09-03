/**
 * Migrációs futtató — a kézi `psql -f` kiváltása.
 *
 * MIÉRT LÉTEZIK. A 0048–0055 migrációkat kézzel alkalmaztuk, egyenként,
 * `psql "$DIRECT_URL" -f ...` paranccsal. Ez háromszor hibázik:
 *   1. semmi nem jegyzi fel, MI futott le élesen — csak az emlékezet;
 *   2. semmi nem veszi észre, ha egy már lefuttatott fájl utólag megváltozik;
 *   3. csak az tudja alkalmazni, akinek a kezében van az éles kapcsolati
 *      karakterlánc, tehát minden migráció megvárja azt az egy embert.
 *
 * Ez a szkript mindhármat megoldja: van főkönyve, ellenőrzi az ujjlenyomatot,
 * és a titkot EGYSZER kell elhelyezni az `app/.env.migrations.local` fájlban
 * (gitignorált), utána már nem kell hozzá senki.
 *
 * HASZNÁLAT
 *   pnpm --filter @korr/db run migrate                     # próbafutás: mi VÁRAKOZIK, semmi nem fut
 *   pnpm --filter @korr/db run migrate --apply             # tényleges alkalmazás
 *   pnpm --filter @korr/db run migrate --baseline 0055     # a 0055-ig bezárólag MEGTÖRTÉNTNEK jelöl,
 *                                    # végrehajtás nélkül (egyszeri, induláshoz)
 *
 * BIZTONSÁGI KORLÁTOK
 *   - Alapértelmezés a próbafutás. Írni csak `--apply` mellett ír.
 *   - Nem-helyi cél esetén `ALLOW_PROD_WRITE=1` is kell — ugyanaz az elv, mint
 *     a `packages/db/src/guard.ts`-ben, csak itt a cél URL-t vizsgáljuk, nem a
 *     `DATABASE_URL` környezeti változót.
 *   - Minden migráció SAJÁT tranzakcióban fut. Hiba esetén visszagördül, a
 *     futtató megáll, és a hátralévő fájlokhoz hozzá sem nyúl.
 *   - Ha egy már alkalmazott fájl ujjlenyomata megváltozott, megáll. Egy
 *     lefutott migrációt utólag szerkeszteni néma eltérést okoz éles és repó
 *     között; ilyenkor új migrációt kell írni, nem a régit átírni.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import postgres from 'postgres';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(HERE, '..', '..', '..');
const MIGRATIONS_DIR = join(APP_ROOT, 'supabase', 'migrations');
const SECRETS_FILE = join(APP_ROOT, '.env.migrations.local');

const LEDGER = '_applied_migration';

type Args = { apply: boolean; baseline: string | null };

function parseArgs(argv: string[]): Args {
  const apply = argv.includes('--apply');
  const i = argv.indexOf('--baseline');
  const baseline = i >= 0 ? (argv[i + 1] ?? null) : null;
  if (i >= 0 && !baseline) {
    throw new Error('--baseline needs a value, e.g. --baseline 0055');
  }
  return { apply, baseline };
}

/**
 * A célt a `.env.migrations.local` adja, ha van; különben a környezet.
 * Szándékosan KÜLÖN változónév: a `DATABASE_URL` a fejlesztői gépen a helyi
 * homokozóra mutat, és nem akarjuk, hogy egy migráció attól függjön, épp mi
 * van betöltve.
 */
function resolveTarget(): string {
  if (existsSync(SECRETS_FILE)) {
    for (const line of readFileSync(SECRETS_FILE, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 0) continue;
      if (t.slice(0, eq).trim() !== 'MIGRATION_DATABASE_URL') continue;
      const v = t
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, '');
      if (v) return v;
    }
  }
  const fromEnv = process.env.MIGRATION_DATABASE_URL;
  if (fromEnv) return fromEnv;
  throw new Error(
    `No migration target. Put one line in ${SECRETS_FILE}:\n` +
      `  MIGRATION_DATABASE_URL=postgresql://…\n` +
      `Use the DIRECT (non-pooled) connection string — a migration must not go ` +
      `through the transaction pooler.`,
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '(unparseable)';
  }
}

function isLocal(host: string): boolean {
  return /^(127\.0\.0\.1|localhost|\[::1\])(:|$)/.test(host);
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = resolveTarget();
  const host = hostOf(url);
  const local = isLocal(host);

  console.log(`target: ${host}${local ? ' (local)' : ' (REMOTE / LIVE)'}`);
  console.log(`mode:   ${args.apply ? 'APPLY' : 'dry run (nothing is written)'}`);

  if (args.apply && !local && process.env.ALLOW_PROD_WRITE !== '1') {
    throw new Error(
      `Refusing to write to a non-local database (${host}) without ALLOW_PROD_WRITE=1.`,
    );
  }

  const sql = postgres(url, { max: 1, onnotice: () => {} });

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS ${sql(LEDGER)} (
        "filename"  text PRIMARY KEY,
        "sha256"    text NOT NULL,
        "appliedAt" timestamptz NOT NULL DEFAULT now()
      )
    `;

    const rows = await sql<{ filename: string; sha256: string }[]>`
      SELECT "filename", "sha256" FROM ${sql(LEDGER)}
    `;
    const applied = new Map(rows.map((r) => [r.filename, r.sha256]));

    const files = migrationFiles();
    const pending: string[] = [];
    let drift = false;

    for (const f of files) {
      const body = readFileSync(join(MIGRATIONS_DIR, f), 'utf8');
      const digest = sha256(body);
      const known = applied.get(f);
      if (known === undefined) {
        pending.push(f);
      } else if (known !== digest) {
        console.error(`DRIFT  ${f} — applied, but the file has changed since.`);
        drift = true;
      }
    }

    if (drift) {
      throw new Error(
        'A migration that already ran has been edited. Write a NEW migration ' +
          'instead of changing a landed one.',
      );
    }

    if (args.baseline) {
      const upTo = files.filter((f) => f.split('_')[0]! <= args.baseline!);
      const toMark = upTo.filter((f) => !applied.has(f));
      console.log(`baseline: marking ${toMark.length} file(s) as applied WITHOUT running them`);
      for (const f of toMark) console.log(`  mark  ${f}`);
      if (args.apply) {
        for (const f of toMark) {
          const body = readFileSync(join(MIGRATIONS_DIR, f), 'utf8');
          await sql`
            INSERT INTO ${sql(LEDGER)} ("filename", "sha256")
            VALUES (${f}, ${sha256(body)})
            ON CONFLICT ("filename") DO NOTHING
          `;
        }
      }
      return;
    }

    if (pending.length === 0) {
      console.log('nothing pending — the database is up to date.');
      return;
    }

    console.log(`pending: ${pending.length}`);
    for (const f of pending) console.log(`  ${args.apply ? 'apply' : 'would apply'}  ${f}`);

    if (!args.apply) {
      console.log('\ndry run — re-run with --apply to execute.');
      return;
    }

    for (const f of pending) {
      const body = readFileSync(join(MIGRATIONS_DIR, f), 'utf8');
      process.stdout.write(`running ${f} … `);
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`
          INSERT INTO ${tx(LEDGER)} ("filename", "sha256")
          VALUES (${f}, ${sha256(body)})
        `;
      });
      console.log('ok');
    }

    console.log(`\napplied ${pending.length} migration(s).`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(`\n${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
