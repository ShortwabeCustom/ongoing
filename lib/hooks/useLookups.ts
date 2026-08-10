'use client'

import { useEffect, useState } from 'react'
import type { LookupOption } from '@/lib/types/search'

interface UseLookups {
  assignees: LookupOption[]
  projects: LookupOption[]
  isLoading: boolean
  error: string | null
}

export function useLookups(projectId?: string, userId?: string): UseLookups {
  const [assignees, setAssignees] = useState<LookupOption[]>([])
  const [projects, setProjects] = useState<LookupOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchLookups = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const [assigneesRes, projectsRes] = await Promise.all([
          fetch(`/api/search/lookups?type=assignees${projectId ? `&projectId=${projectId}` : ''}`),
          fetch(`/api/search/lookups?type=projects${userId ? `&userId=${userId}` : ''}`),
        ])

        if (!assigneesRes.ok || !projectsRes.ok) {
          throw new Error('Failed to fetch lookups')
        }

        const assigneesData = await assigneesRes.json()
        const projectsData = await projectsRes.json()

        setAssignees(assigneesData.assignees || [])
        setProjects(projectsData.projects || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading lookups')
      } finally {
        setIsLoading(false)
      }
    }

    fetchLookups()
  }, [projectId, userId])

  return {
    assignees,
    projects,
    isLoading,
    error,
  }
}
