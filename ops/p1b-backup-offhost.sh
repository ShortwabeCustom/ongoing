#!/usr/bin/env bash
set -euo pipefail
umask 077

remote_host=experiments-01
remote_script=/home/alexis/bin/p1b-backup-source.sh
remote_root=/home/alexis/backups/pruebas-maria
offhost_root=/Users/alexisvaldez/Backups/pruebas-maria
state_root=/Users/alexisvaldez/Library/Application\ Support/PruebasMaria/backup
alert_spool=$state_root/alerts
mkdir -p "$offhost_root" "$alert_spool"
chmod 700 "$offhost_root" "$state_root" "$alert_spool"
if [[ ! -e $state_root/PRE_POLICY_INVENTORY.txt ]]; then
  {
    printf 'CREATED_UTC=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    printf 'RETENTION_DELETE_ENABLED=NO\n'
    find "$offhost_root" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort
  } > "$state_root/PRE_POLICY_INVENTORY.txt"
  chmod 600 "$state_root/PRE_POLICY_INVENTORY.txt"
fi

fail_event() {
  local phase=${1:-BACKUP_JOB_FAILURE} now event
  now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  event=$alert_spool/$(date -u +%Y%m%dT%H%M%SZ)-$phase.env
  printf 'TIMESTAMP_UTC=%s\nSTATUS=FAIL\nEVENT=%s\nREQUIRED_ACTION=Inspect backup logs and preserve last known-good recovery point\n' "$now" "$phase" > "$event"
  chmod 600 "$event"
}
trap 'fail_event BACKUP_JOB_FAILURE' ERR

output=$(ssh -o BatchMode=yes "$remote_host" "bash $remote_script create")
backup_id=$(printf '%s\n' "$output" | awk -F= '/^BACKUP_ID=p1b-auto-[0-9]{8}T[0-9]{6}Z$/{print $2}')
[[ $backup_id =~ ^p1b-auto-[0-9]{8}T[0-9]{6}Z$ ]]
destination=$offhost_root/$backup_id
[[ ! -e $destination ]]
mkdir -m 700 "$destination"

copied=NO
for attempt in 1 2; do
  if rsync -a --chmod=Du=rwx,Dgo=,Fu=rw,Fgo= "$remote_host:$remote_root/$backup_id/" "$destination/"; then copied=YES; break; fi
done
[[ $copied == YES ]]
(cd "$destination" && sha256sum --check --status SHA256SUMS)
ssh -o BatchMode=yes "$remote_host" "bash $remote_script finalize $backup_id"

now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
printf '%s\n' \
  "TIMESTAMP_UTC=$now" \
  'OVERALL_STATUS=PASS' \
  "BACKUP_ID=$backup_id" \
  'DB_PHASE=PASS' \
  'STORAGE_PHASE=PASS' \
  'SOURCE_HASH_PHASE=PASS' \
  'OFF_HOST_PHASE=PASS' \
  'OFF_HOST_HASH_PHASE=PASS' > "$destination/SUCCESS"
chmod 600 "$destination/SUCCESS"
[[ ! -e $destination/INCOMPLETE ]] || unlink "$destination/INCOMPLETE"
printf '%s\n' \
  "TIMESTAMP_UTC=$now" \
  'OVERALL_STATUS=PASS' \
  "BACKUP_ID=$backup_id" \
  'DB_PHASE=PASS' \
  'STORAGE_PHASE=PASS' \
  'SOURCE_HASH_PHASE=PASS' \
  'OFF_HOST_PHASE=PASS' \
  'OFF_HOST_HASH_PHASE=PASS' > "$state_root/last-success.env"
chmod 600 "$state_root/last-success.env"
trap - ERR
printf 'BACKUP_RESULT=PASS\nBACKUP_ID=%s\n' "$backup_id"
