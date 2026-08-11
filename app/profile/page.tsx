import { redirect } from 'next/navigation'
import { AppShell } from '@/components/app/AppShell'
import { ProfileSettings } from '@/components/auth/ProfileSettings'
import { getSession } from '@/lib/auth/lucia'

export const metadata = {
  title: 'Mi perfil — Pruebas María 2.0',
}

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const session = await getSession()

  if (!session?.user) {
    redirect('/login')
  }

  const user = {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
  }

  return (
    <AppShell
      eyebrow="Perfil"
      title="Mi perfil"
      description="Datos de cuenta, rol operativo y credenciales de acceso para Pruebas María 2.0."
      stats={[
        { label: 'Rol', value: user.role, tone: 'mint' },
        { label: 'Estado', value: 'Activa', tone: 'white' },
        { label: 'Sesión', value: 'Online', tone: 'amber' },
        { label: 'ID', value: user.id.slice(0, 8), tone: 'coral' },
      ]}
    >
      <ProfileSettings user={user} />
    </AppShell>
  )
}
