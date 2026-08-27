import { pathToFileURL } from 'node:url'
import { setEvidenceVisibility } from '../lib/services/evidence-visibility-service'
import type { EvidenceVisibility } from '../lib/generated/prisma/client'

const VALID_VISIBILITIES = ['PRIVATE', 'PUBLIC_REPORT'] as const

const EVIDENCE_ID_FLAG = '--evidence-id='
const VISIBILITY_FLAG = '--visibility='

function isValidVisibility(value: string): value is EvidenceVisibility {
  return (VALID_VISIBILITIES as readonly string[]).includes(value)
}

export async function main(args: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const execute = args.includes('--execute')
    const evidenceIdArg = args.find((arg) => arg.startsWith(EVIDENCE_ID_FLAG))
    const visibilityArg = args.find((arg) => arg.startsWith(VISIBILITY_FLAG))

    for (const arg of args) {
      if (arg === '--execute') continue
      if (arg.startsWith(EVIDENCE_ID_FLAG) || arg.startsWith(VISIBILITY_FLAG)) continue
      throw new Error(`unknown argument: ${arg}`)
    }

    const evidenceId = evidenceIdArg?.slice(EVIDENCE_ID_FLAG.length)
    if (!evidenceId) throw new Error('--evidence-id is required')

    const visibility = visibilityArg?.slice(VISIBILITY_FLAG.length)
    if (!visibility) throw new Error('--visibility is required')
    if (!isValidVisibility(visibility)) {
      throw new Error(`--visibility must be one of: ${VALID_VISIBILITIES.join(', ')}`)
    }

    const result = await setEvidenceVisibility(evidenceId, visibility, { execute })
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
