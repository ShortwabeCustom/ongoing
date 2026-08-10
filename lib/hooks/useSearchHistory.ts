'use client'

import { useCallback, useEffect, useState } from 'react'
import { v4 as uuid } from 'uuid'
import type { SearchHistoryEntry } from '@/lib/types/search'
import {
  getAllFromStore,
  putInStore,
  deleteFromStore,
  clearStore,
} from '@/lib/indexeddb/search-db'

const HISTORY_CAP = 10

export function useSearchHistory() {
  const [recent, setRecent] = useState<SearchHistoryEntry[]>([])
  const [isReady, setIsReady] = useState(false)

  // Load on mount
  useEffect(() => {
    const load = async () => {
      try {
        const items = await getAllFromStore<SearchHistoryEntry>('search_history')
        // Sort by timestamp DESC
        setRecent(items.sort((a, b) => b.timestamp - a.timestamp))
      } catch (err) {
        console.error('Error loading search history:', err)
      } finally {
        setIsReady(true)
      }
    }

    load()
  }, [])

  const addEntry = useCallback(
    async (entry: Omit<SearchHistoryEntry, 'id' | 'timestamp'>) => {
      try {
        const newEntry: SearchHistoryEntry = {
          ...entry,
          id: uuid(),
          timestamp: Date.now(),
        }

        await putInStore('search_history', newEntry)

        // Update local state
        setRecent((prev) => {
          const updated = [newEntry, ...prev]
          // FIFO evict if over cap
          if (updated.length > HISTORY_CAP) {
            const toRemove = updated[HISTORY_CAP]
            // Fire-and-forget delete
            void deleteFromStore('search_history', toRemove.id)
            return updated.slice(0, HISTORY_CAP)
          }
          return updated
        })
      } catch (err) {
        console.error('Error adding search history:', err)
      }
    },
    [],
  )

  const removeEntry = useCallback(async (id: string) => {
    try {
      await deleteFromStore('search_history', id)
      setRecent((prev) => prev.filter((x) => x.id !== id))
    } catch (err) {
      console.error('Error removing search history:', err)
    }
  }, [])

  const clearAll = useCallback(async () => {
    try {
      await clearStore('search_history')
      setRecent([])
    } catch (err) {
      console.error('Error clearing search history:', err)
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
