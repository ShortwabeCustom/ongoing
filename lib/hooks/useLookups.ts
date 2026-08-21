'use client'

import { useState, useEffect } from 'react'
import { LookupOption } from '@/lib/types/search'

interface UseLookups {
  assignees: LookupOption[]
  projects: LookupOption[]
  isLoading: boolean
  error: string | null
}

export function useLookups(
  projectId?: string,
  userId?: string,
  options?: { enabled?: boolean },
): UseLookups {
  const enabled = options?.enabled ?? true
  const [assignees, setAssignees] = useState<LookupOption[]>([])
  const [projects, setProjects] = useState<LookupOption[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return

    const fetchLookups = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Fetch assignees
        const assigneeParams = new URLSearchParams({ type: 'assignees' })
        if (projectId) assigneeParams.append('projectId', projectId)

        const assigneeRes = await fetch(`/api/search/lookups?${assigneeParams.toString()}`)
        if (!assigneeRes.ok) throw new Error('Failed to fetch assignees')
        const assigneeData = await assigneeRes.json()
        setAssignees(assigneeData.assignees || [])

        // Fetch projects
        const projectParams = new URLSearchParams({ type: 'projects' })
        if (userId) projectParams.append('userId', userId)

        const projectRes = await fetch(`/api/search/lookups?${projectParams.toString()}`)
        if (!projectRes.ok) throw new Error('Failed to fetch projects')
        const projectData = await projectRes.json()
        setProjects(projectData.projects || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        setAssignees([])
        setProjects([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchLookups()
  }, [projectId, userId, enabled])

  return {
    assignees,
    projects,
    isLoading,
    error,
  }
}
