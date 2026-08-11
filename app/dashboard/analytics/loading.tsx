import { AppShell } from '@/components/app/AppShell'

export default function Loading() {
  return (
    <AppShell
      current="analytics"
      eyebrow="Analíticas"
      title="Panel de control"
      description="Indicadores operativos del inventario, tendencias y actividad reciente."
      stats={[
        { label: 'Hallazgos', value: '-', tone: 'mint' },
        { label: 'Pendientes', value: '-', tone: 'amber' },
        { label: 'Resueltos', value: '-', tone: 'white' },
        { label: 'Evidencias', value: '-', tone: 'coral' },
      ]}
    >
      <div className="space-y-6">
        <div className="pm-card p-4">
          <div className="h-4 w-32 animate-pulse rounded bg-[#dbe4dd]" />
          <div className="mt-4 flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-9 w-24 animate-pulse rounded-full bg-[#edf4ed]"
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="pm-card h-32 animate-pulse bg-white"
            />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="pm-card h-96 animate-pulse bg-white lg:col-span-2" />
          <div className="pm-card h-96 animate-pulse bg-white" />
        </div>
      </div>
    </AppShell>
  )
}
