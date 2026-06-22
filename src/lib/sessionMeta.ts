/**
 * Client-side session metadata store.
 *
 * Stores session title, description, and tags locally in IndexedDB.
 * NOT shared with the server or other collaborators — these are local-only annotations.
 * Each entry is keyed by session ID (the URL path segment).
 *
 * This is deliberately a simple IndexedDB wrapper with no sync mechanism.
 */

const DB_NAME = "mysshx-session-meta";
const DB_VERSION = 1;
const STORE_NAME = "metadata";

export interface SessionMeta {
  /** Session ID from URL (e.g. "aB3xK9mZ2p") */
  id: string;
  /** User-chosen title */
  title: string;
  /** Optional description */
  description: string;
  /** Optional tags */
  tags: string[];
  /** Last updated timestamp */
  updatedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Load metadata for a session. Returns null if none saved. */
export async function loadMeta(sessionId: string): Promise<SessionMeta | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(sessionId);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

/** Save or update metadata for a session. */
export async function saveMeta(meta: SessionMeta): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put({ ...meta, updatedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Delete metadata for a session. */
export async function deleteMeta(sessionId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(sessionId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** List all saved session metadata entries. */
export async function listAllMeta(): Promise<SessionMeta[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}
