'use client'

import { useState, useEffect } from 'react'
import { LookupOption } from '@/lib/types/search'

interface UseLookups {
  assignees: LookupOption[]
  projects: LookupOption[]
  testSessions: LookupOption[]
  isLoading: boolean
  error: string | null
}

export function useLookups(projectId?: string, userId?: string): UseLookups {
  const [assignees, setAssignees] = useState<LookupOption[]>([])
  const [projects, setProjects] = useState<LookupOption[]>([])
  const [testSessions, setTestSessions] = useState<LookupOption[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
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

        const sessionParams = new URLSearchParams({ type: 'testSessions' })
        if (projectId) sessionParams.append('projectId', projectId)
        const sessionRes = await fetch(`/api/search/lookups?${sessionParams}`)
        if (!sessionRes.ok) throw new Error('Failed to fetch test sessions')
        const sessionData = await sessionRes.json()
        setTestSessions(sessionData.testSessions || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        setAssignees([])
        setProjects([])
        setTestSessions([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchLookups()
  }, [projectId, userId])

  return {
    assignees,
    projects,
    testSessions,
    isLoading,
    error,
  }
}
