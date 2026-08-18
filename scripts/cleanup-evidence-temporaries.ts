import { pathToFileURL } from 'node:url'
import { PrivateFileStore } from '../lib/storage/private-file-store'

export async function main(args: string[] = process.argv.slice(2), now = new Date()): Promise<number> {
  try {
    const index = args.indexOf('--grace-minutes')
    const grace = index < 0 ? NaN : Number(args[index + 1])
    if (!Number.isSafeInteger(grace) || grace <= 0) throw new Error('--grace-minutes requires a positive integer')
    const execute = args.includes('--execute')
    const allowed = new Set(['--grace-minutes', String(args[index + 1]), '--execute'])
    if (args.some((arg) => !allowed.has(arg))) throw new Error('unknown argument')
    const result = await PrivateFileStore.cleanupTemporaries({ cutoff: new Date(now.getTime() - grace * 60_000), execute })
    console.log(`Evidence temporary cleanup (${execute ? 'execute' : 'dry-run'}): scanned=${result.scanned} cleaned=${result.cleaned} skipped=${result.skipped} failed=${result.failed}`)
    return result.failed > 0 ? 1 : 0
  } catch (error) {
    console.error(`Evidence temporary cleanup aborted: ${error instanceof Error ? error.message : 'unknown error'}`)
    return 1
  }
}
const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined
if (invokedPath === import.meta.url) void main().then((code) => { process.exitCode = code })
