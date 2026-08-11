const DATABASE_NAME = 'the-commonplace-browser-cache'
const DATABASE_VERSION = 1
const STORE_NAME = 'records'

interface BrowserCacheRecord<T = unknown> {
  id: string
  namespace: string
  key: string
  value: T
  updatedAt: number
  expiresAt: number
}

let databasePromise: Promise<IDBDatabase | null> | null = null

function openDatabase() {
  if (databasePromise) return databasePromise
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)

  databasePromise = new Promise((resolve) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('namespace', 'namespace', { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })

  return databasePromise
}

function recordId(namespace: string, key: string) {
  return `${namespace}:${key}`
}

export async function getBrowserCacheValue<T>(namespace: string, key: string): Promise<T | undefined> {
  const database = await openDatabase()
  if (!database) return undefined

  return new Promise((resolve) => {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const request = transaction.objectStore(STORE_NAME).get(recordId(namespace, key))

    request.onsuccess = () => {
      const record = request.result as BrowserCacheRecord<T> | undefined
      if (!record) {
        resolve(undefined)
        return
      }

      if (record.expiresAt <= Date.now()) {
        void deleteBrowserCacheValue(namespace, key)
        resolve(undefined)
        return
      }

      resolve(record.value)
    }
    request.onerror = () => resolve(undefined)
  })
}

export async function setBrowserCacheValue<T>(
  namespace: string,
  key: string,
  value: T,
  ttlMs: number,
) {
  const database = await openDatabase()
  if (!database) return

  await new Promise<void>((resolve) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    const record: BrowserCacheRecord<T> = {
      id: recordId(namespace, key),
      namespace,
      key,
      value,
      updatedAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
    }
    try {
      transaction.objectStore(STORE_NAME).put(record)
    } catch {
      resolve()
      return
    }
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => resolve()
    transaction.onabort = () => resolve()
  })
}

export async function deleteBrowserCacheValue(namespace: string, key: string) {
  const database = await openDatabase()
  if (!database) return

  await new Promise<void>((resolve) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).delete(recordId(namespace, key))
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => resolve()
    transaction.onabort = () => resolve()
  })
}

export async function clearBrowserCacheNamespace(namespace: string) {
  const database = await openDatabase()
  if (!database) return

  await new Promise<void>((resolve) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    const index = transaction.objectStore(STORE_NAME).index('namespace')
    const request = index.openKeyCursor(IDBKeyRange.only(namespace))

    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor) return
      transaction.objectStore(STORE_NAME).delete(cursor.primaryKey)
      cursor.continue()
    }
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => resolve()
    transaction.onabort = () => resolve()
  })
}
