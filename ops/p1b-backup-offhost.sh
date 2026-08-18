#!/usr/bin/env bash
set -euo pipefail
umask 077

remote_host=experiments-01
remote_script=/home/alexis/bin/p1b-backup-source-v2.sh
remote_root=/home/alexis/backups/pruebas-maria
offhost_root=/Users/alexisvaldez/Backups/pruebas-maria
state_root=/Users/alexisvaldez/Library/Application\ Support/PruebasMaria/backup
alert_spool=$state_root/alerts
mkdir -p "$offhost_root" "$alert_spool"
chmod 700 "$offhost_root" "$state_root" "$alert_spool"

fail_event() {
  local event=${1:-OFF_HOST_COPY_FAILURE} now record
  now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  record=$alert_spool/$(date -u +%Y%m%dT%H%M%SZ)-$event.env
  printf 'TIMESTAMP_UTC=%s\nSTATUS=FAIL\nEVENT=%s\nREQUIRED_ACTION=Inspect off-host sync logs; do not remove VPS source\n' "$now" "$event" > "$record"
  chmod 600 "$record"
}
trap 'fail_event OFF_HOST_COPY_FAILURE' ERR

backup_list=$(ssh -o BatchMode=yes "$remote_host" "bash $remote_script list-valid")
backup_ids=()
while IFS= read -r backup_id; do
  [[ -z $backup_id ]] || backup_ids[${#backup_ids[@]}]=$backup_id
done <<< "$backup_list"
synced=0
for backup_id in "${backup_ids[@]}"; do
  [[ $backup_id =~ ^p1b-auto-[0-9]{8}T[0-9]{6}Z$ ]] || exit 65
  destination=$offhost_root/$backup_id
  if [[ -f $destination/OFF_HOST_SUCCESS ]]; then
    continue
  fi
  if [[ -d $destination ]]; then
    [[ -f $destination/SHA256SUMS ]] || { fail_event HASH_INVALID; exit 66; }
  else
    [[ ! -e $destination ]] || { fail_event HASH_INVALID; exit 66; }
    mkdir -m 700 "$destination"
    copied=NO
    for attempt in 1 2; do
      if rsync -a --chmod=Du=rwx,Dgo=,Fu=rw,Fgo= "$remote_host:$remote_root/$backup_id/" "$destination/"; then copied=YES; break; fi
    done
    [[ $copied == YES ]]
  fi
  (cd "$destination" && sha256sum --check --status SHA256SUMS) || { fail_event HASH_INVALID; exit 67; }
  now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  printf '%s\n' \
    "TIMESTAMP_UTC=$now" \
    'OFF_HOST_COPY=PASS' \
    'OFF_HOST_HASH_VERIFY=PASS' \
    "BACKUP_ID=$backup_id" > "$destination/OFF_HOST_SUCCESS"
  chmod 600 "$destination/OFF_HOST_SUCCESS"
  synced=$((synced+1))
done

now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
printf 'TIMESTAMP_UTC=%s\nOVERALL_STATUS=PASS\nSYNCED_COUNT=%s\n' "$now" "$synced" > "$state_root/last-offhost-sync.env"
chmod 600 "$state_root/last-offhost-sync.env"
trap - ERR
printf 'OFF_HOST_SYNC=PASS\nSYNCED_COUNT=%s\n' "$synced"
