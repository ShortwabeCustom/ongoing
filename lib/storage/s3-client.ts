import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export class S3StorageClient {
  private static instance: S3Client

  static getInstance(): S3Client {
    if (!this.instance) {
      const endpoint = process.env.S3_ENDPOINT
      const accessKeyId = process.env.S3_ACCESS_KEY_ID
      const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY

      if (!endpoint || !accessKeyId || !secretAccessKey) {
        throw new Error('S3 credentials not configured in environment')
      }

      this.instance = new S3Client({
        region: process.env.S3_REGION || 'auto',
        endpoint,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      })
    }
    return this.instance
  }

  static async uploadFile(
    bucket: string,
    key: string,
    body: Buffer,
    mimeType: string,
  ): Promise<void> {
    const client = this.getInstance()
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: mimeType,
      }),
    )
  }

  static async deleteFile(bucket: string, key: string): Promise<void> {
    const client = this.getInstance()
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    )
  }

  static async exists(bucket: string, key: string): Promise<boolean> {
    const client = this.getInstance()
    try {
      await client.send(
        new HeadObjectCommand({
          Bucket: bucket,
          Key: key,
        }),
      )
      return true
    } catch (error) {
      if (error instanceof Error && ['NotFound', 'NoSuchKey', '404'].includes(error.name)) {
        return false
      }
      return false
    }
  }

  static async generateSignedUrl(
    bucket: string,
    key: string,
    expirySeconds = 86400,
  ): Promise<string> {
    const client = this.getInstance()
    return getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
      { expiresIn: expirySeconds },
    )
  }
}
