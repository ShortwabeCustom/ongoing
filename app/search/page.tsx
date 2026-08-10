'use client'

import dynamic from 'next/dynamic'

const SearchFindings = dynamic(() => import('@/components/search/SearchFindings').then(mod => ({ default: mod.SearchFindings })), {
  loading: () => <div className="p-8">Cargando búsqueda...</div>,
  ssr: false
})

export default function SearchPage() {
  return <SearchFindings />
}
