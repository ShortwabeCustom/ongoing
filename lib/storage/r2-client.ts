import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export class R2Client {
  private static instance: S3Client

  static getInstance(): S3Client {
    if (!this.instance) {
      const endpoint = process.env.S3_ENDPOINT
      const accessKeyId = process.env.S3_ACCESS_KEY_ID
      const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY

      if (!endpoint || !accessKeyId || !secretAccessKey) {
        throw new Error('R2 credentials not configured in environment')
      }

      this.instance = new S3Client({
        region: 'auto',
        endpoint,
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

  static async generateSignedUrl(
    bucket: string,
    key: string,
    expirySeconds: number = 86400, // 24 hours default
  ): Promise<string> {
    const client = this.getInstance()
    const url = await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
      { expiresIn: expirySeconds },
    )
    return url
  }
}
