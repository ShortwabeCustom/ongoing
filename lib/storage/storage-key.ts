/**
 * Semántica de las claves de almacenamiento de evidencias.
 *
 * ADR-001 (P1-B) — D9 (legacy intacto y fuera del almacén privado).
 *
 * Módulo PURO y sin dependencias: no importa Prisma, ni `fs`, ni servicios.
 * Es la ÚNICA fuente de verdad sobre qué es una clave legacy, para que el
 * almacén privado, el servicio de evidencias y el reporte público apliquen
 * exactamente el mismo criterio.
 */

/** Prefijo que identifica el material histórico importado (D9). */
export const LEGACY_STORAGE_KEY_PREFIX = 'legacy/'

/**
 * ¿La clave pertenece al namespace legacy?
 *
 * Las claves de runtime tienen la forma `findings/{findingId}/{evidenceId}/{filename}`
 * y nunca empiezan por este prefijo.
 */
export function isLegacyStorageKey(storageKey: string): boolean {
  return storageKey.startsWith(LEGACY_STORAGE_KEY_PREFIX)
}
