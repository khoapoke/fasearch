#!/usr/bin/env bash
# Run the BE test suite including the PostgreSQL-backed integration tests.
#
# The 54 tests that error with "Set PROMOTION_TEST_DB_NAME ..." need an isolated PostgreSQL database
# (Flyway creates the schema + seed on first context start). This script:
#   1. (re)creates an EMPTY database named fasearch_it_* inside the Postgres container,
#   2. exports the variables those tests read (PROMOTION_TEST_DB_*, DEMO_TEST_DB_*, and DB_* for contextLoads),
#   3. runs `./mvnw -o test` (extra args are passed through, e.g. -Dtest=ImportReceiptMultiLineIntegrationTest),
#   4. drops the database again unless IT_KEEP_DB=1.
# It never touches any other database and refuses names that do not start with "fasearch_it_".
#
# Environment (all optional):
#   IT_PG_CONTAINER   Postgres container name            (default: fasearch-home-postgres)
#   IT_DB_ENV_FILE    env file with DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD
#                     (default: ~/.config/fasearch/home-server.env). Only these four keys are read, never printed.
#   IT_DB_NAME        test database name                 (default: fasearch_it_be; must start with fasearch_it_)
#   IT_BE_DIR         BE project dir to test (default: the be/fasearch containing this script)
#   IT_KEEP_DB=1      keep the database after the run
#   IT_MVN_ARGS       extra Maven args (in addition to "$@")
set -euo pipefail

CONTAINER="${IT_PG_CONTAINER:-fasearch-home-postgres}"
ENV_FILE="${IT_DB_ENV_FILE:-$HOME/.config/fasearch/home-server.env}"
DB_NAME="${IT_DB_NAME:-fasearch_it_be}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BE_DIR="$(cd "${IT_BE_DIR:-$HERE/../..}" && pwd)"

case "$DB_NAME" in fasearch_it_[a-z0-9_]*) ;; *) echo "refusing IT_DB_NAME=$DB_NAME (must match fasearch_it_[a-z0-9_]*)" >&2; exit 2;; esac
[ -f "$ENV_FILE" ] || { echo "env file not found: $ENV_FILE (set IT_DB_ENV_FILE)" >&2; exit 2; }
getkey() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2-; }
DB_HOST="$(getkey DB_HOST)"; DB_PORT="$(getkey DB_PORT)"; DB_USER="$(getkey DB_USERNAME)"; DB_PASS="$(getkey DB_PASSWORD)"
[ -n "$DB_HOST" ] && [ -n "$DB_PORT" ] && [ -n "$DB_USER" ] || { echo "DB_HOST/DB_PORT/DB_USERNAME missing in $ENV_FILE" >&2; exit 2; }
docker inspect "$CONTAINER" >/dev/null 2>&1 || { echo "container $CONTAINER not found" >&2; exit 2; }

psql_admin() { docker exec -e PGPASSWORD="$DB_PASS" "$CONTAINER" psql -h 127.0.0.1 -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 -qAt "$@"; }

cleanup() { if [ "${IT_KEEP_DB:-0}" != "1" ]; then psql_admin -c "DROP DATABASE IF EXISTS \"$DB_NAME\" WITH (FORCE)" >/dev/null 2>&1 || true; echo "[it-db] dropped $DB_NAME"; else echo "[it-db] kept $DB_NAME"; fi; }
trap cleanup EXIT

echo "[it-db] recreating $DB_NAME in container $CONTAINER"
psql_admin -c "DROP DATABASE IF EXISTS \"$DB_NAME\" WITH (FORCE)" >/dev/null
psql_admin -c "CREATE DATABASE \"$DB_NAME\"" >/dev/null

export PROMOTION_TEST_DB_NAME="$DB_NAME" PROMOTION_TEST_DB_HOST="$DB_HOST" PROMOTION_TEST_DB_PORT="$DB_PORT" PROMOTION_TEST_DB_USER="$DB_USER" PROMOTION_TEST_DB_PASSWORD="$DB_PASS"
# FasearchApplicationTests.contextLoads boots the full app from application.yaml (${DB_*}) – point it at the same test DB.
export DB_HOST="$DB_HOST" DB_PORT="$DB_PORT" DB_NAME="$DB_NAME" DB_USERNAME="$DB_USER" DB_PASSWORD="$DB_PASS"
export DEMO_TEST_DB_NAME="$DB_NAME" DEMO_TEST_DB_HOST="$DB_HOST" DEMO_TEST_DB_PORT="$DB_PORT" DEMO_TEST_DB_USER="$DB_USER" DEMO_TEST_DB_PASSWORD="$DB_PASS"

cd "$BE_DIR"
set +e
# shellcheck disable=SC2086
./mvnw -o test ${IT_MVN_ARGS:-} "$@"
rc=$?
set -e
echo "[it-db] mvn exit=$rc  (surefire reports: $BE_DIR/target/surefire-reports)"
exit $rc
