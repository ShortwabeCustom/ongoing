import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertTriangle, Search } from 'lucide-react'
import { getSession } from '@/lib/auth/lucia'
import { FindingService } from '@/lib/services/finding-service'
import { FindingDetailWithEvidence } from '@/components/finding/FindingDetailWithEvidence'
import { FindingStatusActions } from '@/components/finding/FindingStatusActions'
import { DeleteFindingButton } from '@/components/finding/DeleteFindingButton'
import { ActivityLog } from '@/components/finding/ActivityLog'
import { ResolutionWorkflow, ValidationCheckpoint, AuditTrailViewer } from '@/components/workflow'
import { AppShell } from '@/components/app/AppShell'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import {
  PRIORITY_LABELS_ES,
  STATUS_LABELS_ES,
} from '@/lib/constants/finding-options'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ id: string }>
}

function MissingFindingDetail() {
  return (
    <AppShell
      current="findings"
      eyebrow="Detalle de hallazgo"
      title="Hallazgo no encontrado"
      description="El hallazgo que intentas abrir no existe, fue eliminado o ya no esta disponible en este inventario."
      stats={[
        { label: 'Estado', value: 'No disponible', tone: 'amber' },
        { label: 'Inventario', value: 'Disponible', tone: 'mint' },
      ]}
      actions={
        <Link
          href="/findings"
          className="inline-flex h-10 items-center rounded-full bg-white px-4 text-sm font-semibold text-[#052b20] transition hover:bg-[#7bf0b1]"
        >
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

export default async function FindingDetailPage({ params }: PageProps) {
  const session = await getSession()
  if (!session?.user) redirect('/login')

  const { id } = await params
  const finding = await FindingService.getFindingWithSignedUrls(id)

  if (!finding || finding.deletedAt) {
    return <MissingFindingDetail />
  }

  const detailTitle = finding.folio ?? 'Hallazgo'
  const evidenceCount = finding.evidence?.length ?? 0
  const commentsCount = finding.comments?.length ?? 0
  const workflowCount = (finding.resolutions?.length ?? 0) + (finding.validations?.length ?? 0)

  return (
    <AppShell
      current="findings"
      eyebrow="Detalle de hallazgo"
      title={detailTitle}
      description={finding.observation}
      stats={[
        { label: 'Estado', value: STATUS_LABELS_ES[finding.status] ?? finding.status, tone: 'mint' },
        { label: 'Prioridad', value: PRIORITY_LABELS_ES[finding.priority] ?? finding.priority, tone: 'amber' },
        { label: 'Evidencias', value: evidenceCount, tone: 'coral' },
        { label: 'Workflow', value: workflowCount + commentsCount, tone: 'white' },
      ]}
      actions={
        <>
          <Link
            href="/findings"
            className="inline-flex h-10 items-center rounded-full bg-white px-4 text-sm font-semibold text-[#052b20] transition hover:bg-[#7bf0b1]"
          >
            Volver al inventario
          </Link>
          <FindingStatusActions
            findingId={finding.id}
            status={finding.status}
            version={finding.version}
          />
          {['OWNER', 'QA_LEAD'].includes(session.user.role) && (
            <DeleteFindingButton
              findingId={finding.id}
              observation={finding.observation}
            />
          )}
        </>
      }
    >
      <div className="space-y-6">
        <FindingDetailWithEvidence finding={finding as any} />

        <section className="pm-card p-6 md:p-8">
          <h2 className="mb-4 text-xl font-bold text-[#17251f]">📋 Historial de actividades</h2>
          <ActivityLog findingId={finding.id} />
        </section>

        <section className="pm-card p-6 md:p-8">
          <ResolutionWorkflow finding={finding as any} />
        </section>

        <section className="pm-card p-6 md:p-8">
          <ValidationCheckpoint finding={finding as any} />
        </section>

        {/*
          C-01: el visor de auditoría lleva su propio límite de error. Antes, un
          fallo de render aquí subía hasta `app/findings/[id]/error.tsx` y dejaba
          el hallazgo entero inaccesible; ahora degrada sólo esta tarjeta.
        */}
        <section className="pm-card p-6 md:p-8">
          <ErrorBoundary
            title="Auditoría"
            message="No pudimos mostrar el historial de auditoría de este hallazgo. El resto del detalle sigue disponible."
          >
            <AuditTrailViewer findingId={finding.id} compact />
          </ErrorBoundary>
        </section>
      </div>
    </AppShell>
  )
}
