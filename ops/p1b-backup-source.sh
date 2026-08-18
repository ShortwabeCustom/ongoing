#!/usr/bin/env bash
set -euo pipefail
umask 077

backup_root=/home/alexis/backups/pruebas-maria
app_root=/var/www/apps/uix

valid_id() {
  [[ ${1:-} =~ ^p1b-auto-[0-9]{8}T[0-9]{6}Z$ ]]
}

create_backup() {
  local stamp backup_id snapshot psql_url head node_v npm_v prisma_v evidence_count private_count started completed
  stamp=$(date -u +%Y%m%dT%H%M%SZ)
  if [[ ! -e $backup_root/PRE_POLICY_INVENTORY.txt ]]; then
    {
      printf 'CREATED_UTC=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
      printf 'RETENTION_DELETE_ENABLED=NO\n'
      find "$backup_root" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort
    } > "$backup_root/PRE_POLICY_INVENTORY.txt"
    chmod 600 "$backup_root/PRE_POLICY_INVENTORY.txt"
  fi
  backup_id=p1b-auto-$stamp
  snapshot=$backup_root/$backup_id
  [[ ! -e $snapshot ]]
  mkdir -m 700 "$snapshot"
  : > "$snapshot/INCOMPLETE"

  cd "$app_root"
  set -a
  . ./.env
  set +a
  [[ ${EVIDENCE_STORAGE_DIR:-} == /var/lib/pruebas-maria/evidence ]]
  psql_url=$(node -e 'const u=new URL(process.env.DATABASE_URL);u.search="";process.stdout.write(u.toString())')
  head=$(git rev-parse HEAD)
  node_v=$(node --version)
  npm_v=$(npm --version)
  prisma_v=$(npm exec -- prisma version 2>/dev/null | awk -F: '/^prisma[[:space:]]*:/{gsub(/^[[:space:]]+|[[:space:]]+$/, "", $2); print $2; exit}')
  evidence_count=$(psql "$psql_url" -XAtqc 'SELECT count(*) FROM evidence')
  private_count=$(find "$EVIDENCE_STORAGE_DIR" -type f ! -name '.tmp-*' | wc -l | tr -d ' ')
  started=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  pg_dump "$psql_url" --format=custom --no-owner --no-privileges --file="$snapshot/pruebas_maria_prod.dump"
  tar --create --gzip --file="$snapshot/private-evidence.tar.gz" --directory="$(dirname "$EVIDENCE_STORAGE_DIR")" "$(basename "$EVIDENCE_STORAGE_DIR")"
  completed=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  printf '%s\n' \
    'SNAPSHOT_KIND=P1B_AUTOMATED_RECOVERY_POINT' \
    "BACKUP_ID=$backup_id" \
    "BACKUP_STARTED_UTC=$started" \
    "BACKUP_COMPLETED_UTC=$completed" \
    "HOSTNAME=$(hostname)" \
    "DEPLOYED_HEAD=$head" \
    "NODE_VERSION=$node_v" \
    "NPM_VERSION=$npm_v" \
    "PRISMA_VERSION=$prisma_v" \
    'DB_DUMP_FILENAME=pruebas_maria_prod.dump' \
    'PRIVATE_STORAGE_ARCHIVE_FILENAME=private-evidence.tar.gz' \
    "EVIDENCE_DB_COUNT=$evidence_count" \
    "PRIVATE_FILE_COUNT=$private_count" \
    'STORAGE_ROOT=/var/lib/pruebas-maria/evidence' \
    'EXPECTED_ROOT_MODE=0700' \
    'EXPECTED_OWNER=alexis:alexis' \
    'EXPECTED_FILE_MODE=0600' > "$snapshot/MANIFEST.txt"

  (
    cd "$snapshot"
    sha256sum MANIFEST.txt pruebas_maria_prod.dump private-evidence.tar.gz > SHA256SUMS
    sha256sum --check --status SHA256SUMS
  )
  chmod 600 "$snapshot"/*
  completed=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  printf '%s\n' \
    "TIMESTAMP_UTC=$completed" \
    'OVERALL_STATUS=PASS' \
    "BACKUP_ID=$backup_id" \
    'PRIMARY_BACKUP=PASS' \
    'DB_PHASE=PASS' \
    'STORAGE_PHASE=PASS' \
    'MANIFEST_PHASE=PASS' \
    'SOURCE_HASH_PHASE=PASS' \
    'OFF_HOST_COPY=PENDING' > "$snapshot/SUCCESS"
  chmod 600 "$snapshot/SUCCESS"
  unlink "$snapshot/INCOMPLETE"
  printf '%s\n' \
    "TIMESTAMP_UTC=$completed" \
    'OVERALL_STATUS=PASS' \
    "BACKUP_ID=$backup_id" \
    'PRIMARY_BACKUP=PASS' \
    'DB_PHASE=PASS' \
    'STORAGE_PHASE=PASS' \
    'MANIFEST_PHASE=PASS' \
    'SOURCE_HASH_PHASE=PASS' \
    'OFF_HOST_COPY=PENDING' > "$backup_root/.p1b-primary-last-success"
  chmod 600 "$backup_root/.p1b-primary-last-success"
  printf 'BACKUP_ID=%s\n' "$backup_id"
}

list_valid() {
  local snapshot
  for snapshot in "$backup_root"/p1b-auto-*; do
    [[ -d $snapshot && -f $snapshot/SUCCESS && ! -e $snapshot/INCOMPLETE ]] || continue
    basename "$snapshot"
  done
}

case ${1:-} in
  create) create_backup ;;
  list-valid) list_valid ;;
  *) echo 'usage: p1b-backup-source.sh create|list-valid' >&2; exit 64 ;;
esac
