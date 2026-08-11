'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, FolderOpen, UploadCloud } from 'lucide-react'
import { ImportDialog } from '@/components/features/import/import-dialog'

type ProjectOption = {
  id: string
  name: string
}

export function TestImportWorkspace() {
  const [lastBatchId, setLastBatchId] = useState<string | null>(null)
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [projectId, setProjectId] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadProjects() {
      const response = await fetch('/api/projects')
      if (!response.ok) return
      const result = await response.json()
      const items = result.items ?? result.data?.items ?? []
      if (!cancelled) {
        setProjects(items)
        setProjectId((current) => current || items[0]?.id || '')
      }
    }

    void loadProjects()
    return () => {
      cancelled = true
    }
  }, [])

  const selectedProject = projects.find((project) => project.id === projectId)

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="pm-card h-fit p-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#052b20] text-white">
          <FolderOpen className="h-5 w-5" />
        </div>
        <h2 className="mt-4 text-xl font-semibold text-[#17251f]">Proyecto destino</h2>
        <p className="mt-2 text-sm leading-6 text-[#65766e]">
          Selecciona el proyecto donde se registrarán los hallazgos validados.
        </p>

        <label className="mt-5 block text-sm font-semibold text-[#3d4d45]" htmlFor="project-select">
          Proyecto
        </label>
        <select
          id="project-select"
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
          className="pm-input mt-2 h-11 w-full text-sm focus:outline-none focus:ring-2 focus:ring-[#00a85a]"
        >
          {projects.length === 0 ? (
            <option value="">Sin proyectos disponibles</option>
          ) : (
            projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))
          )}
        </select>

        <div className="mt-5 space-y-3 border-t border-[#dbe4dd] pt-5 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[#65766e]">Proyectos</span>
            <span className="font-semibold text-[#17251f]">{projects.length}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-[#65766e]">Formato</span>
            <span className="font-semibold text-[#17251f]">CSV/XLSX</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-[#65766e]">Destino</span>
            <span className="max-w-[170px] truncate font-semibold text-[#17251f]">
              {selectedProject?.name ?? 'Pendiente'}
            </span>
          </div>
        </div>

        {lastBatchId && (
          <div className="mt-5 rounded-lg border border-[#bfeccc] bg-[#eefbf2] p-3 text-sm text-[#0b5d38]">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-4 w-4" />
              Lote importado
            </div>
            <code className="mt-2 block truncate rounded bg-white px-2 py-1 text-xs text-[#052b20]">
              {lastBatchId}
            </code>
          </div>
        )}
      </aside>

      <section>
        {projectId ? (
          <ImportDialog
            projectId={projectId}
            onSuccess={(batchId) => setLastBatchId(batchId)}
          />
        ) : (
          <div className="pm-card flex min-h-[320px] items-center justify-center p-8 text-center">
            <div>
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-[#edf4ed] text-[#052b20]">
                <UploadCloud className="h-6 w-6" />
              </span>
              <h2 className="mt-4 text-xl font-semibold text-[#17251f]">Proyecto requerido</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-[#65766e]">
                Crea o importa un proyecto antes de cargar archivos históricos.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
