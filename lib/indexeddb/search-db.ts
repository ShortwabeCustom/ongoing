// FASE 14: IndexedDB helper for search history and saved filters
// Independent from pruebas-maria-offline DB to avoid regression

const SEARCH_DB_NAME = 'pruebas-maria-search'
const SEARCH_DB_VERSION = 1

export interface IDBStores {
  search_history: {
    keyPath: 'id'
    indexes: ['timestamp']
  }
  saved_filters: {
    keyPath: 'id'
    indexes: ['createdAt']
  }
}

export async function openSearchDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('IndexedDB not available in non-browser environment'))
      return
    }

    const request = indexedDB.open(SEARCH_DB_NAME, SEARCH_DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = request.result
      const source = event.oldVersion

      if (source < 1) {
        // Create search_history store
        if (!db.objectStoreNames.contains('search_history')) {
          const historyStore = db.createObjectStore('search_history', { keyPath: 'id' })
          historyStore.createIndex('timestamp', 'timestamp', { unique: false })
        }

        // Create saved_filters store
        if (!db.objectStoreNames.contains('saved_filters')) {
          const filtersStore = db.createObjectStore('saved_filters', { keyPath: 'id' })
          filtersStore.createIndex('createdAt', 'createdAt', { unique: false })
        }
      }
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onerror = () => {
      reject(request.error)
    }
  })
}

export async function clearSearchDb(): Promise<void> {
  const db = await openSearchDb()
  try {
    const txn = db.transaction(['search_history', 'saved_filters'], 'readwrite')
    txn.objectStore('search_history').clear()
    txn.objectStore('saved_filters').clear()

    return new Promise((resolve, reject) => {
      txn.oncomplete = () => resolve()
      txn.onerror = () => reject(txn.error)
    })
  } finally {
    db.close()
  }
}
