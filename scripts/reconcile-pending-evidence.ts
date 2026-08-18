import { pathToFileURL } from 'node:url'
import { reconcilePendingEvidence } from '../lib/services/evidence-reconciliation-service'

type CliOptions = {
  graceMinutes: number
  batchSize?: number
  execute: boolean
}

export function parseArgs(args: string[]): CliOptions {
  let graceMinutes: number | undefined
  let batchSize: number | undefined
  let execute = false

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--execute') {
      execute = true
    } else if (arg === '--grace-minutes' || arg === '--batch-size') {
      const value = args[index + 1]
      const parsed = value === undefined ? NaN : Number(value)
      if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        throw new Error(`${arg} requires a positive integer`)
      }
      if (arg === '--grace-minutes') graceMinutes = parsed
      else batchSize = parsed
      index += 1
    } else {
      throw new Error(`unknown argument: ${arg}`)
    }
  }

  if (graceMinutes === undefined) {
    throw new Error('--grace-minutes is required; no operational default is defined')
  }

  return { graceMinutes, batchSize, execute }
}

export async function main(
  args: string[] = process.argv.slice(2),
  now: Date = new Date(),
): Promise<number> {
  try {
    const options = parseArgs(args)
    const cutoff = new Date(now.getTime() - options.graceMinutes * 60_000)
    const result = await reconcilePendingEvidence({
      cutoff,
      execute: options.execute,
      batchSize: options.batchSize,
    })

    const mode = options.execute ? 'execute' : 'dry-run'
    console.log(
      `Evidence reconciliation (${mode}): scanned=${result.scanned} cleaned=${result.cleaned} skipped=${result.skipped} failed=${result.failed}`,
    )
    for (const failure of result.failures) {
      console.error(`Evidence reconciliation failed: evidenceId=${failure.evidenceId}`)
    }
    return result.failed > 0 ? 1 : 0
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    console.error(`Evidence reconciliation aborted: ${message}`)
    return 1
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined
if (invokedPath === import.meta.url) {
  void main().then((exitCode) => {
    process.exitCode = exitCode
  })
}
