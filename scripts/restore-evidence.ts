import { pathToFileURL } from 'node:url'
import { restoreEvidence } from '../lib/services/evidence-restore-service'

export async function main(args: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const evidenceId = args.find((arg) => !arg.startsWith('--'))
    if (!evidenceId) throw new Error('evidenceId is required')
    const execute = args.includes('--execute')
    if (args.some((arg) => arg.startsWith('--') && arg !== '--execute')) throw new Error('unknown argument')
    const result = await restoreEvidence(evidenceId, { execute })
    console.log(`Evidence restore (${execute ? 'execute' : 'dry-run'}): evidenceId=${result.evidenceId} status=${result.status} outsideRetentionWindow=${result.outsideRetentionWindow}`)
    return 0
  } catch (error) {
    console.error(`Evidence restore aborted: ${error instanceof Error ? error.message : 'unknown error'}`)
    return 1
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined
if (invokedPath === import.meta.url) void main().then((code) => { process.exitCode = code })
