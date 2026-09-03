/**
 * Alta única: usuario dedicado a "PWA del Asesor" + creación del proyecto.
 *
 * La contraseña se lee SIEMPRE de variable de entorno (C-06), nunca hardcodeada
 * ni impresa por este script.
 *
 * Uso:
 *   LORENA_PASSWORD='...' node scripts/run-ts.cjs scripts/create-pwa-asesor-project.ts
 */
import { getDb } from '../lib/db-lazy'
import { hashPassword } from '../lib/auth/password'
import { ProjectService } from '../lib/services/project-service'

const EMAIL = 'lorena.ruiz@elektra.com.mx'
const NAME = 'Lorena Ruiz Valdez'
const GLOBAL_ROLE = 'QA_LEAD'
const PROJECT_NAME = 'PWA del Asesor'

function readRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value?.trim()) {
    throw new Error(`${name} environment variable is required`)
  }
  return value.trim()
}

async function main() {
  const db = getDb()
  const password = readRequiredEnv('LORENA_PASSWORD')

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

  const existingMembershipInOtherProjects = await db.projectMember.findMany({
    where: { userId: user.id },
    include: { project: { select: { name: true } } },
  })
  if (existingMembershipInOtherProjects.length > 0) {
    console.log(
      'ADVERTENCIA: el usuario ya es miembro de:',
      existingMembershipInOtherProjects.map((m) => m.project.name).join(', '),
    )
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
        data: { projectId: existingProject.id, userId: user.id, role: GLOBAL_ROLE },
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
