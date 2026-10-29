// Almacenamiento persistente: se solicita cuando el navegador lo permite.
// Nunca se da por hecho que se ha concedido: siempre se comprueba.

export function persistenceSupported() {
  return Boolean(navigator.storage && typeof navigator.storage.persist === 'function');
}

/** 'granted' | 'not-granted' | 'unsupported' */
export async function getPersistenceStatus() {
  if (!navigator.storage || typeof navigator.storage.persisted !== 'function') return 'unsupported';
  try {
    return (await navigator.storage.persisted()) ? 'granted' : 'not-granted';
  } catch {
    return 'unsupported';
  }
}

/** Pide almacenamiento persistente. Devuelve el estado resultante. */
export async function requestPersistence() {
  if (!persistenceSupported()) return 'unsupported';
  try {
    if (await navigator.storage.persisted()) return 'granted';
    return (await navigator.storage.persist()) ? 'granted' : 'not-granted';
  } catch {
    return 'unsupported';
  }
}

/** true si la app se está usando instalada (pantalla de inicio). */
export function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}
