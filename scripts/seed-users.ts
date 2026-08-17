/**
 * Alta y rotación de cuentas — SIN credenciales en el código (C-06).
 *
 * Las contraseñas se leen SIEMPRE de variables de entorno. Nunca se imprimen.
 *
 * Uso
 * ---
 *   # Ejecutor: scripts/run-ts.cjs (usa jiti + dotenv, ya presentes; no instala nada).
 *
 *   # 1) Alta de cuentas que aún no existen (NO toca las existentes):
 *   SEED_OWNER_PASSWORD='...' node scripts/run-ts.cjs scripts/seed-users.ts
 *
 *   # 2) Rotación explícita de UNA cuenta ya existente (cambia passwordHash):
 *   SEED_OWNER_PASSWORD='...' node scripts/run-ts.cjs scripts/seed-users.ts \
 *       --rotate=alexis.pro_sk8@hotmail.com
 *
 *   # 3) Rotación + cierre de todas las sesiones abiertas de esa cuenta:
 *   SEED_OWNER_PASSWORD='...' node scripts/run-ts.cjs scripts/seed-users.ts \
 *       --rotate=alexis.pro_sk8@hotmail.com --revoke-sessions
 *
 * Garantías de seguridad
 * ----------------------
 * - Ninguna contraseña literal vive en el repositorio.
 * - Sin `--rotate`, una cuenta existente NUNCA ve modificados su `passwordHash` ni su
 *   `role`: el `upsert` original hacía `update: { passwordHash, role }` y cualquier
 *   ejecución accidental reseteaba las cuentas reales de producción.
 * - `--rotate` sólo afecta a los emails indicados explícitamente, y sólo al
 *   `passwordHash` (nunca al `role`).
 * - Si falta la variable de entorno de una cuenta, esa cuenta se omite con un aviso
 *   claro; si no se puede hacer nada útil, el script termina con código 1.
 * - La contraseña se valida con `validatePasswordStrength` antes de aplicarse.
 * - Ninguna contraseña se escribe en stdout, stderr ni en ningún fichero.
 */

import { prisma } from '@/lib/prisma'
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password'

type SeedAccount = {
  email: string
  name: string
  role: 'OWNER' | 'QA_LEAD' | 'DESIGNER' | 'DEVELOPER' | 'BUSINESS_REVIEWER' | 'VIEWER'
  /** Variable de entorno de la que se lee la contraseña. */
  passwordEnv: string
}

const ACCOUNTS: SeedAccount[] = [
  {
    email: 'alexis.pro_sk8@hotmail.com',
    name: 'Alexis',
    role: 'OWNER',
    passwordEnv: 'SEED_OWNER_PASSWORD',
  },
  {
    email: 'ilse.garcia@elektra.com.mx',
    name: 'Ilse García (Elektra)',
    role: 'QA_LEAD',
    passwordEnv: 'SEED_QA_LEAD_PASSWORD',
  },
  {
    email: 'jonathan.ramos@elektra.com.mx',
    name: 'Jonathan Ramos (Elektra)',
    role: 'DEVELOPER',
    passwordEnv: 'SEED_DEVELOPER_PASSWORD',
  },
]

function parseArgs(argv: string[]) {
  const rotate = new Set<string>()
  let revokeSessions = false

  for (const arg of argv) {
    if (arg.startsWith('--rotate=')) {
      arg
        .slice('--rotate='.length)
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
        .forEach((email) => rotate.add(email))
    } else if (arg === '--revoke-sessions') {
      revokeSessions = true
    } else if (arg === '--help' || arg === '-h') {
      console.log(
        [
          'Uso: node scripts/run-ts.cjs scripts/seed-users.ts [--rotate=email[,email]] [--revoke-sessions]',
          '',
          'Contraseñas por variable de entorno:',
          ...ACCOUNTS.map((a) => `  ${a.passwordEnv.padEnd(26)} -> ${a.email} (${a.role})`),
          '',
          'Sin --rotate no se modifica ninguna cuenta existente.',
        ].join('\n'),
      )
      process.exit(0)
    }
  }

  return { rotate, revokeSessions }
}

async function main() {
  const { rotate, revokeSessions } = parseArgs(process.argv.slice(2))
  const db = prisma()

  if (revokeSessions && rotate.size === 0) {
    console.error('❌ --revoke-sessions requiere --rotate=<email>. Nada que hacer.')
    process.exitCode = 1
    return
  }

  const unknownRotations = [...rotate].filter(
    (email) => !ACCOUNTS.some((account) => account.email.toLowerCase() === email),
  )
  if (unknownRotations.length > 0) {
    console.error(`❌ --rotate incluye emails que no están en la lista: ${unknownRotations.join(', ')}`)
    process.exitCode = 1
    return
  }

  console.log('🌱 Aprovisionamiento de cuentas (sin credenciales en el código)')
  console.log(`   Modo: ${rotate.size > 0 ? `ROTACIÓN explícita de ${rotate.size} cuenta(s)` : 'ALTA (no modifica cuentas existentes)'}`)

  let created = 0
  let rotated = 0
  let skipped = 0
  let failed = 0

  for (const account of ACCOUNTS) {
    const shouldRotate = rotate.has(account.email.toLowerCase())
    const existing = await db.user.findUnique({
      where: { email: account.email },
      select: { id: true, role: true },
    })

    if (existing && !shouldRotate) {
      console.log(`↷ ${account.email}: ya existe, se deja intacta (usa --rotate=${account.email} para cambiar su contraseña)`)
      skipped++
      continue
    }

    const password = process.env[account.passwordEnv]
    if (!password) {
      console.error(
        `⚠️  ${account.email}: falta la variable ${account.passwordEnv}. Cuenta omitida.`,
      )
      skipped++
      continue
    }

    const strength = validatePasswordStrength(password)
    if (!strength.valid) {
      console.error(
        `❌ ${account.email}: la contraseña de ${account.passwordEnv} no cumple los requisitos: ${strength.errors.join('; ')}`,
      )
      failed++
      continue
    }

    try {
      const passwordHash = await hashPassword(password)

      if (existing) {
        // Rotación explícita: sólo el hash. El rol NUNCA se toca aquí.
        await db.user.update({
          where: { email: account.email },
          data: { passwordHash },
        })
        console.log(`🔑 ${account.email}: contraseña rotada (rol sin cambios: ${existing.role})`)
        rotated++

        if (revokeSessions) {
          const { count } = await db.session.deleteMany({ where: { userId: existing.id } })
          console.log(`   ↳ sesiones invalidadas: ${count}`)
        }
      } else {
        await db.user.create({
          data: {
            email: account.email,
            name: account.name,
            role: account.role,
            passwordHash,
          },
        })
        console.log(`✅ ${account.email}: creada con rol ${account.role}`)
        created++
      }
    } catch (error) {
      console.error(`❌ ${account.email}: fallo al aprovisionar:`, error)
      failed++
    }
  }

  console.log(
    `\nResumen — creadas: ${created} · rotadas: ${rotated} · omitidas: ${skipped} · con error: ${failed}`,
  )
  console.log('Las contraseñas no se imprimen nunca; entrégalas por un canal seguro.')

  if (failed > 0) {
    process.exitCode = 1
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    const db = prisma()
    await db.$disconnect()
  })
