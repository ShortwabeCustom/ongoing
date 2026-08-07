import { NextRequest } from 'next/server'
import { FindingService } from '@/lib/services/finding-service'
import { apiSuccess, apiError } from '@/lib/utils/api-response'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const stats = await FindingService.getStatistics()
    return apiSuccess(stats)
  } catch (error) {
    return apiError(error)
  }
}
