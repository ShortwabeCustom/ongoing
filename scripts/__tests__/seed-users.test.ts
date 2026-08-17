import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const seedMocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  deleteMany: vi.fn(),
  disconnect: vi.fn(),
  hashPassword: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: () => ({
    user: {
      findUnique: seedMocks.findUnique,
      update: seedMocks.update,
      create: seedMocks.create,
    },
    session: { deleteMany: seedMocks.deleteMany },
    $disconnect: seedMocks.disconnect,
  }),
}))

vi.mock('@/lib/auth/password', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/password')>(
    '@/lib/auth/password',
  )
  return {
    hashPassword: seedMocks.hashPassword,
    validatePasswordStrength: actual.validatePasswordStrength,
  }
})

const OWNER_EMAIL = 'alexis.pro_sk8@hotmail.com'
const QA_EMAIL = 'ilse.garcia@elektra.com.mx'
const STRONG = 'Prueba-Contrasena-9'
const WEAK = 'todominusculas'

const ENV_KEYS = ['SEED_OWNER_PASSWORD', 'SEED_QA_LEAD_PASSWORD', 'SEED_DEVELOPER_PASSWORD']

let output: string[] = []
let argv: string[]

async function runSeed(args: string[] = []) {
  process.argv = ['node', 'scripts/seed-users.ts', ...args]
  vi.resetModules()
  await import('../seed-users')
  // el script ejecuta main() al importarse; se deja drenar la cadena de promesas
  await new Promise((resolve) => setTimeout(resolve, 30))
}

describe('scripts/seed-users.ts — sin credenciales en el código (C-06)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    argv = process.argv
    output = []
    vi.spyOn(console, 'log').mockImplementation((...a: any[]) => { output.push(a.join(' ')) })
    vi.spyOn(console, 'error').mockImplementation((...a: any[]) => { output.push(a.join(' ')) })
    ENV_KEYS.forEach((k) => delete process.env[k])
    seedMocks.hashPassword.mockResolvedValue('$argon2id$fake')
    seedMocks.findUnique.mockResolvedValue(null)
    seedMocks.deleteMany.mockResolvedValue({ count: 0 })
    process.exitCode = undefined
  })

  afterEach(() => {
    vi.restoreAllMocks()
    ENV_KEYS.forEach((k) => delete process.env[k])
    process.argv = argv
    process.exitCode = undefined
  })

  it('no contiene ninguna contraseña literal en el fuente', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'scripts/seed-users.ts'),
      'utf8',
    )
    // Ninguna propiedad `password:` con un literal de cadena
    expect(src).not.toMatch(/password:\s*['"][^'"]+['"]/)
    expect(src).toContain('process.env[account.passwordEnv]')
  })

  it('sin variables de entorno no crea ni modifica ninguna cuenta', async () => {
    await runSeed()

    expect(seedMocks.create).not.toHaveBeenCalled()
    expect(seedMocks.update).not.toHaveBeenCalled()
    expect(output.join('\n')).toMatch(/falta la variable SEED_/)
  })

  it('crea sólo las cuentas que no existen y para las que hay contraseña', async () => {
    process.env.SEED_QA_LEAD_PASSWORD = STRONG

    await runSeed()

    expect(seedMocks.create).toHaveBeenCalledTimes(1)
    expect(seedMocks.create.mock.calls[0][0].data).toMatchObject({
      email: QA_EMAIL,
      role: 'QA_LEAD',
      passwordHash: '$argon2id$fake',
    })
    expect(seedMocks.update).not.toHaveBeenCalled()
  })

  // El script anterior hacía `upsert(update: { passwordHash, role })`:
  // cualquier ejecución reseteaba la contraseña y el rol del OWNER real.
  it('NO toca una cuenta existente si no se pide --rotate explícitamente', async () => {
    seedMocks.findUnique.mockResolvedValue({ id: 'u1', role: 'OWNER' })
    process.env.SEED_OWNER_PASSWORD = STRONG
    process.env.SEED_QA_LEAD_PASSWORD = STRONG
    process.env.SEED_DEVELOPER_PASSWORD = STRONG

    await runSeed()

    expect(seedMocks.update).not.toHaveBeenCalled()
    expect(seedMocks.create).not.toHaveBeenCalled()
    expect(seedMocks.deleteMany).not.toHaveBeenCalled()
    expect(output.join('\n')).toMatch(/ya existe, se deja intacta/)
  })

  it('con --rotate cambia sólo el passwordHash de esa cuenta, nunca el rol', async () => {
    seedMocks.findUnique.mockImplementation(async ({ where }: any) =>
      where.email === OWNER_EMAIL ? { id: 'u1', role: 'OWNER' } : null,
    )
    process.env.SEED_OWNER_PASSWORD = STRONG

    await runSeed([`--rotate=${OWNER_EMAIL}`])

    expect(seedMocks.update).toHaveBeenCalledTimes(1)
    const call = seedMocks.update.mock.calls[0][0]
    expect(call.where).toEqual({ email: OWNER_EMAIL })
    expect(Object.keys(call.data)).toEqual(['passwordHash'])
    expect(call.data).not.toHaveProperty('role')
  })

  it('--revoke-sessions invalida las sesiones abiertas de la cuenta rotada', async () => {
    seedMocks.findUnique.mockImplementation(async ({ where }: any) =>
      where.email === OWNER_EMAIL ? { id: 'u1', role: 'OWNER' } : null,
    )
    seedMocks.deleteMany.mockResolvedValue({ count: 3 })
    process.env.SEED_OWNER_PASSWORD = STRONG

    await runSeed([`--rotate=${OWNER_EMAIL}`, '--revoke-sessions'])

    expect(seedMocks.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } })
    expect(output.join('\n')).toMatch(/sesiones invalidadas: 3/)
  })

  it('--revoke-sessions sin --rotate no hace nada y sale con error', async () => {
    await runSeed(['--revoke-sessions'])

    expect(seedMocks.update).not.toHaveBeenCalled()
    expect(seedMocks.deleteMany).not.toHaveBeenCalled()
    expect(process.exitCode).toBe(1)
  })

  it('rechaza contraseñas débiles sin escribir nada', async () => {
    process.env.SEED_QA_LEAD_PASSWORD = WEAK

    await runSeed()

    expect(seedMocks.create).not.toHaveBeenCalled()
    expect(seedMocks.update).not.toHaveBeenCalled()
    expect(process.exitCode).toBe(1)
  })

  it('nunca imprime la contraseña por consola', async () => {
    seedMocks.findUnique.mockResolvedValue(null)
    process.env.SEED_QA_LEAD_PASSWORD = STRONG

    await runSeed()

    expect(output.join('\n')).not.toContain(STRONG)
  })
})
