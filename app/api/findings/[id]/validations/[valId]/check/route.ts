import { NextRequest, NextResponse } from 'next/server'
import { ValidationService } from '@/lib/services/validation-service'
import { CheckValidationSchema } from '@/lib/validators/workflow'
import { apiSuccess, apiError } from '@/lib/utils/api-response'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; valId: string } },
) {
  try {
    const { id: findingId, valId } = params
    const userId = 'temp-user-id' // TODO: Get from session (FASE 7)

    const body = await request.json()
    const input = CheckValidationSchema.parse(body)

    const validation = await ValidationService.checkValidation(
      findingId,
      valId,
      input,
      userId,
    )

    return apiSuccess({
      status: 'success',
      data: validation,
      message: `Validation result: ${validation.result}`,
    })
  } catch (error) {
    return apiError(error)
  }
}
