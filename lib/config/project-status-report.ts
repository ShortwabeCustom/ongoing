import type { FindingStatus } from '@/lib/generated/prisma/client'

/**
 * Curación del reporte ejecutivo "Project Status / Estado de proyectos".
 *
 * Son decisiones de presentación explícitas, NO datos del registro: no modifican
 * proyectos, hallazgos ni usuarios en la base. Se indexan por id de BD (los mismos
 * de `/findings?project=<id>`); si un id no existe en otro entorno, no aplica nada.
 * Los nombres se leen del registro de usuarios; aquí solo se referencia el id.
 */

/** Ilse Garcia (users.email = ilse.garcia@elektra.com.mx). */
const ILSE_GARCIA = 'cmt0bmib80000ws2sgq7uaocz'

export type ProjectReportOverride = {
  /** Usuario a mostrar como "Owner del proyecto" en lugar del owner registrado. */
  ownerUserId?: string
  /** Usuario a mostrar como "Responsable UIX". */
  uixResponsibleUserId?: string
  /** Estados que no se muestran; el total se calcula con los estados visibles. */
  hiddenStatuses?: FindingStatus[]
}

export const PROJECT_STATUS_REPORT: {
  /** Proyectos que, por ahora, no se muestran en el reporte. */
  hiddenProjectIds: string[]
  projects: Record<string, ProjectReportOverride>
  /** Foto por usuario (ruta pública). */
  userPhotos: Record<string, string>
} = {
  hiddenProjectIds: [
    'cmtrt4hem0001p72sv0i63ot5', // Mi negocio
    'cmtm2ivw70001352sy60wae64', // PWA del Asesor
  ],
  projects: {
    // PWA 2.0
    cmsoc6p7l0000h1acb6i9uoyt: {
      ownerUserId: ILSE_GARCIA,
      uixResponsibleUserId: ILSE_GARCIA,
      hiddenStatuses: ['TRIAGED'], // "Clasificado"
    },
  },
  userPhotos: {
    [ILSE_GARCIA]: '/images/team/ilse-garcia.webp',
  },
}
