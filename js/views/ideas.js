// Ideas: un bloc de notas que no afecta a los proyectos ni a la prioridad.

import { t, formatDateTime } from '../i18n.js';
import * as store from '../store.js';
import { CONFIG } from '../config.js';
import {
  el,
  navigate,
  showToast,
  showError,
  confirmDialog,
  textDialog,
  screenHeader,
  field,
  formError,
  setFormError,
} from '../ui.js';
import { requestPersistence } from '../persistence.js';

/** Diálogo rápido para anotar una idea desde cualquier pantalla. */
export async function quickAddIdea() {
  const text = await textDialog({
    title: t('ideas.quickAddTitle'),
    label: t('ideas.fieldLabel'),
    hint: t('ideas.fieldHint'),
    confirmLabel: t('ideas.save'),
    maxLength: CONFIG.maxLength.longText,
  });
  if (!text) return;
  try {
    await store.addIdea(text);
    showToast(t('ideas.saved'));
    requestPersistence();
    if (location.hash === '#/ideas') navigate('ideas');
  } catch (error) {
    showError(error);
  }
}

function ideaItem(idea) {
  const item = el('li', { class: 'idea' });

  function renderRead() {
    item.replaceChildren(
      el('p', { class: 'idea-text', text: idea.text }),
      el('p', { class: 'list-meta', text: formatDateTime(idea.createdAt) }),
      el(
        'div',
        { class: 'idea-actions' },
        el('button', { type: 'button', class: 'btn btn-small btn-ghost', text: t('ideas.edit'), onClick: renderEdit }),
        el('a', {
          class: 'btn btn-small btn-ghost',
          href: `#/projects/new?fromIdea=${encodeURIComponent(idea.id)}`,
          text: t('ideas.toProject'),
        }),
        el('button', {
          type: 'button',
          class: 'btn btn-small btn-ghost btn-ghost-danger',
          text: t('ideas.delete'),
          onClick: async () => {
            const ok = await confirmDialog({
              title: t('ideas.deleteTitle'),
              message: t('ideas.deleteMessage'),
              confirmLabel: t('ideas.delete'),
              danger: true,
            });
            if (!ok) return;
            try {
              await store.deleteIdea(idea.id);
              showToast(t('ideas.deleted'));
              navigate('ideas');
            } catch (error) {
              showError(error);
            }
          },
        }),
      ),
    );
  }

  function renderEdit() {
    const textarea = el('textarea', { rows: '4', maxlength: String(CONFIG.maxLength.longText), value: idea.text });
    const error = formError();
    item.replaceChildren(
      el(
        'form',
        {
          class: 'form form-inline',
          novalidate: true,
          onSubmit: async (event) => {
            event.preventDefault();
            if (!textarea.value.trim()) {
              setFormError(error, t('errors.ideaRequired'));
              return;
            }
            try {
              idea = await store.updateIdea(idea.id, textarea.value);
              showToast(t('ideas.updated'));
              renderRead();
            } catch (err) {
              showError(err);
            }
          },
        },
        field({ label: t('ideas.editLabel'), control: textarea }),
        error,
        el(
          'div',
          { class: 'idea-actions' },
          el('button', { type: 'submit', class: 'btn btn-small btn-primary', text: t('ideas.save') }),
          el('button', { type: 'button', class: 'btn btn-small btn-ghost', text: t('common.cancel'), onClick: renderRead }),
        ),
      ),
    );
    textarea.focus();
  }

  renderRead();
  return item;
}

export async function ideasView() {
  const ideas = await store.listIdeas();
  const root = el('div', { class: 'view' });
  root.append(screenHeader(t('ideas.title')), el('p', { class: 'lead', text: t('ideas.intro') }));

  const textarea = el('textarea', { rows: '3', maxlength: String(CONFIG.maxLength.longText) });
  const error = formError();
  root.append(
    el(
      'form',
      {
        class: 'form',
        novalidate: true,
        onSubmit: async (event) => {
          event.preventDefault();
          if (!textarea.value.trim()) {
            setFormError(error, t('errors.ideaRequired'));
            textarea.focus();
            return;
          }
          try {
            await store.addIdea(textarea.value);
            showToast(t('ideas.saved'));
            requestPersistence();
            navigate('ideas');
          } catch (err) {
            showError(err);
          }
        },
      },
      field({ label: t('ideas.fieldLabel'), hint: t('ideas.fieldHint'), control: textarea }),
      error,
      el('button', { type: 'submit', class: 'btn btn-primary btn-block', text: t('ideas.save') }),
    ),
  );

  if (!ideas.length) {
    root.append(el('p', { class: 'empty muted', text: t('ideas.empty') }));
  } else {
    root.append(
      el(
        'section',
        { class: 'section', 'aria-labelledby': 'ideas-list' },
        el('h2', { id: 'ideas-list', class: 'section-title', text: t('ideas.listTitle', { count: ideas.length }) }),
        el('ul', { class: 'ideas', role: 'list' }, ideas.map(ideaItem)),
      ),
    );
  }
  return root;
}
