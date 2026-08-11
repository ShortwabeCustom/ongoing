'use client'

import { useState } from 'react'
import type { ChangeEvent } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  RotateCcw,
  UploadCloud,
} from 'lucide-react'
import { PreviewTable } from './preview-table'
import type { ImportPreviewResult } from '@/lib/validators/import'

type DialogStep = 'upload' | 'preview' | 'confirming' | 'done'

interface ImportDialogProps {
  projectId: string
  onSuccess?: (batchId: string) => void
}

export function ImportDialog({ projectId, onSuccess }: ImportDialogProps) {
  const [step, setStep] = useState<DialogStep>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setError(null)
    setIsLoading(true)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('projectId', projectId)

      const response = await fetch('/api/imports/preview', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'No se pudo generar la vista previa')
      }

      const result = await response.json()
      setPreview(result)
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!preview || !file) return

    setIsLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/imports/${preview.batchId}/confirm`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'No se pudo confirmar la importación')
      }

      const result = await response.json()
      setStep('done')
      onSuccess?.(result.importBatchId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setStep('preview')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="pm-card w-full overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-[#dbe4dd] bg-white px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase text-[#00a85a]">Carga histórica</p>
          <h2 className="mt-1 text-xl font-semibold text-[#17251f]">Importar hallazgos</h2>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#052b20] text-white">
          <FileSpreadsheet className="h-5 w-5" />
        </div>
      </div>

      {step === 'upload' && (
        <div className="space-y-4 p-5">
          <div className="pm-card-subtle border-dashed p-8 text-center">
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={handleFileSelect}
              disabled={isLoading}
              className="hidden"
              id="file-input"
            />
            <label
              htmlFor="file-input"
              className="block cursor-pointer"
            >
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-white text-[#052b20] shadow-sm">
                <UploadCloud className="h-6 w-6" />
              </span>
              <p className="mt-4 text-base font-semibold text-[#17251f]">
                {isLoading ? 'Procesando archivo...' : 'Selecciona un CSV o XLSX'}
              </p>
              <p className="mt-1 text-sm text-[#65766e]">
                Los registros se validan antes de crear nuevos hallazgos.
              </p>
              {file && <p className="mt-3 text-sm font-medium text-[#052b20]">{file.name}</p>}
            </label>
          </div>
          {error && (
            <div className="rounded-lg border border-[#f6b5aa] bg-[#fff1ee] p-4 text-sm text-[#9b321f]">
              {error}
            </div>
          )}
        </div>
      )}

      {step === 'preview' && preview && (
        <div className="space-y-5 p-5">
          <div className="pm-card-subtle p-4">
            <h3 className="font-semibold text-[#17251f]">Resumen de importación</h3>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
              <div className="rounded-lg bg-white p-3">
                <div className="text-lg font-semibold text-[#17251f]">{preview.summary.totalRows}</div>
                <div className="text-xs text-[#65766e]">Filas</div>
              </div>
              <div className="rounded-lg bg-white p-3">
                <div className="text-lg font-semibold text-[#00a85a]">{preview.summary.validRows}</div>
                <div className="text-xs text-[#65766e]">Válidas</div>
              </div>
              <div className="rounded-lg bg-white p-3">
                <div className="text-lg font-semibold text-[#85540d]">{preview.summary.skippedRows}</div>
                <div className="text-xs text-[#65766e]">Omitidas</div>
              </div>
              <div className="rounded-lg bg-white p-3">
                <div className="text-lg font-semibold text-[#052b20]">{preview.summary.newFindings}</div>
                <div className="text-xs text-[#65766e]">Nuevos</div>
              </div>
              <div className="rounded-lg bg-white p-3">
                <div className="text-lg font-semibold text-[#65766e]">{preview.summary.duplicateRows}</div>
                <div className="text-xs text-[#65766e]">Duplicados</div>
              </div>
            </div>
          </div>

          {preview.incidences.length > 0 && (
            <div className="rounded-lg border border-[#f2b84b]/50 bg-[#fff8e8] p-4">
              <h4 className="mb-2 font-semibold text-[#17251f]">Incidencias detectadas</h4>
              <ul className="text-sm space-y-1">
                {preview.incidences.slice(0, 5).map((inc, idx) => (
                  <li key={idx} className="text-[#85540d]">
                    Fila {inc.row}: {inc.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <PreviewTable rows={preview.preview.rows} />

          {error && (
            <div className="rounded-lg border border-[#f6b5aa] bg-[#fff1ee] p-4 text-sm text-[#9b321f]">
              {error}
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setStep('upload')}
              disabled={isLoading}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-[#dbe4dd] bg-white px-4 text-sm font-semibold text-[#17251f] transition hover:border-[#052b20] disabled:opacity-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </button>
            <button
              onClick={handleConfirm}
              disabled={isLoading}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-[#052b20] px-4 text-sm font-semibold text-white transition hover:bg-[#0b3e30] disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {isLoading ? 'Importando...' : 'Confirmar importación'}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="space-y-4 p-5">
          <div className="flex items-center gap-3 rounded-lg border border-[#bfeccc] bg-[#eefbf2] p-4 text-[#0b5d38]">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm font-medium">Importación completada correctamente</span>
          </div>
          <button
            onClick={() => {
              setStep('upload')
              setFile(null)
              setPreview(null)
              setError(null)
            }}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#052b20] px-4 text-sm font-semibold text-white transition hover:bg-[#0b3e30]"
          >
            <RotateCcw className="h-4 w-4" />
            Importar otro archivo
          </button>
        </div>
      )}
    </div>
  )
}
