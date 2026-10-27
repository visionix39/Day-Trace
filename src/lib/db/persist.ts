/**
 * Where a notebook lives on this device: the browser's IndexedDB.
 *
 * sql.js keeps the whole SQLite database in memory. After every change we
 * export it as bytes (the same bytes a .sqlite file on disk would have) and
 * tuck them into IndexedDB; on the next visit we read them back. IndexedDB is
 * used rather than localStorage because it stores binary data and isn't
 * capped at a few megabytes.
 *
 * Each account gets its own slot ("user-<id>"), and guests share one
 * ("guest"), so two people using the same browser never see each other's notes.
 */

const DB_NAME = "daytrace";
const STORE = "files";

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

const keyFor = (slot: string) => `${slot}.sqlite`;

export async function loadBytes(slot: string): Promise<Uint8Array | null> {
  const value = await run<unknown>("readonly", (store) => store.get(keyFor(slot)));
  if (value instanceof Uint8Array) return value;
  // Notebooks saved before accounts existed used one shared key.
  if (slot === "guest") {
    const legacy = await run<unknown>("readonly", (store) => store.get("main.sqlite"));
    if (legacy instanceof Uint8Array) return legacy;
  }
  return null;
}

export async function saveBytes(slot: string, bytes: Uint8Array): Promise<void> {
  await run("readwrite", (store) => store.put(bytes, keyFor(slot)));
}

/** Forgets this device's copy (on sign-out, so a shared computer keeps nothing). */
export async function deleteBytes(slot: string): Promise<void> {
  await run("readwrite", (store) => store.delete(keyFor(slot)));
}
