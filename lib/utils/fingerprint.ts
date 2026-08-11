import crypto from 'crypto'

export function stableHash(parts: Array<string | number | null | undefined>): string {
  return crypto
    .createHash('sha256')
    .update(
      parts
        .map((part) => String(part ?? '').trim().toLowerCase().replace(/\s+/g, ' '))
        .join('|'),
    )
    .digest('hex')
}

export function generateFingerprint(
  projectId: string,
  sourceRow: number,
  observation: string,
  options: {
    testSessionId?: string
    sourceSheet?: string
    sourceId?: string
  } = {},
): string {
  return stableHash([
    projectId,
    options.testSessionId,
    options.sourceSheet,
    options.sourceId,
    sourceRow,
    observation,
  ])
}
