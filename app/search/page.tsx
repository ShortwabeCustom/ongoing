import { AppShell } from '@/components/app/AppShell'
import { SearchFindings } from '@/components/search/SearchFindings'
import { getInventoryStats } from '@/lib/services/inventory-stats'
import { requirePageSession } from '@/lib/auth/page-guard'

export const dynamic = 'force-dynamic'

export default async function SearchPage() {
  await requirePageSession()

  const stats = await getInventoryStats()

  return (
    <AppShell
      current="search"
      eyebrow="Búsqueda avanzada"
      title="Explorar señales"
      description="Cruza estado, prioridad, responsable y evidencia para encontrar rápido los hallazgos que necesitan atención."
      stats={stats}
    >
      <section className="pm-card p-4 sm:p-5 lg:p-6">
        <SearchFindings presentation="panel" />
      </section>
    </AppShell>
  )
}
