// Datos: privacidad, almacenamiento, copias de seguridad e instalación.

import { t, formatDateTime } from '../i18n.js';
import * as store from '../store.js';
import { CONFIG } from '../config.js';
import {
  buildExport,
  canShareFiles,
  shareBackup,
  downloadBackup,
  validateBackup,
  replaceAllData,
} from '../backup.js';
import { getPersistenceStatus, requestPersistence, persistenceSupported, isStandalone } from '../persistence.js';
import { el, navigate, showToast, showError, confirmDialog, screenHeader, uniqueId } from '../ui.js';
import { getServiceWorkerStatus } from '../sw-status.js';

export async function dataView() {
  // La copia se prepara al abrir la pantalla para que «Compartir» se
  // ejecute directamente desde el toque (Safari lo exige).
  const [counts, payload, persistence] = await Promise.all([
    store.countAll(),
    buildExport(),
    getPersistenceStatus(),
  ]);

  const root = el('div', { class: 'view view-data' });
  root.append(screenHeader(t('data.title')));

  // ---- Dónde están los datos ----
  const persistenceText = el('p', { class: 'status-line', text: t(`data.persistence.${persistence}`) });
  const persistButton =
    persistence === 'not-granted' && persistenceSupported()
      ? el('button', {
          type: 'button',
          class: 'btn btn-secondary btn-block',
          text: t('data.persistence.request'),
          onClick: async () => {
            const result = await requestPersistence();
            persistenceText.textContent = t(`data.persistence.${result}`);
            if (result === 'granted') persistButton.remove();
            else showToast(t('data.persistence.denied'));
          },
        })
      : null;

  root.append(
    el(
      'section',
      { class: 'section', 'aria-labelledby': 'data-local' },
      el('h2', { id: 'data-local', class: 'section-title', text: t('data.local.title') }),
      el('p', { text: t('data.local.text') }),
      el('p', { class: 'notice notice-warning', text: t('data.local.warning') }),
      persistenceText,
      persistButton,
      el(
        'p',
        { class: 'muted' },
        t('data.counts', {
          projects: counts.projects,
          sessions: counts.sessions,
          history: counts.history,
          ideas: counts.ideas,
        }),
      ),
    ),
  );

  // ---- Exportar ----
  const sharing = canShareFiles();
  const exportSection = el(
    'section',
    { class: 'section', 'aria-labelledby': 'data-export' },
    el('h2', { id: 'data-export', class: 'section-title', text: t('data.export.title') }),
    el('p', { text: t(sharing ? 'data.export.textShare' : 'data.export.textDownload') }),
  );
  if (sharing) {
    exportSection.append(
      el('button', {
        type: 'button',
        class: 'btn btn-primary btn-block',
        text: t('data.export.share'),
        onClick: async () => {
          try {
            if (await shareBackup(payload)) showToast(t('data.export.shared'));
          } catch (error) {
            console.error(error);
            showToast(t('data.export.shareFailed'));
          }
        },
      }),
    );
  }
  exportSection.append(
    el('button', {
      type: 'button',
      class: sharing ? 'btn btn-secondary btn-block' : 'btn btn-primary btn-block',
      text: t('data.export.download'),
      onClick: () => {
        try {
          downloadBackup(payload);
          showToast(t('data.export.downloaded'));
        } catch (error) {
          showError(error);
        }
      },
    }),
  );
  root.append(exportSection);

  // ---- Importar ----
  const inputId = uniqueId('import');
  const result = el('div', { class: 'import-result', 'aria-live': 'polite' });
  const fileInput = el('input', {
    id: inputId,
    type: 'file',
    accept: 'application/json,.json',
    class: 'visually-hidden',
    tabindex: '-1',
    'aria-hidden': 'true',
    onChange: async () => {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      if (!file) return;
      result.replaceChildren();
      let text;
      try {
        text = await file.text();
      } catch {
        result.append(el('p', { class: 'form-error', text: t('backup.errors.unreadable') }));
        return;
      }
      const validation = validateBackup(text);
      if (!validation.ok) {
        const shown = validation.errors.slice(0, 5);
        result.append(
          el('p', { class: 'form-error', text: t('data.import.invalid') }),
          el('ul', { class: 'error-list' }, shown.map((e) => el('li', { text: t(e.key, e.params) }))),
          validation.errors.length > shown.length &&
            el('p', { class: 'muted', text: t('data.import.moreErrors', { count: validation.errors.length - shown.length }) }),
        );
        return;
      }
      const c = validation.counts;
      const ok = await confirmDialog({
        title: t('data.import.confirmTitle'),
        message: [
          validation.exportedAt ? t('data.import.exportedAt', { date: formatDateTime(validation.exportedAt) }) : '',
          t('data.counts', { projects: c.projects, sessions: c.sessions, history: c.history, ideas: c.ideas }),
          t('data.import.confirmMessage'),
        ]
          .filter(Boolean)
          .join('\n\n'),
        confirmLabel: t('data.import.confirm'),
        danger: true,
      });
      if (!ok) return;
      try {
        await replaceAllData(validation.data);
        showToast(t('data.import.done'));
        navigate('today');
      } catch (error) {
        showError(error);
      }
    },
  });

  root.append(
    el(
      'section',
      { class: 'section', 'aria-labelledby': 'data-import' },
      el('h2', { id: 'data-import', class: 'section-title', text: t('data.import.title') }),
      el('p', { text: t('data.import.text') }),
      fileInput,
      el('button', {
        type: 'button',
        class: 'btn btn-secondary btn-block',
        text: t('data.import.choose'),
        onClick: () => fileInput.click(),
      }),
      result,
    ),
  );

  // ---- Instalación y modo sin conexión ----
  const installed = isStandalone();
  const sw = getServiceWorkerStatus();
  root.append(
    el(
      'section',
      { class: 'section', 'aria-labelledby': 'data-install' },
      el('h2', { id: 'data-install', class: 'section-title', text: t('data.install.title') }),
      el('p', { class: 'status-line', text: t(installed ? 'data.install.standalone' : 'data.install.browser') }),
      !installed &&
        el(
          'ol',
          { class: 'steps' },
          el('li', { text: t('data.install.step1') }),
          el('li', { text: t('data.install.step2') }),
          el('li', { text: t('data.install.step3') }),
        ),
      el('p', { class: 'status-line', text: t(`data.offline.${sw}`) }),
    ),
  );

  root.append(el('p', { class: 'muted version', text: t('data.version', { version: CONFIG.appVersion }) }));
  return root;
}
