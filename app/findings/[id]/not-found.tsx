import Link from 'next/link'
import { AlertTriangle, ArrowLeft, Search } from 'lucide-react'
import { AppShell } from '@/components/app/AppShell'

export default function FindingNotFound() {
  return (
    <AppShell
      current="findings"
      eyebrow="Detalle de hallazgo"
      title="Hallazgo no encontrado"
      description="El hallazgo que intentas abrir no existe, fue eliminado o ya no esta disponible en este inventario."
      stats={[
        { label: 'Estado', value: 'No disponible', tone: 'amber' },
        { label: 'Accion sugerida', value: 'Volver', tone: 'mint' },
      ]}
      actions={
        <Link
          href="/findings"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-[#052b20] transition hover:bg-[#7bf0b1]"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al inventario
        </Link>
      }
    >
      <section className="pm-card p-6 md:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#fff6de] text-[#8a5a00]">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-[#17251f]">
              No pudimos cargar este hallazgo
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-[#65766e]">
              Puede ser un enlace anterior, un registro removido o un resultado que ya no coincide
              con la base actual. El inventario sigue disponible para buscar el hallazgo correcto.
            </p>
            <Link
              href="/findings"
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-[#052b20] px-4 text-sm font-semibold text-white transition hover:bg-[#0b3e30]"
            >
              <Search className="h-4 w-4" />
              Buscar en hallazgos
            </Link>
          </div>
        </div>
      </section>
    </AppShell>
  )
}
