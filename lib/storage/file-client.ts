import { promises as fs } from 'fs'
import path from 'path'

/**
 * Local file-based storage client for evidence files.
 * Stores files in /public/evidence/ for direct serving.
 */
export class FileStorageClient {
  private static readonly BASE_DIR = path.join(process.cwd(), 'public', 'evidence')

  static async ensureDir(): Promise<void> {
    try {
      await fs.mkdir(this.BASE_DIR, { recursive: true })
    } catch (error) {
      console.error('Failed to create evidence directory:', error)
      throw new Error('Failed to create storage directory')
    }
  }

  static async uploadFile(
    bucket: string,
    key: string,
    body: Buffer,
    mimeType: string,
  ): Promise<void> {
    try {
      await this.ensureDir()
      const filePath = path.join(this.BASE_DIR, key)
      const dir = path.dirname(filePath)

      // Create subdirectories if needed
      await fs.mkdir(dir, { recursive: true })

      // Write file
      await fs.writeFile(filePath, body)
    } catch (error) {
      console.error(`Failed to upload file to ${key}:`, error)
      throw new Error('FILE_UPLOAD_FAILED')
    }
  }

  static async deleteFile(bucket: string, key: string): Promise<void> {
    try {
      const filePath = path.join(this.BASE_DIR, key)
      await fs.unlink(filePath)
    } catch (error) {
      // Ignore if file doesn't exist
      if (error instanceof Error && 'code' in error && error.code !== 'ENOENT') {
        console.error(`Failed to delete file ${key}:`, error)
      }
    }
  }

  static async exists(bucket: string, key: string): Promise<boolean> {
    try {
      const filePath = path.join(this.BASE_DIR, key)
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Generate a local URL for the file (no signing needed for local storage)
   */
  static async generateSignedUrl(
    bucket: string,
    key: string,
    expirySeconds = 86400,
  ): Promise<string> {
    // For local storage, just return the public URL path
    // The Next.js public folder is served at /evidence/{key}
    return `/evidence/${key}`
  }
}
