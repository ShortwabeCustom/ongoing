interface SearchResultItemProps {
  observation: string
  highlightedObservation?: string
  status: string
  priority: string
  severity: string
  projectId: string
}

const statusColors: Record<string, string> = {
  OPEN: 'bg-red-100 text-red-800',
  TRIAGED: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  READY_FOR_VALIDATION: 'bg-purple-100 text-purple-800',
  VALIDATED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-800',
  BLOCKED: 'bg-red-100 text-red-800',
  REOPENED: 'bg-orange-100 text-orange-800',
}

const priorityColors: Record<string, string> = {
  LOW: 'bg-green-100 text-green-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  HIGH: 'bg-orange-100 text-orange-800',
  CRITICAL: 'bg-red-100 text-red-800',
}

const severityColors: Record<string, string> = {
  COSMETIC: 'bg-blue-100 text-blue-800',
  MINOR: 'bg-cyan-100 text-cyan-800',
  MAJOR: 'bg-orange-100 text-orange-800',
  BLOCKER: 'bg-red-100 text-red-800',
}

export function SearchResultItem({
  observation,
  highlightedObservation,
  status,
  priority,
  severity,
  projectId,
}: SearchResultItemProps) {
  const displayObservation = highlightedObservation || observation

  return (
    <div className="flex flex-col gap-2 border-l-2 border-slate-200 pl-3">
      <div
        className="text-sm text-slate-800 line-clamp-2"
        dangerouslySetInnerHTML={{
          __html: displayObservation,
        }}
      />

      <div className="flex flex-wrap gap-2">
        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${statusColors[status] || 'bg-gray-100'}`}>
          {status}
        </span>
        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${priorityColors[priority] || 'bg-gray-100'}`}>
          {priority}
        </span>
        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${severityColors[severity] || 'bg-gray-100'}`}>
          {severity}
        </span>
      </div>
    </div>
  )
}
