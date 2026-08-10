'use client'

import { SearchFindings } from '@/components/search/SearchFindings'
import { Suspense } from 'react'

function FindingsLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-slate-500">Cargando...</div>
    </div>
  )
}

export default function FindingsPage() {
  return (
    <Suspense fallback={<FindingsLoading />}>
      <SearchFindings />
    </Suspense>
  )
}
