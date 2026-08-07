export const STORAGE_CONFIG = {
  // R2 bucket name
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
  },

  // Get all allowed extensions
  getAllowedExtensions(): string[] {
    return Object.values(this.ALLOWED_TYPES).flat()
  },

  // Check if MIME type is allowed
  isAllowedType(mimeType: string): boolean {
    return mimeType in this.ALLOWED_TYPES
  },

  // Get storage key format: findings/{findingId}/{evidenceId}/{filename}
  getStorageKey(findingId: string, evidenceId: string, filename: string): string {
    return `findings/${findingId}/${evidenceId}/${filename}`
  },
}
