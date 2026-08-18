/**
 * Utilidades para crear roots de almacén válidos en los tests.
 *
 * ADR-001 D1 prohíbe que el root esté dentro del repositorio, de
 * `process.cwd()`, del árbol de build, de `/tmp` o de `/var/tmp`. Eso descarta
 * `os.tmpdir()` como ubicación de los roots VÁLIDOS: en Linux es exactamente
 * `/tmp`, que la validación rechaza —correctamente—.
 *
 * Por eso los roots de prueba se crean como hermanos del workspace: fuera del
 * repo, fuera de cwd, fuera de public/.next y fuera de los temporales del
 * sistema. Nunca se toca ningún directorio real de evidencias.
 *
 * AISLAMIENTO: vitest ejecuta los ficheros de test en paralelo. Cada módulo que
 * importe este helper obtiene su PROPIO contenedor, de modo que la limpieza de
 * un fichero no puede borrar los roots que otro está usando.
 */

import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import path from 'node:path'

const BASE = path.join(path.dirname(process.cwd()), '.p1b-storage-test-roots')

/** Contenedor exclusivo de este módulo (único por proceso e import). */
const CONTAINER = path.join(BASE, `${process.pid}-${randomBytes(4).toString('hex')}`)

const created: string[] = []

function ensureContainer(): void {
  if (!existsSync(CONTAINER)) {
    mkdirSync(CONTAINER, { recursive: true, mode: 0o700 })
  }
}

/**
 * Crea un directorio de prueba fuera de todas las zonas prohibidas.
 * `mode` por defecto 0700, el que exige D15.
 */
export function makeValidRoot(mode = 0o700): string {
  ensureContainer()
  const dir = mkdtempSync(path.join(CONTAINER, 'root-'))
  // mkdtemp aplica 0700, pero lo fijamos explícitamente para ser deterministas
  // frente al umask (misma razón que D15).
  chmodSync(dir, mode)
  created.push(dir)
  return dir
}

/** Devuelve una ruta dentro del contenedor que NO existe. */
export function makeMissingPath(): string {
  ensureContainer()
  return path.join(CONTAINER, `missing-${randomBytes(6).toString('hex')}`)
}

/** Borra únicamente lo creado por ESTE módulo. */
export function cleanupRoots(): void {
  for (const dir of created.splice(0)) {
    // Restaurar permisos por si algún test los dejó restrictivos.
    try {
      chmodSync(dir, 0o700)
    } catch {
      /* el directorio puede haber sido eliminado por el propio test */
    }
    rmSync(dir, { recursive: true, force: true })
  }
  rmSync(CONTAINER, { recursive: true, force: true })
  // El directorio BASE compartido NUNCA se borra ni se chmodea: otros ficheros
  // de test pueden estar usándolo en paralelo. Cada módulo limpia solo lo suyo.
}
