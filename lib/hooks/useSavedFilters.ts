'use client'

import { useState, useEffect, useCallback } from 'react'
import { SavedFilterEntry } from '@/lib/types/search'
import { openSearchDb } from '@/lib/indexeddb/search-db'
import { v4 as uuidv4 } from 'uuid'

const MAX_SAVED_FILTERS = 20

export interface UseSavedFiltersReturn {
  filters: SavedFilterEntry[]
  isReady: boolean
  saveFilter: (name: string, entry: Omit<SavedFilterEntry, 'id' | 'name' | 'createdAt' | 'updatedAt'>) => Promise<void>
  renameFilter: (id: string, newName: string) => Promise<void>
  deleteFilter: (id: string) => Promise<void>
  clearAll: () => Promise<void>
}

export function useSavedFilters(): UseSavedFiltersReturn {
  const [filters, setFilters] = useState<SavedFilterEntry[]>([])
  const [isReady, setIsReady] = useState(false)

  // Load saved filters on mount
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const db = await openSearchDb()
        const txn = db.transaction('saved_filters', 'readonly')
        const store = txn.objectStore('saved_filters')
        const index = store.index('createdAt')

        return new Promise<SavedFilterEntry[]>((resolve, reject) => {
          const allRange = IDBKeyRange.lowerBound(0)
          const request = index.getAll(allRange)

          request.onsuccess = () => {
            const items = (request.result || []) as SavedFilterEntry[]
            // Sort by createdAt descending (newest first)
            const sorted = items.sort((a, b) => b.createdAt - a.createdAt)
            setFilters(sorted)
            setIsReady(true)
            resolve(sorted)
          }

          request.onerror = () => {
            setIsReady(true)
            reject(request.error)
          }
        })
      } catch (err) {
        console.error('[useSavedFilters] Failed to load filters:', err)
        setIsReady(true)
      }
    }

    loadFilters()
  }, [])

  const saveFilter = useCallback(
    async (name: string, entry: Omit<SavedFilterEntry, 'id' | 'name' | 'createdAt' | 'updatedAt'>) => {
      try {
        const db = await openSearchDb()
        const txn = db.transaction('saved_filters', 'readwrite')
        const store = txn.objectStore('saved_filters')
        const now = Date.now()

        const newFilter: SavedFilterEntry = {
          ...entry,
          id: uuidv4(),
          name,
          createdAt: now,
          updatedAt: now,
        }

        const addRequest = store.add(newFilter)

        return new Promise<void>((resolve, reject) => {
          addRequest.onsuccess = async () => {
            // Check if we exceeded max, remove oldest
            const index = store.index('createdAt')
            const allRequest = index.getAll()

            allRequest.onsuccess = () => {
              const items = (allRequest.result || []) as SavedFilterEntry[]
              if (items.length > MAX_SAVED_FILTERS) {
                const toRemove = items.sort((a, b) => a.createdAt - b.createdAt)[0]
                store.delete(toRemove.id)
              }
              setFilters((prev) => [newFilter, ...prev].slice(0, MAX_SAVED_FILTERS))
              resolve()
            }

            allRequest.onerror = () => reject(allRequest.error)
          }

          addRequest.onerror = () => reject(addRequest.error)
        })
      } catch (err) {
        console.error('[useSavedFilters] Failed to save filter:', err)
      }
    },
    []
  )

  const renameFilter = useCallback(async (id: string, newName: string) => {
    try {
      const db = await openSearchDb()
      const txn = db.transaction('saved_filters', 'readwrite')
      const store = txn.objectStore('saved_filters')
      const getRequest = store.get(id)

      return new Promise<void>((resolve, reject) => {
        getRequest.onsuccess = () => {
          const filter = getRequest.result as SavedFilterEntry
          if (!filter) return resolve()

          const updated: SavedFilterEntry = {
            ...filter,
            name: newName,
            updatedAt: Date.now(),
          }

          const putRequest = store.put(updated)
          putRequest.onsuccess = () => {
            setFilters((prev) =>
              prev.map((f) => (f.id === id ? updated : f))
            )
            resolve()
          }
          putRequest.onerror = () => reject(putRequest.error)
        }

        getRequest.onerror = () => reject(getRequest.error)
      })
    } catch (err) {
      console.error('[useSavedFilters] Failed to rename filter:', err)
    }
  }, [])

  const deleteFilter = useCallback(async (id: string) => {
    try {
      const db = await openSearchDb()
      const txn = db.transaction('saved_filters', 'readwrite')
      const store = txn.objectStore('saved_filters')
      const request = store.delete(id)

      return new Promise<void>((resolve, reject) => {
        request.onsuccess = () => {
          setFilters((prev) => prev.filter((f) => f.id !== id))
          resolve()
        }
        request.onerror = () => reject(request.error)
      })
    } catch (err) {
      console.error('[useSavedFilters] Failed to delete filter:', err)
    }
  }, [])

  const clearAll = useCallback(async () => {
    try {
      const db = await openSearchDb()
      const txn = db.transaction('saved_filters', 'readwrite')
      const store = txn.objectStore('saved_filters')
      const request = store.clear()

      return new Promise<void>((resolve, reject) => {
        request.onsuccess = () => {
          setFilters([])
          resolve()
        }
        request.onerror = () => reject(request.error)
      })
    } catch (err) {
      console.error('[useSavedFilters] Failed to clear:', err)
    }
  }, [])

  return {
    filters,
    isReady,
    saveFilter,
    renameFilter,
    deleteFilter,
    clearAll,
  }
}
