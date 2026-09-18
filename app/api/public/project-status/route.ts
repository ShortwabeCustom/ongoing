import { NextResponse } from 'next/server'
import { getProjectStatus } from '@/lib/services/project-status'

/**
 * Fuente de la sección "Project Status / Estado de proyectos" del reporte
 * ejecutivo. Es PÚBLICA (igual que /api/public/report): solo devuelve los
 * proyectos de la lista blanca de `PROJECT_STATUS_REPORT`, con nombre, owner y
 * responsable UIX (nombre y foto) y conteo de hallazgos por estado. No expone
 * ids ni correos de personas.
 */
export const revalidate = 180 // 3 minutos, como /api/public/report

export async function GET() {
  try {
    const items = await getProjectStatus()
    return NextResponse.json(
      { items },
      { headers: { 'Cache-Control': 'public, max-age=180, stale-while-revalidate=60' } },
    )
  } catch (error) {
    console.error('[PUBLIC PROJECT STATUS] Fetch failed:', error)
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Project status temporarily unavailable' },
      { status: 500 },
    )
  }
}
