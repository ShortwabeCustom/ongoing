'use client'

import { useCallback, useEffect, useState } from 'react'
import { v4 as uuid } from 'uuid'
import type { SavedFilterEntry } from '@/lib/types/search'
import {
  getAllFromStore,
  putInStore,
  deleteFromStore,
  clearStore,
} from '@/lib/indexeddb/search-db'

const SAVED_FILTERS_CAP = 20

export function useSavedFilters() {
  const [saved, setSaved] = useState<SavedFilterEntry[]>([])
  const [isReady, setIsReady] = useState(false)

  // Load on mount
  useEffect(() => {
    const load = async () => {
      try {
        const items = await getAllFromStore<SavedFilterEntry>('saved_filters')
        // Sort by createdAt DESC
        setSaved(items.sort((a, b) => b.createdAt - a.createdAt))
      } catch (err) {
        console.error('Error loading saved filters:', err)
      } finally {
        setIsReady(true)
      }
    }

    load()
  }, [])

  const saveFilter = useCallback(
    async (name: string, entry: Omit<SavedFilterEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
      try {
        const newEntry: SavedFilterEntry = {
          ...entry,
          id: uuid(),
          name,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }

        await putInStore('saved_filters', newEntry)

        // Update local state
        setSaved((prev) => {
          const updated = [newEntry, ...prev]
          // Evict oldest if over cap
          if (updated.length > SAVED_FILTERS_CAP) {
            const toRemove = updated.reduce((oldest, current) =>
              current.createdAt < oldest.createdAt ? current : oldest,
            )
            // Fire-and-forget delete
            void deleteFromStore('saved_filters', toRemove.id)
            return updated.filter((x) => x.id !== toRemove.id)
          }
          return updated
        })
      } catch (err) {
        console.error('Error saving filter:', err)
      }
    },
    [],
  )

  const renameFilter = useCallback(async (id: string, newName: string) => {
    try {
      setSaved((prev) => {
        const updated = prev.map((x) =>
          x.id === id
            ? { ...x, name: newName, updatedAt: Date.now() }
            : x,
        )
        // Persist the change
        const entry = updated.find((x) => x.id === id)
        if (entry) {
          void putInStore('saved_filters', entry)
        }
        return updated
      })
    } catch (err) {
      console.error('Error renaming filter:', err)
    }
  }, [])

  const deleteFilter = useCallback(async (id: string) => {
    try {
      await deleteFromStore('saved_filters', id)
      setSaved((prev) => prev.filter((x) => x.id !== id))
    } catch (err) {
      console.error('Error deleting filter:', err)
    }
  }, [])

  const clearAll = useCallback(async () => {
    try {
      await clearStore('saved_filters')
      setSaved([])
    } catch (err) {
      console.error('Error clearing saved filters:', err)
    }
  }, [])

  return {
    saved,
    isReady,
    saveFilter,
    renameFilter,
    deleteFilter,
    clearAll,
  }
}
