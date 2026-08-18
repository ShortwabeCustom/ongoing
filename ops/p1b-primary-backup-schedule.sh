#!/usr/bin/env bash
set -euo pipefail

heartbeat=/home/alexis/backups/pruebas-maria/.p1b-primary-last-success
source_job=/home/alexis/bin/p1b-backup-source-v2.sh
interval_seconds=1296000
now=$(date -u +%s)

if [[ ${P1B_FORCE_BACKUP:-0} != 1 && -f $heartbeat ]]; then
  last=$(awk -F= '/^TIMESTAMP_UTC=/{print $2}' "$heartbeat")
  last_epoch=$(date -u -d "$last" +%s)
  if (( now - last_epoch < interval_seconds )); then
    printf 'PRIMARY_BACKUP=SKIPPED_NOT_DUE\n'
    exit 0
  fi
fi

exec "$source_job" create
