import { pathToFileURL } from 'node:url'
import { setEvidenceVisibility } from '../lib/services/evidence-visibility-service'
import { setAllActiveRuntimeVisibility } from '../lib/services/evidence-visibility-bulk-service'
import type { EvidenceVisibility } from '../lib/generated/prisma/client'

const VALID_VISIBILITIES = ['PRIVATE', 'PUBLIC_REPORT'] as const

const EVIDENCE_ID_FLAG = '--evidence-id='
const VISIBILITY_FLAG = '--visibility='
const ALL_ACTIVE_RUNTIME_FLAG = '--all-active-runtime'
const EXECUTE_FLAG = '--execute'

/** ADR-001 D12-bis: motivo fijo del backfill masivo, no configurable por CLI. */
const BULK_REASON = 'REPORT_POLICY_BACKFILL'

function isValidVisibility(value: string): value is EvidenceVisibility {
  return (VALID_VISIBILITIES as readonly string[]).includes(value)
}

export async function main(args: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const execute = args.includes(EXECUTE_FLAG)
    const allActiveRuntime = args.includes(ALL_ACTIVE_RUNTIME_FLAG)
    const evidenceIdArg = args.find((arg) => arg.startsWith(EVIDENCE_ID_FLAG))
    const visibilityArg = args.find((arg) => arg.startsWith(VISIBILITY_FLAG))

    for (const arg of args) {
      if (arg === EXECUTE_FLAG) continue
      if (arg === ALL_ACTIVE_RUNTIME_FLAG) continue
      if (arg.startsWith(EVIDENCE_ID_FLAG) || arg.startsWith(VISIBILITY_FLAG)) continue
      throw new Error(`unknown argument: ${arg}`)
    }

    const evidenceId = evidenceIdArg?.slice(EVIDENCE_ID_FLAG.length)

    if (allActiveRuntime && evidenceId) {
      throw new Error('--all-active-runtime and --evidence-id are mutually exclusive')
    }
    if (!allActiveRuntime && !evidenceId) {
      throw new Error('either --evidence-id or --all-active-runtime is required')
    }

    const visibility = visibilityArg?.slice(VISIBILITY_FLAG.length)
    if (!visibility) throw new Error('--visibility is required')
    if (!isValidVisibility(visibility)) {
      throw new Error(`--visibility must be one of: ${VALID_VISIBILITIES.join(', ')}`)
    }

    if (allActiveRuntime) {
      const result = await setAllActiveRuntimeVisibility(visibility, { execute, reason: BULK_REASON })
      if (result.mode === 'dry-run') {
        console.log(
          `Evidence visibility bulk (dry-run): visibility=${visibility} ` +
            `eligible=${result.eligible} alreadyTarget=${result.alreadyTarget} ` +
            `skippedPending=${result.skippedPending} skippedDeleted=${result.skippedDeleted} ` +
            `skippedDeletedFinding=${result.skippedDeletedFinding} skippedLegacy=${result.skippedLegacy} ` +
            `skippedUnsupported=${result.skippedUnsupported} total=${result.total}`,
        )
      } else {
        console.log(
          `Evidence visibility bulk (execute): visibility=${visibility} ` +
            `changed=${result.changed} unchanged=${result.unchanged} ` +
            `skipped=${result.skipped} failed=${result.failed} total=${result.total}` +
            (result.failedIds.length ? ` failedIds=${result.failedIds.join(',')}` : ''),
        )
      }
      return 0
    }

    const result = await setEvidenceVisibility(evidenceId as string, visibility, { execute })
    console.log(
      `Evidence visibility (${execute ? 'execute' : 'dry-run'}): evidenceId=${result.evidenceId} status=${result.status} visibility=${result.visibility}`,
    )
    return 0
  } catch (error) {
    console.error(`Evidence visibility change aborted: ${error instanceof Error ? error.message : 'unknown error'}`)
    return 1
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined
if (invokedPath === import.meta.url) void main().then((code) => { process.exitCode = code })
