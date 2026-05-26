import { hashData } from './crypto'

/* -------------------------------------------------- */
/* Types                                              */
/* -------------------------------------------------- */

export interface DbEntry<T> {
  expiresAt: number
  hash: string
  key: string
  value: T
}

/* -------------------------------------------------- */
/* Internal helpers                                   */
/* -------------------------------------------------- */

const dbCache = new Map<string, Promise<IDBDatabase>>()
const dbVersions = new Map<string, number>()

const DB_PREFIX = 'smart'
const allowDb = ['smart-cache-v2'] as const
type AllowDB = (typeof allowDb)[number]

export async function dbDeleteKey(key: string, dbName: AllowDB, storeName: string): Promise<void> {
  const db = await openDB(dbName, storeName)
  const tx = db.transaction(storeName, 'readwrite')
  tx.objectStore(storeName).delete(key)
  await txDone(tx)
}

/* -------------------------------------------------- */
/* Delete single key                                  */
/* -------------------------------------------------- */

export async function dbDeleteKeysWithPart(part: string, dbName: AllowDB, storeName: string): Promise<void> {
  const db = await openDB(dbName, storeName)
  const tx = db.transaction(storeName, 'readwrite')
  const store = tx.objectStore(storeName)

  await new Promise<void>((resolve, reject) => {
    const req = store.openCursor()

    req.onerror = () => reject(req.error)
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) {
        resolve()
        return
      }

      const key = cursor.key

      if (typeof key === 'string' && key.startsWith(part) && !key.startsWith(`${part}/`)) {
        cursor.delete()
      }

      cursor.continue()
    }
  })

  await txDone(tx)
}

/* -------------------------------------------------- */
/* Delete keys containing part (cursor)                */
/* -------------------------------------------------- */

export async function dbEvictOldest(dbName: AllowDB, storeName: string): Promise<void> {
  const db = await openDB(dbName, storeName)
  const tx = db.transaction(storeName, 'readwrite')
  const store = tx.objectStore(storeName)

  const total = await requestToPromise(store.count())
  if (total === 0) {
    await txDone(tx)
    return
  }

  const limit = Math.floor(total / 2)
  if (limit === 0) {
    await txDone(tx)
    return
  }

  // If index doesn't exist for some reason, fail fast
  if (!store.indexNames.contains('expiresAt')) {
    await txDone(tx)
    return
  }

  const index = store.index('expiresAt')
  let removed = 0

  await new Promise<void>((resolve, reject) => {
    const req = index.openCursor()

    req.onerror = () => reject(req.error)
    req.onsuccess = () => {
      const cursor = req.result
      if (cursor === null || removed >= limit) {
        resolve()
        return
      }

      cursor.delete()
      removed += 1
      cursor.continue()
    }
  })

  await txDone(tx)

  // Optional: if we couldn't remove anything, caller might be stuck forever on QuotaExceeded
  // (e.g., browser quota is extremely low). Throw to stop infinite retries.
  if (removed === 0 && total > 0) {
    throw new Error('IndexedDB eviction removed 0 items')
  }
}

/* -------------------------------------------------- */
/* Evict oldest 50% (by expiresAt index)               */
/* -------------------------------------------------- */

export async function dbGet<T>(key: string, dbName: AllowDB, storeName: string): Promise<DbEntry<T> | null> {
  const db = await openDB(dbName, storeName)

  // read-only transaction for get
  {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)

    const entry = (await requestToPromise(store.get(key))) as DbEntry<T> | undefined

    await txDone(tx)

    if (entry === undefined) {
      return null
    }

    const expiresAt = entry.expiresAt
    if (expiresAt === undefined || Date.now() > expiresAt) {
      // separate write transaction for delete (can't delete in readonly)
      const tx2 = db.transaction(storeName, 'readwrite')
      tx2.objectStore(storeName).delete(key)
      await txDone(tx2)
      return null
    }

    return entry
  }
}

/* -------------------------------------------------- */
/* Get with TTL                                       */
/* -------------------------------------------------- */

// NOTE: hashData(value) must exist in your codebase.
export async function dbSafeSet<T>(
  key: string,
  value: T,
  dbName: AllowDB,
  storeName: string,
  ttl: number,
  retries = 1,
): Promise<void> {
  if (retries < 0) {
    throw new Error('IndexedDB quota exceeded permanently')
  }

  const db = await openDB(dbName, storeName)
  const hash = await hashData(value)

  const entry: DbEntry<T> = {
    expiresAt: Date.now() + ttl,
    hash,
    key,
    value,
  }

  try {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)

    // Support both old out-of-line and new in-line stores
    if (store.keyPath === null) {
      store.put(entry, key)
    } else {
      store.put(entry)
    }

    await txDone(tx)
  } catch (error) {
    const err = error as DOMException

    if (err?.name === 'QuotaExceededError') {
      // free space, then retry with SAME ttl and retries-1
      await dbEvictOldest(dbName, storeName)
      await dbSafeSet(key, value, dbName, storeName, ttl, retries - 1)
      return
    }

    throw err
  }
}

/* -------------------------------------------------- */
/* Safe set (handles quota with eviction)              */
/* -------------------------------------------------- */

export async function openDB(dbName: AllowDB, storeName: string): Promise<IDBDatabase> {
  const currentVersion = dbVersions.get(dbName) ?? 1
  const cacheKey = `${dbName}@v${currentVersion}`

  const cached = dbCache.get(cacheKey)
  if (cached !== undefined) {
    return cached
  }

  // Important: await cleanup to avoid delete/open races
  await cleanupOldDatabases()

  const openAtVersion = (version: number): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, version)

      req.onupgradeneeded = () => {
        const db = req.result
        let store: IDBObjectStore

        if (db.objectStoreNames.contains(storeName)) {
          const tx = req.transaction
          if (tx === null) {
            throw new Error('[openDB] Missing transaction during upgrade')
          }
          store = tx.objectStore(storeName)
        } else {
          store = db.createObjectStore(storeName, { keyPath: 'key' })
        }

        if (store.indexNames.contains('expiresAt') === false) {
          store.createIndex('expiresAt', 'expiresAt')
        }
      }

      req.onblocked = () => {
        // another tab still has old connection open; reject so caller can retry if needed
        reject(new Error(`[openDB] Upgrade blocked for "${dbName}"`))
      }

      req.onsuccess = () => {
        const db = req.result
        attachDbGuards(db)
        resolve(db)
      }

      req.onerror = () => reject(req.error)
    })

  const promise = openAtVersion(currentVersion)
  dbCache.set(cacheKey, promise)

  const db = await promise

  // If store exists, we're done
  if (db.objectStoreNames.contains(storeName)) {
    dbVersions.set(dbName, currentVersion)
    return db
  }

  // Otherwise upgrade version to create store
  try {
    db.close()
  } catch {
    // ignore
  }

  const nextVersion = currentVersion + 1
  dbVersions.set(dbName, nextVersion)

  const upgraded = await openAtVersion(nextVersion)
  dbCache.set(`${dbName}@v${nextVersion}`, Promise.resolve(upgraded))

  return upgraded
}

/* -------------------------------------------------- */
/* Open DB (safe, multi-store, versioned)              */
/* -------------------------------------------------- */

/**
 * Helpers to keep IndexedDB stable:
 * - close DB on versionchange to prevent "blocked" upgrades
 * - avoid hanging transactions
 */
function attachDbGuards(db: IDBDatabase): void {
  // If another tab tries to upgrade/delete, close our connection.
  db.onversionchange = () => {
    try {
      db.close()
    } catch {
      // ignore
    }
  }
}

/* -------------------------------------------------- */
/* Cleanup unknown old DBs                             */
/* -------------------------------------------------- */

async function cleanupOldDatabases(): Promise<void> {
  if (typeof indexedDB.databases !== 'function') {
    return
  }

  let databases: IDBDatabaseInfo[]

  try {
    databases = await indexedDB.databases()
  } catch (e) {
    console.error(e)
    return
  }

  for (const db of databases) {
    const name = db.name
    if (!name) {
      continue
    }
    if (!name.startsWith(DB_PREFIX)) {
      continue
    }
    if (allowDb.includes(name as AllowDB)) {
      continue
    }

    try {
      indexedDB.deleteDatabase(name)
    } catch {
      // ignore
    }
  }
}

/* -------------------------------------------------- */
/* Promisify helpers                                   */
/* -------------------------------------------------- */

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Transaction error'))
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'))
  })
}
