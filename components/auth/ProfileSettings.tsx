'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, IdCard, LockKeyhole, Mail, Save, UserRound } from 'lucide-react'

type ProfileUser = {
  id: string
  email: string
  name: string
  role: string
}

type ProfileSettingsProps = {
  user: ProfileUser
}

export function ProfileSettings({ user }: ProfileSettingsProps) {
  const router = useRouter()
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [password, setPassword] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    setMessage(null)
    setError(null)

    const payload: Record<string, string> = {}
    if (name.trim() !== user.name) payload.name = name.trim()
    if (email.trim() !== user.email) payload.email = email.trim()
    if (password.trim()) payload.password = password

    if (Object.keys(payload).length === 0) {
      setMessage('No hay cambios pendientes')
      setIsSaving(false)
      return
    }

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message ?? 'No se pudo actualizar el perfil')
      }

      setPassword('')
      setMessage('Perfil actualizado correctamente')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el perfil')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="pm-card h-fit p-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[#052b20] text-xl font-bold text-[#7bf0b1]">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <h2 className="mt-4 text-xl font-semibold text-[#17251f]">{user.name}</h2>
        <p className="mt-1 truncate text-sm text-[#65766e]">{user.email}</p>
        <span className="mt-4 inline-flex rounded-full bg-[#e0f5e9] px-3 py-1 text-xs font-semibold text-[#087244]">
          {user.role}
        </span>

        <div className="mt-5 space-y-3 border-t border-[#dbe4dd] pt-5 text-sm">
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-[#00a85a]" />
            <span className="truncate text-[#3d4d45]">{user.email}</span>
          </div>
          <div className="flex items-center gap-3">
            <IdCard className="h-4 w-4 text-[#00a85a]" />
            <code className="truncate text-xs text-[#65766e]">{user.id}</code>
          </div>
        </div>
      </aside>

      <form onSubmit={handleSubmit} className="pm-card overflow-hidden">
        <div className="border-b border-[#dbe4dd] bg-white px-5 py-4">
          <p className="text-xs font-semibold uppercase text-[#00a85a]">Cuenta</p>
          <h2 className="mt-1 text-xl font-semibold text-[#17251f]">Datos del perfil</h2>
        </div>

        <div className="grid gap-5 p-5">
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#3d4d45]">
              <UserRound className="h-4 w-4" />
              Nombre
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="pm-input h-11 w-full text-sm focus:outline-none focus:ring-2 focus:ring-[#00a85a]"
              autoComplete="name"
            />
          </label>

          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#3d4d45]">
              <Mail className="h-4 w-4" />
              Email
            </span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="pm-input h-11 w-full text-sm focus:outline-none focus:ring-2 focus:ring-[#00a85a]"
              type="email"
              autoComplete="email"
            />
          </label>

          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#3d4d45]">
              <LockKeyhole className="h-4 w-4" />
              Nueva contraseña
            </span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="pm-input h-11 w-full text-sm focus:outline-none focus:ring-2 focus:ring-[#00a85a]"
              type="password"
              autoComplete="new-password"
              placeholder="Dejar vacío para conservar la actual"
            />
          </label>

          {message && (
            <div className="flex items-center gap-2 rounded-lg border border-[#bfeccc] bg-[#eefbf2] p-3 text-sm font-medium text-[#0b5d38]">
              <CheckCircle2 className="h-4 w-4" />
              {message}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-[#f6b5aa] bg-[#fff1ee] p-3 text-sm font-medium text-[#9b321f]">
              {error}
            </div>
          )}

          <div className="flex justify-end border-t border-[#dbe4dd] pt-5">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-[#052b20] px-5 text-sm font-semibold text-white transition hover:bg-[#0b3e30] disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
