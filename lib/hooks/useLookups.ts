'use client'

import { useState, useEffect } from 'react'
import { LookupOption } from '@/lib/types/search'

interface UseLookupResult {
  assignees: LookupOption[]
  projects: LookupOption[]
  isLoading: boolean
  error: string | null
}

export function useLookups(): UseLookupResult {
  const [assignees, setAssignees] = useState<LookupOption[]>([])
  const [projects, setProjects] = useState<LookupOption[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchLookups = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const [assigneesRes, projectsRes] = await Promise.all([
          fetch('/api/search/lookups?type=assignees'),
          fetch('/api/search/lookups?type=projects'),
        ])

        if (!assigneesRes.ok || !projectsRes.ok) {
          throw new Error('Failed to fetch lookups')
        }

        const assigneesData = await assigneesRes.json()
        const projectsData = await projectsRes.json()

        setAssignees(assigneesData.assignees || [])
        setProjects(projectsData.projects || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setIsLoading(false)
      }
    }

    fetchLookups()
  }, [])

  return {
    assignees,
    projects,
    isLoading,
    error,
  }
}
