import { pathToFileURL } from 'node:url'
import { PrivateFileStore } from '../lib/storage/private-file-store'
export async function main(): Promise<number> {
  try {
    await PrivateFileStore.preflight()
    console.log('Evidence storage preflight: PASS')
    return 0
  } catch (error) {
    console.error(`Evidence storage preflight: FAIL (${error instanceof Error ? error.name : 'unknown error'})`)
    return 1
  }
}
const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined
if (invokedPath === import.meta.url) void main().then((code) => { process.exitCode = code })
