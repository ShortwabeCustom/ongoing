import {
  ResolutionState,
  UpdateResolutionStateInput,
  CreateResolutionInput,
  CreateValidationInput,
  CheckValidationInput,
  AuditLogFilter,
} from '@/lib/validators/workflow'

export class WorkflowClient {
  private static baseUrl = '/api'

  // Resolution endpoints
  static async createResolution(
    findingId: string,
    input: CreateResolutionInput,
  ) {
    const response = await fetch(`${this.baseUrl}/findings/${findingId}/resolutions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    return response.json()
  }

  static async getResolutions(findingId: string, limit = 50, offset = 0) {
    const url = new URL(`${this.baseUrl}/findings/${findingId}/resolutions`, window.location.origin)
    url.searchParams.set('limit', limit.toString())
    url.searchParams.set('offset', offset.toString())

    const response = await fetch(url.toString())
    return response.json()
  }

  static async getResolution(findingId: string, resolutionId: string) {
    const response = await fetch(
      `${this.baseUrl}/findings/${findingId}/resolutions/${resolutionId}`,
    )
    return response.json()
  }

  static async updateResolutionState(
    findingId: string,
    resolutionId: string,
    input: UpdateResolutionStateInput,
  ) {
    const response = await fetch(
      `${this.baseUrl}/findings/${findingId}/resolutions/${resolutionId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      },
    )
    return response.json()
  }

  // Validation endpoints
  static async createValidation(
    findingId: string,
    input: CreateValidationInput,
  ) {
    const response = await fetch(`${this.baseUrl}/findings/${findingId}/validations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    return response.json()
  }

  static async getValidations(findingId: string, limit = 50, offset = 0) {
    const url = new URL(`${this.baseUrl}/findings/${findingId}/validations`, window.location.origin)
    url.searchParams.set('limit', limit.toString())
    url.searchParams.set('offset', offset.toString())

    const response = await fetch(url.toString())
    return response.json()
  }

  static async checkValidation(
    findingId: string,
    validationId: string,
    input: CheckValidationInput,
  ) {
    const response = await fetch(
      `${this.baseUrl}/findings/${findingId}/validations/${validationId}/check`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      },
    )
    return response.json()
  }

  // Audit log endpoints
  static async getAuditLog(
    findingId: string,
    filter: Partial<AuditLogFilter> = {},
  ) {
    const url = new URL(
      `${this.baseUrl}/findings/${findingId}/audit-log`,
      window.location.origin,
    )

    if (filter.action) url.searchParams.set('action', filter.action)
    if (filter.userId) url.searchParams.set('userId', filter.userId)
    url.searchParams.set('limit', (filter.limit ?? 50).toString())
    url.searchParams.set('offset', (filter.offset ?? 0).toString())

    const response = await fetch(url.toString())
    return response.json()
  }

  static async exportAuditLog(findingId: string) {
    const url = `${this.baseUrl}/findings/${findingId}/audit-log/export`
    const response = await fetch(url)
    if (!response.ok) throw new Error('Export failed')
    return response.blob()
  }
}
