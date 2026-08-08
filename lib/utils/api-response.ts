import { NextResponse } from 'next/server'

export interface ApiErrorResponse {
  code: string
  message: string
  fields?: Record<string, string[]>
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public fields?: Record<string, string[]>,
    public statusCode: number = 400,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function apiSuccess<T>(data: T, statusCode: number = 200) {
  return NextResponse.json(data, { status: statusCode })
}

export function createApiResponse<T>(response: {
  status: 'success' | 'error'
  data?: T
  message?: string
  fields?: Record<string, string[]>
}) {
  return response
}

export function handleApiError(error: unknown) {
  return apiError(error)
}

export function apiError(error: unknown) {
  // Handle known error types
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        code: error.code,
        message: error.message,
        ...(error.fields && { fields: error.fields }),
      },
      { status: error.statusCode },
    )
  }

  // Handle service layer errors (simple error messages)
  if (error instanceof Error) {
    const message = error.message

    if (message === 'NOT_FOUND') {
      return NextResponse.json(
        {
          code: 'NOT_FOUND',
          message: 'Resource not found',
        },
        { status: 404 },
      )
    }

    if (message === 'VERSION_MISMATCH') {
      return NextResponse.json(
        {
          code: 'VERSION_MISMATCH',
          message: 'Finding was updated by another user. Please refresh and try again.',
        },
        { status: 409 },
      )
    }

    if (message === 'DELETED') {
      return NextResponse.json(
        {
          code: 'RESOURCE_DELETED',
          message: 'This resource has been deleted.',
        },
        { status: 410 },
      )
    }

    if (message === 'ALREADY_DELETED') {
      return NextResponse.json(
        {
          code: 'ALREADY_DELETED',
          message: 'This resource is already deleted.',
        },
        { status: 410 },
      )
    }

    console.error('Unexpected error:', error)
    return NextResponse.json(
      {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
      { status: 500 },
    )
  }

  console.error('Unknown error:', error)
  return NextResponse.json(
    {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
    { status: 500 },
  )
}
