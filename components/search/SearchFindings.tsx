'use client'

import { useState, useRef, useEffect } from 'react'
import { useSearch } from '@/lib/hooks/useSearch'
import { SearchResultItem } from './SearchResultItem'
import { Search, X, ChevronDown } from 'lucide-react'

const STATUS_OPTIONS = ['OPEN', 'IN_PROGRESS', 'VALIDATED', 'CLOSED']
const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

export function SearchFindings() {
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [priorityFilter, setPriorityFilter] = useState<string[]>([])
  const [openFilterSection, setOpenFilterSection] = useState<'status' | 'priority' | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, error, isFallback } = useSearch({
    q: searchTerm,
    status: statusFilter.length > 0 ? statusFilter : undefined,
    priority: priorityFilter.length > 0 ? priorityFilter : undefined,
    limit: 10,
  })

  // Close dropdown when clicking outside (desktop only)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Lock scroll on mobile when modal is open
  useEffect(() => {
    if (typeof window === 'undefined') return

    const isMobile = !window.matchMedia('(min-width: 768px)').matches
    if (isOpen && isMobile) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [isOpen])

  const hasResults = data && data.items.length > 0
  const showDropdown = isOpen && (isLoading || hasResults || error)

  const renderResults = () => (
    <>
      {isLoading && (
        <div className="p-4 text-center text-sm text-slate-500">
          <div className="animate-spin inline-block w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full" />
        </div>
      )}

      {!isLoading && hasResults && (
        <>
          <div className="p-3 space-y-3">
            {data!.items.map((item) => (
              <div
                key={item.id}
                className="min-h-[44px] md:min-h-0 py-2.5 md:py-2 px-3 rounded cursor-pointer transition-colors
                           active:bg-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-500
                           [@media(hover:hover)]:hover:bg-slate-50"
              >
                <SearchResultItem {...item} />
              </div>
            ))}
          </div>

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
    </>
  )

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl">
      {/* Desktop version */}
      <div className="hidden md:block">
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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors [@media(hover:hover)]:hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filters */}
        {searchTerm && (
          <div className="mt-3 flex flex-wrap gap-2">
            <div className="flex gap-1">
              {STATUS_OPTIONS.map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setStatusFilter((prev) => (prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]))
                    setIsOpen(true)
                  }}
                  className={`px-2 py-1 text-xs rounded transition-colors [@media(hover:hover)]:hover:bg-slate-200 ${
                    statusFilter.includes(status) ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            <div className="flex gap-1">
              {PRIORITY_OPTIONS.map((priority) => (
                <button
                  key={priority}
                  onClick={() => {
                    setPriorityFilter((prev) => (prev.includes(priority) ? prev.filter((p) => p !== priority) : [...prev, priority]))
                    setIsOpen(true)
                  }}
                  className={`px-2 py-1 text-xs rounded transition-colors [@media(hover:hover)]:hover:bg-slate-200 ${
                    priorityFilter.includes(priority) ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-700'
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
            {renderResults()}
          </div>
        )}
      </div>

      {/* Mobile version */}
      <div className="md:hidden">
        {/* Search input trigger */}
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
            readOnly
            className="w-full pl-10 pr-10 py-3 border border-slate-300 rounded-lg bg-white text-base placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          />
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm('')
                setIsOpen(false)
                setStatusFilter([])
                setPriorityFilter([])
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Modal overlay & bottom sheet */}
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => {
                setIsOpen(false)
                setOpenFilterSection(null)
              }}
            />

            {/* Bottom sheet panel */}
            <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[85vh] overflow-y-auto z-50 flex flex-col">
              {/* Header */}
              <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white rounded-t-2xl">
                <h2 className="text-lg font-semibold text-slate-900">Búsqueda avanzada</h2>
                <button
                  onClick={() => {
                    setIsOpen(false)
                    setOpenFilterSection(null)
                  }}
                  aria-label="Cerrar búsqueda"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 active:bg-slate-100 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Filters accordion */}
              <div className="flex-1 px-4 py-3 space-y-2 overflow-y-auto">
                {/* Status filter */}
                <div className="border-b border-slate-200">
                  <button
                    onClick={() => setOpenFilterSection(openFilterSection === 'status' ? null : 'status')}
                    aria-expanded={openFilterSection === 'status'}
                    aria-controls="status-content"
                    className="w-full px-3 py-3 min-h-[44px] flex items-center justify-between text-left active:bg-slate-100 rounded focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    <span className="font-medium text-slate-900">Estado</span>
                    <ChevronDown
                      className={`w-5 h-5 text-slate-400 transition-transform ${openFilterSection === 'status' ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {openFilterSection === 'status' && (
                    <div id="status-content" className="px-3 py-3 bg-slate-50 space-y-2">
                      {STATUS_OPTIONS.map((status) => (
                        <label key={status} className="flex items-center min-h-[44px] gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={statusFilter.includes(status)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setStatusFilter((prev) => [...prev, status])
                              } else {
                                setStatusFilter((prev) => prev.filter((s) => s !== status))
                              }
                            }}
                            className="w-4 h-4 rounded border-slate-300 cursor-pointer"
                          />
                          <span className="text-sm text-slate-700">{status}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Priority filter */}
                <div className="border-b border-slate-200">
                  <button
                    onClick={() => setOpenFilterSection(openFilterSection === 'priority' ? null : 'priority')}
                    aria-expanded={openFilterSection === 'priority'}
                    aria-controls="priority-content"
                    className="w-full px-3 py-3 min-h-[44px] flex items-center justify-between text-left active:bg-slate-100 rounded focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    <span className="font-medium text-slate-900">Prioridad</span>
                    <ChevronDown
                      className={`w-5 h-5 text-slate-400 transition-transform ${openFilterSection === 'priority' ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {openFilterSection === 'priority' && (
                    <div id="priority-content" className="px-3 py-3 bg-slate-50 space-y-2">
                      {PRIORITY_OPTIONS.map((priority) => (
                        <label key={priority} className="flex items-center min-h-[44px] gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={priorityFilter.includes(priority)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setPriorityFilter((prev) => [...prev, priority])
                              } else {
                                setPriorityFilter((prev) => prev.filter((p) => p !== priority))
                              }
                            }}
                            className="w-4 h-4 rounded border-slate-300 cursor-pointer"
                          />
                          <span className="text-sm text-slate-700">{priority}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Results */}
              {searchTerm && (
                <div className="flex-1 overflow-y-auto">
                  <div className="border-t border-slate-200 p-3">
                    {renderResults()}
                  </div>
                </div>
              )}

              {/* Footer actions */}
              <div className="sticky bottom-0 px-4 py-3 border-t border-slate-200 bg-white flex gap-2">
                <button
                  onClick={() => {
                    setSearchTerm('')
                    setStatusFilter([])
                    setPriorityFilter([])
                    setOpenFilterSection(null)
                    setIsOpen(false)
                  }}
                  className="flex-1 min-h-[44px] py-2.5 px-3 bg-slate-100 text-slate-900 rounded-lg font-medium transition-colors active:bg-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  Limpiar
                </button>
                <button
                  onClick={() => {
                    setIsOpen(false)
                    setOpenFilterSection(null)
                  }}
                  className="flex-1 min-h-[44px] py-2.5 px-3 bg-emerald-500 text-white rounded-lg font-medium transition-colors active:bg-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
