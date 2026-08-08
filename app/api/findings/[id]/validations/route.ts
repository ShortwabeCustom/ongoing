import { NextRequest, NextResponse } from 'next/server'
import { ValidationService } from '@/lib/services/validation-service'
import { CreateValidationSchema } from '@/lib/validators/workflow'
import { apiSuccess, apiError } from '@/lib/utils/api-response'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const findingId = params.id
    const userId = 'temp-user-id' // TODO: Get from session (FASE 7)

    const body = await request.json()
    const input = CreateValidationSchema.parse(body)

    const validation = await ValidationService.createValidation(
      findingId,
      input,
      userId,
    )

    return apiSuccess(
      {
        status: 'success',
        data: validation,
      },
      201,
    )
  } catch (error) {
    return apiError(error)
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const findingId = params.id
    const { searchParams } = new URL(request.url)

    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)
    const offset = parseInt(searchParams.get('offset') ?? '0')

    const result = await ValidationService.getValidations(findingId, limit, offset)

    return apiSuccess({
      status: 'success',
      data: result,
    })
  } catch (error) {
    return apiError(error)
  }
}
