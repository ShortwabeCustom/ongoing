'use client'

import { useState, useEffect, useCallback } from 'react'
import { AdvancedFilterValues } from '@/lib/types/search'
import { getAllFromStore, addToStore, deleteFromStore, updateInStore, clearStore } from '@/lib/indexeddb/search-db'
import { v4 as uuidv4 } from 'uuid'

export interface SavedFilterEntry {
  id: string
  name: string
  q?: string
  status: string[]
  priority: string[]
  filters: AdvancedFilterValues
  createdAt: number
  updatedAt: number
}

const FILTERS_CAP = 20

export function useSavedFilters() {
  const [saved, setSaved] = useState<SavedFilterEntry[]>([])
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const items = await getAllFromStore('saved_filters')
        setSaved(items.sort((a, b) => b.createdAt - a.createdAt))
      } catch (err) {
        console.error('Failed to load saved filters:', err)
      } finally {
        setIsReady(true)
      }
    }

    if (typeof window !== 'undefined') {
      loadFilters()
    }
  }, [])

  const saveFilter = useCallback(
    async (name: string, filters: AdvancedFilterValues, q?: string) => {
      try {
        const now = Date.now()
        const newFilter: SavedFilterEntry = {
          id: uuidv4(),
          name,
          q,
          status: [],
          priority: [],
          filters,
          createdAt: now,
          updatedAt: now,
        }

        await addToStore('saved_filters', newFilter)

        setSaved((prev) => {
          const updated = [newFilter, ...prev]
          // Evict oldest if > cap
          if (updated.length > FILTERS_CAP) {
            const toEvict = updated
              .sort((a, b) => a.createdAt - b.createdAt)
              .slice(FILTERS_CAP)
            toEvict.forEach((f) => deleteFromStore('saved_filters', f.id).catch(console.error))
            return updated.slice(0, FILTERS_CAP)
          }
          return updated
        })
      } catch (err) {
        console.error('Failed to save filter:', err)
        throw err
      }
    },
    [],
  )

  const renameFilter = useCallback(async (id: string, newName: string) => {
    try {
      const filter = saved.find((f) => f.id === id)
      if (!filter) throw new Error('Filter not found')

      const updated: SavedFilterEntry = {
        ...filter,
        name: newName,
        updatedAt: Date.now(),
      }

      await updateInStore('saved_filters', updated)
      setSaved((prev) => prev.map((f) => (f.id === id ? updated : f)))
    } catch (err) {
      console.error('Failed to rename filter:', err)
      throw err
    }
  }, [saved])

  const deleteFilter = useCallback(async (id: string) => {
    try {
      await deleteFromStore('saved_filters', id)
      setSaved((prev) => prev.filter((f) => f.id !== id))
    } catch (err) {
      console.error('Failed to delete filter:', err)
    }
  }, [])

  const clearAll = useCallback(async () => {
    try {
      await clearStore('saved_filters')
      setSaved([])
    } catch (err) {
      console.error('Failed to clear saved filters:', err)
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
