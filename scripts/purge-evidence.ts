import { pathToFileURL } from 'node:url'
import { purgeEvidence } from '../lib/services/evidence-purge-service'
import { EVIDENCE_RETENTION_MS } from '../lib/services/storage-service'

export async function main(args: string[] = process.argv.slice(2), now = new Date()): Promise<number> {
  try {
    const execute = args.includes('--execute')
    if (args.some((arg) => arg !== '--execute')) throw new Error('unknown argument')
    if (execute) throw new Error('PURGE_GATE_CLOSED: backup/restore DR is not verified')
    const result = await purgeEvidence({ cutoff: new Date(now.getTime() - EVIDENCE_RETENTION_MS) })
    console.log(`Evidence purge (dry-run): scanned=${result.scanned} purged=${result.purged} skipped=${result.skipped} failed=${result.failed}`)
    return result.failed > 0 ? 1 : 0
  } catch (error) {
    console.error(`Evidence purge aborted: ${error instanceof Error ? error.message : 'unknown error'}`)
    return 1
  }
}
const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined
if (invokedPath === import.meta.url) void main().then((code) => { process.exitCode = code })
