import { NextRequest } from 'next/server'
import { ResolutionService } from '@/lib/services/resolution-service'
import { CreateResolutionSchema } from '@/lib/validators/workflow'
import { apiSuccess, apiError } from '@/lib/utils/api-response'
import { checkRBAC, RBAC_PERMISSIONS } from '@/lib/middleware/rbac'
import { FindingService } from '@/lib/services/finding-service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // FASE 7: RBAC validation
    const { valid, user, error } = await checkRBAC(request, {
      allowedRoles: RBAC_PERMISSIONS.CREATE_RESOLUTION,
    })
    if (!valid) return error

    const { id: findingId } = await params

    // Guard de acceso: ResolutionService trabaja directo sobre findingId sin
    // verificar membresía de proyecto, así que se valida aquí.
    await FindingService.assertFindingAccess(findingId, user)

    const body = await request.json()
    const input = CreateResolutionSchema.parse(body)

    const resolution = await ResolutionService.createResolution(
      findingId,
      input,
      user.id,
    )

    return apiSuccess({ status: 'success', data: resolution }, 201)
  } catch (error) {
    return apiError(error)
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Esta ruta no tenía ninguna comprobación de sesión/rol (gap preexistente,
    // fuera del alcance original de este cambio pero de la misma clase de
    // problema: acceso a datos de findings). Se cablea VIEW_ALL_FINDINGS, igual
    // que el resto de lecturas de findings, más el guard de proyecto.
    const { valid, user, error } = await checkRBAC(request, {
      allowedRoles: RBAC_PERMISSIONS.VIEW_ALL_FINDINGS,
    })
    if (!valid) return error

    const { id: findingId } = await params
    await FindingService.assertFindingAccess(findingId, user)

    const { searchParams } = new URL(request.url)

    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)
    const offset = parseInt(searchParams.get('offset') ?? '0')

    const result = await ResolutionService.getResolutions(findingId, limit, offset)

    return apiSuccess({ status: 'success', data: result })
  } catch (error) {
    return apiError(error)
  }
}
