import { Evidence, ApiResponse } from '@/lib/types'

export interface EvidenceUploadResponse extends Evidence {
  uploadedBy: string
}

export class EvidenceClient {
  static async upload(
    file: File,
    findingId: string,
    caption?: string,
    onProgress?: (progress: number) => void,
  ): Promise<EvidenceUploadResponse> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('findingId', findingId)
    if (caption) {
      formData.append('caption', caption)
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100
            onProgress(percentComplete)
          }
        })
      }

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText)
          if (response.data) {
            resolve(response.data)
          } else {
            reject(new Error('Invalid response format'))
          }
        } else {
          const error = JSON.parse(xhr.responseText)
          reject(new Error(error.message || 'Upload failed'))
        }
      })

      xhr.addEventListener('error', () => {
        reject(new Error('Network error during upload'))
      })

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload cancelled'))
      })

      xhr.open('POST', '/api/evidence/upload')
      xhr.send(formData)
    })
  }

  static async updateCaption(
    evidenceId: string,
    caption: string,
  ): Promise<Evidence> {
    const response = await fetch(`/api/evidence/${evidenceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to update caption')
    }

    const result: ApiResponse<Evidence> = await response.json()
    if (!result.data) {
      throw new Error('Invalid response format')
    }
    return result.data
  }

  static async delete(evidenceId: string): Promise<void> {
    const response = await fetch(`/api/evidence/${evidenceId}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to delete evidence')
    }
  }

  static async refreshUrl(
    evidenceId: string,
  ): Promise<{ id: string; url: string; urlExpiresAt: Date }> {
    const response = await fetch(`/api/evidence/${evidenceId}/refresh-url`, {
      method: 'POST',
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to refresh URL')
    }

    const result: ApiResponse = await response.json()
    if (!result.data) {
      throw new Error('Invalid response format')
    }
    return result.data
  }
}
