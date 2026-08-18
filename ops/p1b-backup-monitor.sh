#!/usr/bin/env bash
set -euo pipefail
umask 077

state_root=/Users/alexisvaldez/Library/Application\ Support/PruebasMaria/backup
heartbeat=$state_root/last-success.env
alert_spool=$state_root/alerts
mkdir -p "$alert_spool"
chmod 700 "$state_root" "$alert_spool"
now=$(date -u +%s)

emit_once() {
  local event=$1 marker=$state_root/.alerted-$1 record
  [[ -e $marker ]] && return 0
  record=$alert_spool/$(date -u +%Y%m%dT%H%M%SZ)-$event.env
  printf 'TIMESTAMP_UTC=%s\nSTATUS=FAIL\nEVENT=%s\nREQUIRED_ACTION=Inspect backup state immediately\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$event" > "$record"
  chmod 600 "$record"
  : > "$marker"
  chmod 600 "$marker"
}

if [[ ! -f $heartbeat ]]; then
  emit_once BACKUP_MISSING
  exit 1
fi
last=$(awk -F= '/^TIMESTAMP_UTC=/{print $2}' "$heartbeat")
last_epoch=$(date -j -u -f '%Y-%m-%dT%H:%M:%SZ' "$last" +%s)
if (( now - last_epoch > 93600 )); then
  emit_once BACKUP_MISSING
  exit 1
fi

latest_restore=$(find /Users/alexisvaldez/Backups/pruebas-maria -maxdepth 2 -type f -name 'DR-DOCKER-EXERCISE-*.txt' -print0 | xargs -0 stat -f '%m' 2>/dev/null | sort -nr | head -1 || true)
if [[ -z $latest_restore ]] || (( now - latest_restore > 7948800 )); then
  emit_once RESTORE_OVERDUE
  exit 1
fi
