import crypto from 'crypto'

export function generateFingerprint(projectId: string, sourceRow: number, observation: string): string {
  return crypto
    .createHash('sha256')
    .update(`${projectId}|${sourceRow}|${observation}`)
    .digest('hex')
}
