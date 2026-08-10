'use client'

import { useState, useRef, useEffect } from 'react'
import { useSearch } from '@/lib/hooks/useSearch'
import { SearchResultItem } from './SearchResultItem'
import { Search, X } from 'lucide-react'

export function SearchFindings() {
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [priorityFilter, setPriorityFilter] = useState<string[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, error, isFallback } = useSearch({
    q: searchTerm,
    status: statusFilter.length > 0 ? statusFilter : undefined,
    priority: priorityFilter.length > 0 ? priorityFilter : undefined,
    limit: 10,
  })

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const hasResults = data && data.items.length > 0
  const showDropdown = isOpen && (isLoading || hasResults || error)

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar hallazgos..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg bg-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {searchTerm && (
          <button
            onClick={() => {
              setSearchTerm('')
              setIsOpen(false)
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filters */}
      {searchTerm && (
        <div className="mt-3 flex flex-wrap gap-2">
          <div className="flex gap-1">
            {['OPEN', 'IN_PROGRESS', 'VALIDATED', 'CLOSED'].map((status) => (
              <button
                key={status}
                onClick={() => {
                  setStatusFilter((prev) => (prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]))
                  setIsOpen(true)
                }}
                className={`px-2 py-1 text-xs rounded ${
                  statusFilter.includes(status) ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          <div className="flex gap-1">
            {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((priority) => (
              <button
                key={priority}
                onClick={() => {
                  setPriorityFilter((prev) => (prev.includes(priority) ? prev.filter((p) => p !== priority) : [...prev, priority]))
                  setIsOpen(true)
                }}
                className={`px-2 py-1 text-xs rounded ${
                  priorityFilter.includes(priority) ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {priority}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Dropdown results */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-300 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          {isLoading && (
            <div className="p-4 text-center text-sm text-slate-500">
              <div className="animate-spin inline-block w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full" />
            </div>
          )}

          {!isLoading && hasResults && (
            <>
              <div className="p-3 space-y-3">
                {data!.items.map((item) => (
                  <div key={item.id} className="py-2 hover:bg-slate-50 px-3 rounded cursor-pointer transition-colors">
                    <SearchResultItem {...item} />
                  </div>
                ))}
              </div>

              {/* Facets summary */}
              {data!.facets && (
                <div className="border-t border-slate-200 p-3 bg-slate-50 text-xs text-slate-600">
                  <div>Total: {data!.total} hallazgos</div>
                  {isFallback && <div className="text-slate-500 mt-1">*Usando búsqueda de base de datos (Elasticsearch no disponible)</div>}
                </div>
              )}
            </>
          )}

          {!isLoading && !hasResults && !error && searchTerm && (
            <div className="p-4 text-center text-sm text-slate-500">No se encontraron resultados</div>
          )}

          {error && (
            <div className="p-4 text-center text-sm text-red-600">
              {error}
              {isFallback && <div className="text-slate-500 mt-1">Usando búsqueda de base de datos</div>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
