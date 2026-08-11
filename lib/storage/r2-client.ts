import { S3StorageClient } from '@/lib/storage/s3-client'

// Backwards-compatible alias for code that still imports R2Client.
export class R2Client extends S3StorageClient {}
