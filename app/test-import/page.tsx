'use client'

import { ImportDialog } from '@/components/features/import/import-dialog'
import { useState } from 'react'

export default function TestImportPage() {
  const [lastBatchId, setLastBatchId] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <ImportDialog
          projectId="test-project-id-1"
          onSuccess={(batchId) => setLastBatchId(batchId)}
        />

        {lastBatchId && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded">
            <p>Last imported batch: <code className="bg-white px-2 py-1 rounded">{lastBatchId}</code></p>
          </div>
        )}
      </div>
    </div>
  )
}
