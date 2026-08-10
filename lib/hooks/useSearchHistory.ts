'use client'

import { useState, useEffect, useCallback } from 'react'
import { AdvancedFilterValues } from '@/lib/types/search'
import { getAllFromStore, addToStore, deleteFromStore, clearStore } from '@/lib/indexeddb/search-db'
import { v4 as uuidv4 } from 'uuid'

export interface SearchHistoryEntry {
  id: string
  q: string
  status: string[]
  priority: string[]
  filters: AdvancedFilterValues
  timestamp: number
  resultCount?: number
}

const HISTORY_CAP = 10

export function useSearchHistory() {
  const [recent, setRecent] = useState<SearchHistoryEntry[]>([])
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const items = await getAllFromStore('search_history')
        setRecent(items.sort((a, b) => b.timestamp - a.timestamp))
      } catch (err) {
        console.error('Failed to load search history:', err)
      } finally {
        setIsReady(true)
      }
    }

    if (typeof window !== 'undefined') {
      loadHistory()
    }
  }, [])

  const addEntry = useCallback(
    async (entry: Omit<SearchHistoryEntry, 'id'>) => {
      try {
        const newEntry: SearchHistoryEntry = {
          ...entry,
          id: uuidv4(),
        }

        await addToStore('search_history', newEntry)

        setRecent((prev) => {
          const updated = [newEntry, ...prev].slice(0, HISTORY_CAP)
          return updated
        })
      } catch (err) {
        console.error('Failed to add search history entry:', err)
      }
    },
    [],
  )

  const removeEntry = useCallback(async (id: string) => {
    try {
      await deleteFromStore('search_history', id)
      setRecent((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      console.error('Failed to remove search history entry:', err)
    }
  }, [])

  const clearAll = useCallback(async () => {
    try {
      await clearStore('search_history')
      setRecent([])
    } catch (err) {
      console.error('Failed to clear search history:', err)
    }
  }, [])

  return {
    recent,
    isReady,
    addEntry,
    removeEntry,
    clearAll,
  }
}
