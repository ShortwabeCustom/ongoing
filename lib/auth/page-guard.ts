import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/lucia'

/**
 * Guardia de autenticación para páginas (Server Components).
 *
 * C-03: `/findings`, `/search`, `/test-import` y `/dashboard/analytics` se servían
 * completas a usuarios anónimos. Este helper centraliza el patrón que ya usaban
 * correctamente `/profile` y `/findings/[id]`:
 *
 *     const session = await getSession()
 *     if (!session?.user) redirect('/login')
 *
 * Es la comprobación AUTORITATIVA (valida la sesión contra la base de datos).
 * El filtro de `proxy.ts` es solo una barrera previa y optimista basada en la
 * presencia de la cookie; nunca sustituye a esta llamada.
 */
export async function requirePageSession() {
  const session = await getSession()

  if (!session?.user) {
    redirect('/login')
  }

  return session.user
}
