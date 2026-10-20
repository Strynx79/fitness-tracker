#!/usr/bin/env bash
#
# db-backup.sh — dump the local fitness_os database to a timestamped, gzipped
# SQL file under backups/ (gitignored).
#
# Usage:
#   npm run db:backup          # or: bash scripts/db-backup.sh
#
# Output:
#   backups/fitness-os-YYYYmmdd-HHMMSS.sql.gz
#
# Restore (documented one-liner — this REPLACES the data in the target database,
# because the dump is taken with `--clean --if-exists`):
#   gunzip -c backups/fitness-os-YYYYmmdd-HHMMSS.sql.gz \
#     | docker exec -i fitness-os-postgres psql -v ON_ERROR_STOP=1 -U fitness -d fitness_os
#
# The dump is plain SQL, so it stays human-inspectable and psql-restorable. The
# `--clean --if-exists` options emit DROP statements first, which is what lets
# the same dump be applied twice / over a populated database.
# `-v ON_ERROR_STOP=1` matters: without it psql prints "relation already
# exists", keeps going, and exits 0 after leaving a half-applied restore.
#
# Safer: restore into a scratch database first, verify, then drop it:
#   docker exec fitness-os-postgres createdb -U fitness fitness_os_verify
#   gunzip -c backups/fitness-os-YYYYmmdd-HHMMSS.sql.gz \
#     | docker exec -i fitness-os-postgres psql -v ON_ERROR_STOP=1 \
#         -U fitness -d fitness_os_verify
#   docker exec fitness-os-postgres dropdb -U fitness fitness_os_verify
#
# pg_dump runs *inside* the Compose container so its version always matches the
# server; running a host pg_dump against Postgres 18 would be a version gamble.
set -euo pipefail

# The dump contains every user's personal data (weight, macros, habits). Create
# it readable only by its owner instead of the default 0644.
umask 077

# Resolve the repo root from this script's own location, so the command works
# from any working directory (npm run, cron, an editor task, ...).
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
BACKUP_DIR="${REPO_ROOT}/backups"

CONTAINER="fitness-os-postgres"
DB_USER="fitness"
DB_NAME="fitness_os"

# Human-readable, one-second resolution. Two runs in the same second therefore
# collide on the same filename — handled by the pre-flight check below.
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="${BACKUP_DIR}/fitness-os-${STAMP}.sql"
GZ="${OUT}.gz"

COMMITTED=0
OWNS_OUT=0
OWNS_GZ=0

# Remove the partial dump on any failure *before* it is fully written. A
# half-written backup that looks like a file is worse than no file at all.
#
# Both ownership flags start at 0 and are only set once this run has provably
# created the file (atomic reservation for ${OUT}, successful pre-flight for
# ${GZ}). A pre-existing backup is hence never in scope here, so the trap cannot
# delete someone else's good dump.
cleanup() {
  if [[ "${COMMITTED}" -eq 1 ]]; then
    return
  fi
  if [[ "${OWNS_OUT}" -eq 1 ]]; then
    rm -f "${OUT}"
  fi
  if [[ "${OWNS_GZ}" -eq 1 ]]; then
    rm -f "${GZ}"
  fi
}
trap cleanup EXIT

if ! command -v docker >/dev/null 2>&1; then
  echo "error: docker was not found on PATH. Start Docker (WSL 2 integration) and retry." >&2
  exit 1
fi

if ! command -v gzip >/dev/null 2>&1; then
  echo "error: gzip was not found on PATH." >&2
  exit 1
fi

if ! docker inspect -f '{{.State.Running}}' "${CONTAINER}" 2>/dev/null | grep -q '^true$'; then
  echo "error: container '${CONTAINER}' is not running. Start it with \`npm run db:up\`." >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}"

# Pre-flight: never write over an existing backup. The timestamp only has
# one-second resolution, so two runs started in the same second pick the same
# filename; the loser must fail here instead of truncating the winner's .sql and
# having gzip refuse to overwrite the winner's .gz.
for target in "${OUT}" "${GZ}"; do
  if [[ -e "${target}" ]]; then
    echo "error: ${target} already exists; refusing to overwrite an existing backup. Retry in a second." >&2
    exit 1
  fi
done

# ...and reserve the name atomically, so two runs that pass the check at the
# same instant still cannot both proceed. `noclobber` makes `>` fail if the file
# exists (O_EXCL-style); the option is set in a subshell and does not leak.
if ! ( set -o noclobber; : > "${OUT}" ) 2>/dev/null; then
  echo "error: ${OUT} already exists; refusing to overwrite an existing backup. Retry in a second." >&2
  exit 1
fi

# The reservation succeeded, so ${OUT} is now a file this run created and the
# cleanup trap may remove it.
OWNS_OUT=1

# `>` truncates the (empty) reservation file, so the file existing says nothing
# about the dump succeeding — hence the payload checks below.
# `--clean --if-exists` keeps the output plain SQL while making it self-restoring
# over an existing, populated database.
if ! docker exec "${CONTAINER}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" --clean --if-exists > "${OUT}"; then
  echo "error: pg_dump failed; no backup written." >&2
  exit 1
fi

if [[ ! -s "${OUT}" ]]; then
  echo "error: pg_dump produced an empty file; refusing to keep it." >&2
  exit 1
fi

# Sanity-check the payload itself. An empty database still produces a header, so
# this catches "the tool ran but wrote an error page / nothing useful".
# Grep the whole file: piping into `grep -q` under `pipefail` can fail the
# pipeline with SIGPIPE (141) when grep exits early, producing a bogus error.
if ! grep -q 'PostgreSQL database dump' "${OUT}"; then
  echo "error: '${OUT}' is not a PostgreSQL dump (missing header); deleting it." >&2
  exit 1
fi

# The pre-flight above proved this name's .gz did not exist, and the reservation
# gives this run exclusive ownership of the stamp, so even a partial .gz left by
# a failed gzip belongs to this run and is safe for the trap to remove.
OWNS_GZ=1
gzip -9 "${OUT}"
COMMITTED=1

SIZE="$(du -h "${GZ}" | cut -f1)"
echo "Backup written: ${GZ} (${SIZE})"
