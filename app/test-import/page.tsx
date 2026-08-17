import { AppShell } from '@/components/app/AppShell'
import { TestImportWorkspace } from '@/components/features/import/TestImportWorkspace'
import { getInventoryStats } from '@/lib/services/inventory-stats'
import { requirePageSession } from '@/lib/auth/page-guard'

export const dynamic = 'force-dynamic'

export default async function TestImportPage() {
  await requirePageSession()

  const stats = await getInventoryStats()

  return (
    <AppShell
      current="import"
      eyebrow="Importación"
      title="Carga histórica"
      description="Validación previa de archivos CSV y XLSX para incorporar hallazgos al inventario."
      stats={stats}
    >
      <TestImportWorkspace />
    </AppShell>
  )
}
