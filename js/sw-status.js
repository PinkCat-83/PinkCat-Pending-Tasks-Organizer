// Registro del service worker y aviso de nuevas versiones.

import { t } from './i18n.js';
import { el } from './ui.js';

let status = 'checking';

/** 'ready' | 'checking' | 'unsupported' | 'insecure' | 'error' */
export function getServiceWorkerStatus() {
  return status;
}

function showUpdateBanner(worker) {
  const banners = document.getElementById('banners');
  if (!banners || banners.querySelector('.banner-update')) return;
  banners.append(
    el(
      'div',
      { class: 'banner banner-update' },
      el('span', { text: t('app.updateAvailable') }),
      el('button', {
        type: 'button',
        class: 'btn btn-small btn-primary',
        text: t('app.updateNow'),
        onClick: () => {
          sessionStorage.setItem('pinkcat.updating', '1');
          worker.postMessage('SKIP_WAITING');
        },
      }),
    ),
  );
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    status = 'unsupported';
    return;
  }
  if (!window.isSecureContext) {
    status = 'insecure';
    return;
  }
  try {
    const registration = await navigator.serviceWorker.register('./sw.js');
    await navigator.serviceWorker.ready;
    status = 'ready';

    if (registration.waiting && navigator.serviceWorker.controller) showUpdateBanner(registration.waiting);
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner(worker);
      });
    });

    // Solo se recarga si el usuario ha pedido actualizar.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (sessionStorage.getItem('pinkcat.updating') === '1') {
        sessionStorage.removeItem('pinkcat.updating');
        location.reload();
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update().catch(() => {});
    });
  } catch (error) {
    console.error(error);
    status = 'error';
  }
}
