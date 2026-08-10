import { getSession } from '@/lib/auth/lucia'
import { redirect } from 'next/navigation'
import { RBAC_PERMISSIONS } from '@/lib/middleware/rbac'
import { UserRole } from '@prisma/client'
import { AnalyticsService } from '@/lib/services/analytics'
import { AnalyticsQuerySchema } from '@/lib/validators/analytics-query'
import { Suspense } from 'react'
import { KPIGrid } from '@/components/analytics/KPIGrid'
import { TrendChart } from '@/components/analytics/TrendChart'
import { StatusBreakdownChart } from '@/components/analytics/StatusBreakdownChart'
import { DateRangeFilter } from '@/components/analytics/DateRangeFilter'
import { RecentActivityPanel } from '@/components/analytics/RecentActivityPanel'
import { SearchFindings } from '@/components/search/SearchFindings'

export const metadata = {
  title: 'Panel de Analíticas — Pruebas María 2.0',
}

export const dynamic = 'force-dynamic'

async function AnalyticsContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const params = await searchParams
  const parsed = AnalyticsQuerySchema.safeParse(params)

  const filters = parsed.success ? parsed.data : {}

  const [kpis, statusBreakdown, timeSeries] = await Promise.all([
    AnalyticsService.getKPIs(filters),
    AnalyticsService.getStatusBreakdown(filters),
    AnalyticsService.getTimeSeries(filters, filters.granularity),
  ])

  return (
    <>
      <div className="mb-6">
        <KPIGrid initialData={{ kpis }} filters={filters} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TrendChart data={timeSeries} />
        </div>
        <div>
          <StatusBreakdownChart data={statusBreakdown} />
        </div>
      </div>

      <div className="mt-6">
        <RecentActivityPanel limit={20} />
      </div>
    </>
  )
}

export default async function AnalyticsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const session = await getSession()

  if (!session?.user) {
    redirect('/login')
  }

  if (
    !RBAC_PERMISSIONS.VIEW_ANALYTICS.includes(session.user.role as UserRole)
  ) {
    redirect('/app.html')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Panel de Analíticas
          </h1>
          <p className="mt-1 text-gray-600">
            Métricas y tendencias de hallazgos en tiempo real
          </p>
        </div>

        <div className="mb-6 space-y-4">
          <SearchFindings />
          <DateRangeFilter />
        </div>

        <Suspense
          fallback={
            <div className="space-y-6">
              <div className="grid grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-32 animate-pulse rounded-lg bg-gray-200"
                  />
                ))}
              </div>
            </div>
          }
        >
          <AnalyticsContent searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  )
}
