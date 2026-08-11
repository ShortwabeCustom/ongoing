import { SearchFindings } from '@/components/search/SearchFindings'
import { Suspense } from 'react'
import { AppShell } from '@/components/app/AppShell'
import { getInventoryStats } from '@/lib/services/inventory-stats'

export const dynamic = 'force-dynamic'

function FindingsLoading() {
  return (
    <div className="pm-card flex min-h-72 items-center justify-center">
      <div className="text-sm font-medium text-[#65766e]">Cargando inventario...</div>
    </div>
  )
}

export default async function FindingsPage() {
  const stats = await getInventoryStats()

  return (
    <AppShell
      current="findings"
      eyebrow="Inventario dinámico"
      title="Hallazgos y evidencia"
      description="Un tablero operativo para revisar observaciones, filtrar prioridades y abrir cada hallazgo con su contexto visual."
      stats={stats}
    >
      <section className="pm-card p-4 sm:p-5 lg:p-6">
        <Suspense fallback={<FindingsLoading />}>
          <SearchFindings presentation="panel" />
        </Suspense>
      </section>
    </AppShell>
  )
}
