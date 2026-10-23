/**
 * Where the database lives between visits: the browser's IndexedDB.
 *
 * sql.js keeps the whole SQLite database in memory. After every change we
 * export it as bytes (the same bytes a .sqlite file on disk would have) and
 * tuck them into IndexedDB; on the next visit we read them back. IndexedDB is
 * used rather than localStorage because it stores binary data and isn't
 * capped at a few megabytes.
 */

const DB_NAME = "daytrace";
const STORE = "files";
const KEY = "main.sqlite";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Runs one request against the store and resolves with its result. */
async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = fn(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function loadBytes(): Promise<Uint8Array | null> {
  const value = await run<unknown>("readonly", (store) => store.get(KEY));
  return value instanceof Uint8Array ? value : null;
}

export async function saveBytes(bytes: Uint8Array): Promise<void> {
  await run("readwrite", (store) => store.put(bytes, KEY));
}
