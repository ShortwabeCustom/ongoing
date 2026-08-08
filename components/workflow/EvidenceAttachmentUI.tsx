'use client'

import { useState } from 'react'
import { EvidenceClient } from '@/lib/api/evidence-client'
import { toast } from '@/components/ui/use-toast'

interface EvidenceAttachmentUIProps {
  findingId: string
  workflowType: 'resolution' | 'validation'
  onAttach?: (evidenceIds: string[]) => Promise<void>
}

export function EvidenceAttachmentUI({
  findingId,
  workflowType,
  onAttach,
}: EvidenceAttachmentUIProps) {
  const [evidence, setEvidence] = useState<any[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)

  const handleAttach = async () => {
    if (selected.size === 0) {
      toast({ title: 'Error', description: 'Select at least one evidence file' })
      return
    }

    try {
      setIsLoading(true)
      await onAttach?.(Array.from(selected))
      toast({ title: 'Success', description: 'Evidence attached' })
      setSelected(new Set())
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to attach evidence' })
    } finally {
      setIsLoading(false)
    }
  }

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selected)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelected(newSelected)
  }

  return (
    <div className="space-y-4">
      <h4 className="font-semibold">Attach Evidence ({workflowType})</h4>

      {evidence.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No unattached evidence files
        </p>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {evidence.map((ev) => (
            <label key={ev.id} className="flex items-center gap-3 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.has(ev.id)}
                onChange={() => toggleSelect(ev.id)}
                className="w-4 h-4"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{ev.originalFilename}</p>
                <p className="text-xs text-gray-500">
                  {(ev.fileSize / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </label>
          ))}
        </div>
      )}

      <button
        onClick={handleAttach}
        disabled={isLoading || selected.size === 0}
        className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {isLoading ? 'Attaching...' : `Attach ${selected.size} file(s)`}
      </button>
    </div>
  )
}
