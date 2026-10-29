// Acceso mínimo a IndexedDB. Todos los datos se quedan en el dispositivo.

import { CONFIG } from './config.js';

export const STORES = Object.freeze({
  projects: 'projects',
  sessions: 'sessions',
  history: 'history',
  ideas: 'ideas',
  meta: 'meta',
});

let dbPromise = null;

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window) || !window.indexedDB) {
      reject(new Error('indexeddb-unavailable'));
      return;
    }
    const request = indexedDB.open(CONFIG.dbName, CONFIG.dbVersion);

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of [STORES.projects, STORES.sessions, STORES.history, STORES.ideas]) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.meta)) {
        db.createObjectStore(STORES.meta, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('indexeddb-blocked'));
  });

  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

export async function getAll(store) {
  const db = await openDB();
  return promisify(db.transaction(store, 'readonly').objectStore(store).getAll());
}

export async function get(store, key) {
  const db = await openDB();
  return promisify(db.transaction(store, 'readonly').objectStore(store).get(key));
}

export async function put(store, value) {
  return transaction([store], (tx) => tx.objectStore(store).put(value));
}

export async function remove(store, key) {
  return transaction([store], (tx) => tx.objectStore(store).delete(key));
}

/**
 * Ejecuta varias escrituras de forma atómica.
 * `work` recibe la transacción y debe lanzar las peticiones de forma síncrona.
 * Si algo falla, no se guarda nada.
 */
export async function transaction(storeNames, work) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, 'readwrite');
    let result;
    try {
      result = work(tx);
    } catch (error) {
      try {
        tx.abort();
      } catch {
        // La transacción ya puede estar cerrada.
      }
      reject(error);
      return;
    }
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('transaction-aborted'));
  });
}
