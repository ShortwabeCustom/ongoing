'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { AlertTriangle, ArrowLeft, RotateCcw } from 'lucide-react'

type FindingDetailErrorProps = {
  error: Error & { digest?: string }
  retry: () => void
}

export default function FindingDetailError({ error, retry }: FindingDetailErrorProps) {
  useEffect(() => {
    console.error('Finding detail failed to render:', error)
  }, [error])

  return (
    <div className="pm-shell min-h-screen bg-[#f4f8f3] px-4 py-10 text-[#17251f]">
      <div className="mx-auto max-w-3xl rounded-lg border border-[#dbe4dd] bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#fff1ee] text-[#9b321f]">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-[#9b321f]">Detalle de hallazgo</p>
            <h1 className="mt-2 text-2xl font-semibold text-[#17251f]">
              No pudimos cargar este hallazgo
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#65766e]">
              La plataforma encontro un error temporal al abrir el detalle. Puedes reintentar la
              carga o volver al inventario para continuar trabajando.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={retry}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#052b20] px-4 text-sm font-semibold text-white transition hover:bg-[#0b3e30]"
              >
                <RotateCcw className="h-4 w-4" />
                Reintentar
              </button>
              <Link
                href="/findings"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#dbe4dd] bg-white px-4 text-sm font-semibold text-[#17251f] transition hover:border-[#052b20]"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver al inventario
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
