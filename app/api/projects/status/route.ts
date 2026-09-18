import { NextRequest } from 'next/server'
import { checkRBAC, RBAC_PERMISSIONS } from '@/lib/middleware/rbac'
import { getProjectStatus } from '@/lib/services/project-status'
import { apiError, apiSuccess } from '@/lib/utils/api-response'

export const dynamic = 'force-dynamic'

/**
 * Fuente de la sección "Project Status / Estado de proyectos" del reporte
 * ejecutivo. Exige sesión (401 para anónimos) y limita el resultado a los
 * proyectos accesibles para el usuario, igual que /findings.
 */
export async function GET(request: NextRequest) {
  try {
    const { valid, user, error } = await checkRBAC(request, {
      allowedRoles: RBAC_PERMISSIONS.VIEW_ALL_FINDINGS,
    })
    if (!valid) return error

    const items = await getProjectStatus(user)
    return apiSuccess({ items })
  } catch (error) {
    return apiError(error)
  }
}
