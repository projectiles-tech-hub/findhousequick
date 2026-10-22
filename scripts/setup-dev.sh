#!/usr/bin/env bash
# Sets up a fresh Linux (Ubuntu) development machine or cloud workspace for FindHouseQuick.
# Safe to run more than once. With Docker available, prefer: docker compose -f infra/docker-compose.yml up -d
#
#   bash scripts/setup-dev.sh            # server, database and Flutter
#   SKIP_FLUTTER=1 bash scripts/setup-dev.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FLUTTER_DIR="${FLUTTER_DIR:-/opt/sdk/flutter}"
if [ "$(id -u)" -eq 0 ]; then SUDO=""; AS_PG="runuser -u postgres --"; else SUDO="sudo"; AS_PG="sudo -u postgres"; fi

say() { printf '\n==> %s\n' "$*"; }

say "Database (PostgreSQL 16 + PostGIS) and Redis"
if ! dpkg -s postgresql-16-postgis-3 >/dev/null 2>&1; then
  $SUDO apt-get update -qq
  $SUDO apt-get install -y -qq --no-install-recommends postgresql-16 postgresql-16-postgis-3 redis-server >/dev/null
fi
$SUDO pg_ctlcluster 16 main start 2>/dev/null || true
redis-cli ping >/dev/null 2>&1 || redis-server --daemonize yes >/dev/null

psql_su() { $AS_PG psql -v ON_ERROR_STOP=1 -qtAc "$1"; }
[ "$(psql_su "SELECT 1 FROM pg_roles WHERE rolname='fhq'")" = "1" ] || \
  psql_su "CREATE ROLE fhq LOGIN SUPERUSER PASSWORD 'fhq_dev_password'"
for db in findhousequick findhousequick_test; do
  [ "$(psql_su "SELECT 1 FROM pg_database WHERE datname='$db'")" = "1" ] || $AS_PG createdb -O fhq "$db"
  $AS_PG psql -qd "$db" -c 'CREATE EXTENSION IF NOT EXISTS postgis' >/dev/null
done

say "Server dependencies"
cd "$ROOT/server"
command -v pnpm >/dev/null || npm install -g pnpm@10 >/dev/null
pnpm install --frozen-lockfile
if [ ! -f .env ]; then
  sed -e "s|REPLACE_WITH_BASE64_32_BYTE_KEY|$(openssl rand -base64 32)|" \
      -e "s|change-me-to-a-long-random-string|$(openssl rand -hex 32)|" .env.example > .env
  echo "Created server/.env with fresh secrets"
fi
pnpm db:generate >/dev/null
npx prisma migrate deploy
pnpm db:seed

if [ -z "${SKIP_FLUTTER:-}" ]; then
  say "Flutter"
  if ! command -v flutter >/dev/null && [ ! -x "$FLUTTER_DIR/bin/flutter" ]; then
    url=$(curl -s https://storage.googleapis.com/flutter_infra_release/releases/releases_linux.json | python3 -c '
import json,sys; d=json.load(sys.stdin); h=d["current_release"]["stable"]
print([r for r in d["releases"] if r["hash"]==h][0]["archive"])')
    $SUDO mkdir -p "$(dirname "$FLUTTER_DIR")"
    curl -sSL "https://storage.googleapis.com/flutter_infra_release/releases/$url" | $SUDO tar -xJ -C "$(dirname "$FLUTTER_DIR")"
    git config --global --add safe.directory "$FLUTTER_DIR"
  fi
  export PATH="$FLUTTER_DIR/bin:$PATH"
  flutter --disable-analytics >/dev/null 2>&1 || true
  cd "$ROOT/app" && flutter pub get >/dev/null
  echo "Add Flutter to your PATH: export PATH=\"$FLUTTER_DIR/bin:\$PATH\""
fi

say "Done. Start the API with: cd server && pnpm start:dev   (docs at http://localhost:3000/docs)"
