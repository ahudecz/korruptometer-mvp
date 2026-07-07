#!/usr/bin/env bash
#
# db-sync-from-live.sh — make the LOCAL Supabase `public` schema an exact copy
# of PRODUCTION.
#
# Live (Supabase Cloud) is the single source of truth; local `npx supabase
# start` databases are disposable mirrors. This script READS from live and
# writes ONLY to local: it snapshots the current local DB, drops & recreates the
# local `public` schema, and restores it from a fresh live dump. Supabase system
# schemas (auth/storage/…) are left untouched.
#
# Usage (from anywhere in the repo):
#   ./app/scripts/db-sync-from-live.sh
#
# Live connection is taken from $LIVE_DB_URL, or parsed from DIRECT_URL in
# app/apps/web/.env.vercel.production. Local connection is taken from
# $LOCAL_DB_URL, or `supabase status`, or the project default.
#
# Safety: refuses to run unless the target is localhost AND the source is
# remote, so it can never overwrite production.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROD_ENV="$APP_DIR/apps/web/.env.vercel.production"

log() { printf '\033[1;34m[db-sync]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[db-sync] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

host_of() { # extract host:port from a postgres URL
  printf '%s' "$1" | sed -E 's#^[a-z]+://[^@]*@##; s#/.*$##'
}
is_local_host() { [[ "$1" =~ ^(127\.0\.0\.1|localhost|\[::1\]) ]]; }

# --- resolve LIVE connection -------------------------------------------------
if [[ -z "${LIVE_DB_URL:-}" ]]; then
  [[ -f "$PROD_ENV" ]] || die "no \$LIVE_DB_URL and $PROD_ENV not found"
  LIVE_DB_URL="$(grep -E '^DIRECT_URL=' "$PROD_ENV" | head -1 \
    | sed -E 's/^DIRECT_URL=//; s/^"//; s/\\n"$//; s/"$//')"
fi
[[ -n "${LIVE_DB_URL:-}" ]] || die "could not resolve a live DB URL"

# --- resolve LOCAL connection ------------------------------------------------
if [[ -z "${LOCAL_DB_URL:-}" ]]; then
  LOCAL_DB_URL="$( (cd "$APP_DIR" && npx --no-install supabase status 2>/dev/null) \
    | grep -iE 'DB URL' | grep -oE 'postgres[^ ]+' | head -1 || true)"
fi
LOCAL_DB_URL="${LOCAL_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54422/postgres}"

# --- safety gates ------------------------------------------------------------
LIVE_HOST="$(host_of "$LIVE_DB_URL")"
LOCAL_HOST="$(host_of "$LOCAL_DB_URL")"
is_local_host "$LOCAL_HOST" || die "target ($LOCAL_HOST) is not local — refusing to overwrite it"
if is_local_host "$LIVE_HOST"; then die "source ($LIVE_HOST) is local, not production — nothing to sync from"; fi

# pg_dump must match the server major version (Supabase is PG17); the host
# pg_dump is often older, so run it inside the local db container.
CONTAINER="$(docker ps --format '{{.Names}}' | grep -E '^supabase_db_' | head -1 || true)"
[[ -n "$CONTAINER" ]] || die "no running supabase_db_* container found (is 'supabase start' up?)"

log "LIVE  source : $LIVE_HOST (read-only)"
log "LOCAL target : $LOCAL_HOST (will be REPLACED)"
log "container    : $CONTAINER"

# --- snapshot local before touching it --------------------------------------
BACKUP_DIR="${TMPDIR:-/tmp}/korr-db-sync"
mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$BACKUP_DIR/local-public-$STAMP.sql.gz"
log "snapshotting local → $BACKUP"
docker exec "$CONTAINER" pg_dump -U postgres --schema=public --no-owner postgres | gzip > "$BACKUP"

# --- fresh dump of live public schema ---------------------------------------
DUMP="$BACKUP_DIR/live-public-$STAMP.sql"
log "dumping live public schema …"
docker exec "$CONTAINER" pg_dump --schema=public --no-owner "$LIVE_DB_URL" > "$DUMP"
log "dump: $(wc -l < "$DUMP") lines"

# --- reset local public schema ----------------------------------------------
log "resetting local public schema (drop + recreate + extensions) …"
psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT USAGE, CREATE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres, service_role;
-- Extensions live in `public` and are referenced by index/opclass definitions
-- (e.g. gist_trgm_ops), but a single-schema dump does not recreate them.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;
SQL

# --- restore ----------------------------------------------------------------
log "restoring live dump into local …"
RESTORE_LOG="$BACKUP_DIR/restore-$STAMP.log"
psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=0 -f "$DUMP" > "$RESTORE_LOG" 2>&1 || true
# Ignore two benign, expected errors: ALTER DEFAULT PRIVILEGES owned by
# supabase_admin (not alterable locally) and the redundant CREATE SCHEMA public.
BAD="$(grep -iE 'ERROR' "$RESTORE_LOG" \
  | grep -viE 'permission denied to change default privileges|schema "public" already exists' || true)"
if [[ -n "$BAD" ]]; then
  echo "$BAD" | head -20 >&2
  die "restore produced unexpected errors (see $RESTORE_LOG)"
fi

# --- verify parity ----------------------------------------------------------
log "verifying table-count parity …"
MISMATCH=0
while read -r t; do
  [[ -z "$t" ]] && continue
  L="$(psql "$LOCAL_DB_URL" -tAc "select count(*) from \"$t\"")"
  V="$(psql "$LIVE_DB_URL"  -tAc "select count(*) from \"$t\"")"
  if [[ "$L" != "$V" ]]; then
    printf '  MISMATCH %-28s local=%s live=%s\n' "$t" "$L" "$V"
    MISMATCH=$((MISMATCH + 1))
  fi
done < <(psql "$LIVE_DB_URL" -tAc "select tablename from pg_tables where schemaname='public' order by 1")

if [[ "$MISMATCH" -ne 0 ]]; then
  die "$MISMATCH table(s) differ after sync — local snapshot preserved at $BACKUP"
fi

log "✅ local public schema is now identical to live. Backup: $BACKUP"
