import type { FindingStatus } from '@/lib/generated/prisma/client'

/**
 * Curación del reporte ejecutivo "Project Status / Estado de proyectos".
 *
 * Son decisiones de presentación explícitas, NO datos del registro: no modifican
 * proyectos, hallazgos ni usuarios en la base. Se indexan por id de BD (los mismos
 * de `/findings?project=<id>`); si un id no existe en otro entorno, no aplica nada.
 * Los nombres se leen del registro de usuarios; aquí solo se referencia el id, salvo
 * `userDisplayNames`, que fija el nombre completo a mostrar cuando el registro trae uno abreviado.
 */

/** Ilse Garcia (users.email = ilse.garcia@elektra.com.mx). */
const ILSE_GARCIA = 'cmt0bmib80000ws2sgq7uaocz'
/** Jonathan Ramos en el registro (users.email = jonathan.ramos@elektra.com.mx). */
const JONATHAN_RAMOS = 'cmt0bmacn0000wu2s5yp4i6xe'

export type ProjectReportOverride = {
  /** Usuario a mostrar como "Owner del proyecto" en lugar del owner registrado. */
  ownerUserId?: string
  /** Usuario a mostrar como "Responsable UIX". */
  uixResponsibleUserId?: string
  /** Estados que no se muestran; el total se calcula con los estados visibles. */
  hiddenStatuses?: FindingStatus[]
  /**
   * De dónde salen los estados de la tarjeta: `workflow` (por defecto) usa el estado del sistema;
   * `source` usa el estatus literal del archivo fuente (`findings.sourceStatus`, p. ej. el Excel ONGOING).
   */
  statusSource?: 'workflow' | 'source'
  /** Con `statusSource: 'source'`: orden de las leyendas. Los valores no listados van después, en orden alfabético. */
  sourceStatusOrder?: string[]
}

export const PROJECT_STATUS_REPORT: {
  /**
   * Únicos proyectos que se publican en el reporte (público), en el orden en que se presentan.
   * Es una lista blanca: un proyecto nuevo o no listado aquí nunca aparece.
   */
  visibleProjectIds: string[]
  projects: Record<string, ProjectReportOverride>
  /** Foto por usuario (ruta pública). */
  userPhotos: Record<string, string>
  /** Nombre a mostrar cuando difiere del registrado (p. ej. nombre completo). */
  userDisplayNames: Record<string, string>
} = {
  visibleProjectIds: [
    'cmsoc6p7l0000h1acb6i9uoyt', // PWA 2.0
  ],
  projects: {
    // PWA 2.0
    cmsoc6p7l0000h1acb6i9uoyt: {
      ownerUserId: ILSE_GARCIA,
      uixResponsibleUserId: JONATHAN_RAMOS,
      hiddenStatuses: ['TRIAGED', 'CLOSED'], // "Clasificado" y "Cerrado" quedan fuera del gráfico y del total.
    },
  },
  userPhotos: {
    [ILSE_GARCIA]: '/images/team/ilse-garcia.webp',
    [JONATHAN_RAMOS]: '/images/team/jonathan-ramos.webp',
  },
  userDisplayNames: {
    [JONATHAN_RAMOS]: 'Jonathan Daniel Ramos Segoviano',
  },
}
