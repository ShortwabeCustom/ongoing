/**
 * Ejecutor de scripts TypeScript del repositorio sin dependencias nuevas.
 * Usa `jiti` (ya presente en node_modules) y carga `.env` como hace la app.
 *
 *   node scripts/run-ts.cjs scripts/seed-users.ts [--rotate=email] [--revoke-sessions]
 */
require('dotenv/config')
const path = require('node:path')
const jitiMod = require('jiti')
const createJiti = jitiMod.createJiti || jitiMod
const root = path.resolve(__dirname, '..')
const jiti = createJiti(path.join(root, 'noop.cjs'), { alias: { '@': root } })

const target = process.argv[2]
if (!target) {
  console.error('Uso: node scripts/run-ts.cjs <script.ts> [args...]')
  process.exit(1)
}
process.argv = [process.argv[0], path.resolve(root, target), ...process.argv.slice(3)]
jiti(path.resolve(root, target))
