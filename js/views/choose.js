// «Elegir otra tarea»: otro proyecto aparcado o una tarea puntual.
// La prioridad no cambia; la elección queda registrada en el historial.

import { t } from '../i18n.js';
import * as store from '../store.js';
import { CONFIG } from '../config.js';
import { el, navigate, showError, screenHeader, field, formError, setFormError } from '../ui.js';

export async function chooseView() {
  const [projects, current] = await Promise.all([store.listProjects(), store.getCurrentSession()]);
  const root = el('div', { class: 'view' });
  root.append(screenHeader(t('choose.title'), { backHref: '#/today', backLabel: t('nav.today') }));

  if (current) {
    root.append(
      el('p', { class: 'lead', text: t('choose.sessionInProgress') }),
      el('a', { class: 'btn btn-primary btn-block', href: '#/session', text: t('session.resume') }),
    );
    return root;
  }

  root.append(el('p', { class: 'lead', text: t('choose.intro') }));

  async function start(options, button) {
    if (button) button.disabled = true;
    try {
      await store.startSession(options);
      navigate('session');
    } catch (error) {
      if (button) button.disabled = false;
      showError(error);
    }
  }

  // Otro proyecto
  const parked = store.sortProjects(projects.filter((p) => p.status === store.STATUS.PARKED));
  const projectSection = el(
    'section',
    { class: 'section', 'aria-labelledby': 'choose-project' },
    el('h2', { id: 'choose-project', class: 'section-title', text: t('choose.otherProject') }),
  );
  if (!parked.length) {
    projectSection.append(el('p', { class: 'muted', text: t('choose.noOtherProjects') }));
  } else {
    const list = el('ul', { class: 'list', role: 'list' });
    for (const project of parked) {
      const button = el(
        'button',
        {
          type: 'button',
          class: 'row-button',
          onClick: () => start({ projectId: project.id }, button),
        },
        el('span', { class: 'list-title', text: project.name }),
        project.desiredOutcome && el('span', { class: 'list-meta', text: project.desiredOutcome }),
      );
      list.append(el('li', { class: 'list-row list-row-button' }, button));
    }
    projectSection.append(list);
  }
  root.append(projectSection);

  // Tarea puntual
  const input = el('input', {
    type: 'text',
    name: 'customTask',
    maxlength: String(CONFIG.maxLength.shortText),
    autocomplete: 'off',
    required: true,
  });
  const error = formError();
  const submit = el('button', { type: 'submit', class: 'btn btn-primary btn-block', text: t('choose.startCustom') });
  const form = el(
    'form',
    {
      class: 'form',
      novalidate: true,
      onSubmit: (event) => {
        event.preventDefault();
        if (!input.value.trim()) {
          setFormError(error, t('errors.taskRequired'));
          input.focus();
          return;
        }
        setFormError(error, '');
        start({ customTask: input.value }, submit);
      },
    },
    field({ label: t('choose.customTaskLabel'), hint: t('choose.customTaskHint'), control: input }),
    error,
    submit,
  );
  root.append(
    el(
      'section',
      { class: 'section', 'aria-labelledby': 'choose-custom' },
      el('h2', { id: 'choose-custom', class: 'section-title', text: t('choose.customTask') }),
      form,
    ),
  );

  return root;
}
