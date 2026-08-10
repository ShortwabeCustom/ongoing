// FASE 14: Independent IndexedDB store for search history & saved filters

const SEARCH_DB_NAME = 'pruebas-maria-search'
const SEARCH_DB_VERSION = 1

export function openSearchDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SEARCH_DB_NAME, SEARCH_DB_VERSION)

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result

      if (!db.objectStoreNames.contains('search_history')) {
        const store = db.createObjectStore('search_history', { keyPath: 'id' })
        store.createIndex('timestamp', 'timestamp', { unique: false })
      }

      if (!db.objectStoreNames.contains('saved_filters')) {
        const store = db.createObjectStore('saved_filters', { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }

    request.onsuccess = () => resolve((request as IDBOpenDBRequest).result)
    request.onerror = () => reject((request as IDBOpenDBRequest).error)
  })
}

export async function getAllFromStore<T>(
  storeName: 'search_history' | 'saved_filters',
): Promise<T[]> {
  const db = await openSearchDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)
    const request = store.getAll()

    request.onsuccess = () => resolve((request as IDBRequest<T[]>).result)
    request.onerror = () => reject((request as IDBRequest<T[]>).error)
  })
}

export async function getFromStore<T>(
  storeName: 'search_history' | 'saved_filters',
  key: string,
): Promise<T | undefined> {
  const db = await openSearchDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)
    const request = store.get(key)

    request.onsuccess = () => resolve((request as IDBRequest<T>).result)
    request.onerror = () => reject((request as IDBRequest<T>).error)
  })
}

export async function putInStore<T>(
  storeName: 'search_history' | 'saved_filters',
  item: T,
): Promise<void> {
  const db = await openSearchDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const request = store.put(item)

    request.onsuccess = () => resolve()
    request.onerror = () => reject((request as IDBRequest<void>).error)
  })
}

export async function deleteFromStore(
  storeName: 'search_history' | 'saved_filters',
  key: string,
): Promise<void> {
  const db = await openSearchDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const request = store.delete(key)

    request.onsuccess = () => resolve()
    request.onerror = () => reject((request as IDBRequest<void>).error)
  })
}

export async function clearStore(
  storeName: 'search_history' | 'saved_filters',
): Promise<void> {
  const db = await openSearchDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const request = store.clear()

    request.onsuccess = () => resolve()
    request.onerror = () => reject((request as IDBRequest<void>).error)
  })
}
