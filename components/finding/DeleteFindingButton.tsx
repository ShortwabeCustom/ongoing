'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

type DeleteFindingButtonProps = {
  findingId: string
  observation: string
}

export function DeleteFindingButton({ findingId, observation }: DeleteFindingButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)

    try {
      const response = await fetch(`/api/findings/${findingId}`, { method: 'DELETE' })

      if (!response.ok) {
        throw new Error(
          response.status === 403
            ? 'No tienes permiso para eliminar este hallazgo.'
            : 'No se pudo eliminar el hallazgo. Inténtalo nuevamente.',
        )
      }

      router.push('/findings')
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo eliminar el hallazgo.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null)
          setOpen(true)
        }}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-[#ff8a73] bg-transparent px-4 text-sm font-semibold text-[#ff8a73] transition hover:bg-[#ff8a73]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8a73]"
      >
        <Trash2 className="h-4 w-4" />
        Eliminar hallazgo
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-finding-title"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 text-[#17251f] shadow-2xl">
            <h2 id="delete-finding-title" className="text-xl font-semibold">
              Eliminar hallazgo
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#65766e]">
              El hallazgo dejará de aparecer en el inventario y las vistas activas. Esta acción
              quedará registrada en la auditoría.
            </p>
            <p className="mt-3 line-clamp-2 rounded-lg bg-[#f7faf5] p-3 text-sm font-medium">
              {observation}
            </p>

            {error && (
              <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setOpen(false)}
                className="min-h-11 rounded-lg border border-[#dbe4dd] px-4 text-sm font-semibold disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="min-h-11 rounded-lg bg-[#c9342f] px-4 text-sm font-semibold text-white transition hover:bg-[#a92824] disabled:opacity-50"
              >
                {deleting ? 'Eliminando...' : 'Eliminar hallazgo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
