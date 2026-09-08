/**
 * Alta única: usuario Juan Eizaguirre + creación del proyecto "Mi negocio".
 *
 * La contraseña se lee SIEMPRE de variable de entorno (C-06), nunca hardcodeada
 * ni impresa por este script.
 *
 * Uso:
 *   JUAN_PASSWORD='...' node scripts/run-ts.cjs scripts/create-mi-negocio-project.ts
 */
import { getDb } from '../lib/db-lazy'
import { hashPassword } from '../lib/auth/password'
import { ProjectService } from '../lib/services/project-service'

const EMAIL = 'juan.eizaguirre@elektra.com.mx'
const NAME = 'Juan Eizaguirre'
// Rol global bajo (NO 'OWNER'): el rol global OWNER actúa como super-admin y
// ve todos los proyectos de la plataforma (ver projectAccessWhere en
// lib/services/project-service.ts). Un usuario dedicado a un solo proyecto
// debe quedar scoped a ese proyecto vía ProjectMember, no vía rol global.
const GLOBAL_ROLE = 'VIEWER'
const PROJECT_MEMBER_ROLE = 'OWNER'
const PROJECT_NAME = 'Mi negocio'

function readRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value?.trim()) {
    throw new Error(`${name} environment variable is required`)
  }
  return value.trim()
}

async function main() {
  const db = getDb()
  const password = readRequiredEnv('JUAN_PASSWORD')

  let user = await db.user.findUnique({ where: { email: EMAIL } })

  if (user) {
    console.log(`Usuario ya existe: ${user.email} (${user.id}), no se modifica.`)
  } else {
    const passwordHash = await hashPassword(password)
    user = await db.user.create({
      data: {
        email: EMAIL,
        name: NAME,
        passwordHash,
        role: GLOBAL_ROLE,
      },
    })
    console.log(`Usuario creado: ${user.email} (${user.id}), rol global: ${user.role}`)
  }

  const existingProject = await db.project.findFirst({
    where: { name: PROJECT_NAME, deletedAt: null },
  })

  if (existingProject) {
    console.log(`Proyecto ya existe: ${existingProject.name} (${existingProject.id}), no se crea de nuevo.`)
    const membership = await db.projectMember.findUnique({
      where: { projectId_userId: { projectId: existingProject.id, userId: user.id } },
    })
    if (!membership) {
      await db.projectMember.create({
        data: { projectId: existingProject.id, userId: user.id, role: PROJECT_MEMBER_ROLE },
      })
      console.log(`Membresía añadida: ${user.email} -> ${existingProject.name}`)
    }
    return
  }

  const project = await ProjectService.createProject({ name: PROJECT_NAME }, user.id)
  console.log(`Proyecto creado: ${project.name} (${project.id}), owner: ${user.email}`)
}

main()
  .catch((error) => {
    console.error('Error:', error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
  .finally(async () => {
    await getDb().$disconnect()
  })
