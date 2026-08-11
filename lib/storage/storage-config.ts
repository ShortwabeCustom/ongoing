export const STORAGE_CONFIG = {
  // S3-compatible bucket name (AWS S3, Cloudflare R2, MinIO)
  BUCKET: process.env.S3_BUCKET || 'pruebas-maria-evidence',

  // File size limits (bytes)
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10 MB

  // Signed URL expiry (seconds)
  SIGNED_URL_EXPIRY: parseInt(process.env.S3_SIGNED_URL_EXPIRY || '86400', 10), // 24 hours

  // Allowed MIME types
  ALLOWED_TYPES: {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/webp': ['.webp'],
    'application/pdf': ['.pdf'],
    'video/mp4': ['.mp4'],
    'video/webm': ['.webm'],
    'video/quicktime': ['.mov'],
  },

  // Get all allowed extensions
  getAllowedExtensions(): string[] {
    return Object.values(this.ALLOWED_TYPES).flat()
  },

  // Check if MIME type is allowed
  isAllowedType(mimeType: string): boolean {
    return mimeType in this.ALLOWED_TYPES
  },

  getAllowedExtensionsForType(mimeType: string): string[] {
    return this.ALLOWED_TYPES[mimeType as keyof typeof this.ALLOWED_TYPES] ?? []
  },

  getExtension(filename: string): string {
    const cleaned = filename.toLowerCase().split(/[\\/]/).pop() ?? ''
    const index = cleaned.lastIndexOf('.')
    return index >= 0 ? cleaned.slice(index) : ''
  },

  sanitizeFilename(filename: string): string {
    const basename = filename.split(/[\\/]/).pop() || 'evidence'
    const normalized = basename
      .normalize('NFKD')
      .replace(/[^\w.\-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^\.+/, '')
      .slice(0, 180)

    return normalized || 'evidence'
  },

  // Get storage key format: findings/{findingId}/{evidenceId}/{filename}
  getStorageKey(findingId: string, evidenceId: string, filename: string): string {
    return `findings/${findingId}/${evidenceId}/${this.sanitizeFilename(filename)}`
  },
}
