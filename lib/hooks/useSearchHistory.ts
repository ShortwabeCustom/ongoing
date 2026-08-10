'use client'

import { useState, useEffect, useCallback } from 'react'
import { SearchHistoryEntry, AdvancedFilterValues } from '@/lib/types/search'
import { openSearchDb } from '@/lib/indexeddb/search-db'
import { v4 as uuidv4 } from 'uuid'

const MAX_HISTORY = 10

export interface UseSearchHistoryReturn {
  recent: SearchHistoryEntry[]
  isReady: boolean
  addEntry: (entry: Omit<SearchHistoryEntry, 'id' | 'timestamp'>) => Promise<void>
  removeEntry: (id: string) => Promise<void>
  clearAll: () => Promise<void>
}

export function useSearchHistory(): UseSearchHistoryReturn {
  const [recent, setRecent] = useState<SearchHistoryEntry[]>([])
  const [isReady, setIsReady] = useState(false)

  // Load history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const db = await openSearchDb()
        const txn = db.transaction('search_history', 'readonly')
        const store = txn.objectStore('search_history')
        const index = store.index('timestamp')

        return new Promise<SearchHistoryEntry[]>((resolve, reject) => {
          const allRange = IDBKeyRange.lowerBound(0)
          const request = index.getAll(allRange)

          request.onsuccess = () => {
            const items = (request.result || []) as SearchHistoryEntry[]
            // Sort by timestamp descending (newest first)
            const sorted = items.sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_HISTORY)
            setRecent(sorted)
            setIsReady(true)
            resolve(sorted)
          }

          request.onerror = () => {
            setIsReady(true)
            reject(request.error)
          }
        })
      } catch (err) {
        console.error('[useSearchHistory] Failed to load history:', err)
        setIsReady(true)
      }
    }

    loadHistory()
  }, [])

  const addEntry = useCallback(
    async (entry: Omit<SearchHistoryEntry, 'id' | 'timestamp'>) => {
      try {
        const db = await openSearchDb()
        const txn = db.transaction('search_history', 'readwrite')
        const store = txn.objectStore('search_history')

        const newEntry: SearchHistoryEntry = {
          ...entry,
          id: uuidv4(),
          timestamp: Date.now(),
        }

        const addRequest = store.add(newEntry)

        return new Promise<void>((resolve, reject) => {
          addRequest.onsuccess = async () => {
            // Check if we exceeded max, remove oldest
            const index = store.index('timestamp')
            const allRequest = index.getAll()

            allRequest.onsuccess = () => {
              const items = (allRequest.result || []) as SearchHistoryEntry[]
              if (items.length > MAX_HISTORY) {
                const toRemove = items.sort((a, b) => a.timestamp - b.timestamp)[0]
                store.delete(toRemove.id)
              }
              setRecent((prev) => [newEntry, ...prev].slice(0, MAX_HISTORY))
              resolve()
            }

            allRequest.onerror = () => reject(allRequest.error)
          }

          addRequest.onerror = () => reject(addRequest.error)
        })
      } catch (err) {
        console.error('[useSearchHistory] Failed to add entry:', err)
      }
    },
    []
  )

  const removeEntry = useCallback(async (id: string) => {
    try {
      const db = await openSearchDb()
      const txn = db.transaction('search_history', 'readwrite')
      const store = txn.objectStore('search_history')
      const request = store.delete(id)

      return new Promise<void>((resolve, reject) => {
        request.onsuccess = () => {
          setRecent((prev) => prev.filter((entry) => entry.id !== id))
          resolve()
        }
        request.onerror = () => reject(request.error)
      })
    } catch (err) {
      console.error('[useSearchHistory] Failed to remove entry:', err)
    }
  }, [])

  const clearAll = useCallback(async () => {
    try {
      const db = await openSearchDb()
      const txn = db.transaction('search_history', 'readwrite')
      const store = txn.objectStore('search_history')
      const request = store.clear()

      return new Promise<void>((resolve, reject) => {
        request.onsuccess = () => {
          setRecent([])
          resolve()
        }
        request.onerror = () => reject(request.error)
      })
    } catch (err) {
      console.error('[useSearchHistory] Failed to clear:', err)
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
