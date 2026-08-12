'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { Finding } from '@/lib/types'
import { EditFindingDialog } from '@/components/finding/EditFindingDialog'
import { useAuth } from '@/hooks/useAuth'
import { useLookups } from '@/lib/hooks/useLookups'

interface FindingDetailContentProps {
  finding: Finding & { evidence?: any[] }
}

export function FindingDetailContent({ finding }: FindingDetailContentProps) {
  const auth = useAuth()
  const [editOpen, setEditOpen] = useState(false)
  const { assignees } = useLookups(finding.projectId)
  const canEdit = Boolean(auth.user?.role && ['OWNER', 'QA_LEAD'].includes(auth.user.role))

  if (!canEdit) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setEditOpen(true)}
        className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#052b20] px-4 text-sm font-semibold text-white transition hover:bg-[#0b3e30] focus-visible:ring-2 focus-visible:ring-[#00a85a]"
      >
        <Pencil className="h-4 w-4" />
        Editar hallazgo
      </button>

      <EditFindingDialog
        open={editOpen}
        finding={finding}
        assignees={assignees}
        onClose={() => setEditOpen(false)}
      />
    </>
  )
}
