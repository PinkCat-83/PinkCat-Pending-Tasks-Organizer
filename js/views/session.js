// Sesión en curso: qué se está haciendo y cómo ha ido al terminar.

import { t, formatTime } from '../i18n.js';
import * as store from '../store.js';
import { CONFIG } from '../config.js';
import {
  el,
  navigate,
  showToast,
  showError,
  confirmDialog,
  screenHeader,
  field,
  formError,
  setFormError,
  uniqueId,
} from '../ui.js';

export async function sessionView() {
  const session = await store.getCurrentSession();
  const root = el('div', { class: 'view view-session' });

  if (!session) {
    root.append(
      screenHeader(t('session.title')),
      el('p', { class: 'lead', text: t('session.none') }),
      el('a', { class: 'btn btn-primary btn-block', href: '#/today', text: t('session.backToToday') }),
    );
    return root;
  }

  const project = session.projectId ? await store.getProject(session.projectId) : null;
  const subject = project ? project.name : session.projectName || session.customTask;

  root.append(screenHeader(t('session.title')));

  // Qué se está haciendo
  root.append(
    el(
      'section',
      { class: 'session-focus', 'aria-label': t('session.focusLabel') },
      el('p', { class: 'session-subject', text: subject }),
      el('p', { class: 'session-task', text: project ? t('today.task') : t('session.customTask') }),
      project?.desiredOutcome &&
        el(
          'div',
          { class: 'hero-outcome' },
          el('p', { class: 'hero-outcome-label', text: t('today.outcomeLabel') }),
          el('p', { class: 'hero-outcome-text', text: project.desiredOutcome }),
        ),
      el('p', { class: 'muted', text: t('session.startedAt', { time: formatTime(session.startedAt) }) }),
    ),
  );

  // Intención para la sesión (se guarda mientras se escribe)
  const intention = el('textarea', {
    rows: '2',
    maxlength: String(CONFIG.maxLength.shortText),
    value: session.intention || '',
  });
  let saveTimer = null;
  intention.addEventListener('input', () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => store.updateSessionIntention(intention.value).catch(showError), 400);
  });
  root.append(
    el(
      'section',
      { class: 'section' },
      field({ label: t('session.intentionLabel'), hint: t('session.intentionHint'), control: intention, optional: true }),
    ),
  );

  // Cierre de la sesión
  const resultName = uniqueId('result');
  const resultOptions = store.SESSION_RESULTS.map((result) =>
    el(
      'label',
      { class: 'choice' },
      el('input', { type: 'radio', name: resultName, value: result }),
      el('span', { text: t(`session.results.${result}`) }),
    ),
  );

  const note = el('textarea', { rows: '3', maxlength: String(CONFIG.maxLength.longText) });

  // Opciones sobre el proyecto (solo si la sesión es de un proyecto todavía abierto)
  const canChangeProject = project && [store.STATUS.ACTIVE, store.STATUS.PARKED].includes(project.status);
  const completeBox = el('input', { type: 'checkbox', name: 'complete' });
  const discardBox = el('input', { type: 'checkbox', name: 'discard' });
  const discardChoice = el(
    'label',
    { class: 'choice', hidden: true },
    discardBox,
    el('span', { text: t('session.discardProject') }),
  );
  const projectOptions =
    canChangeProject &&
    el(
      'fieldset',
      { class: 'fieldset' },
      el('legend', { class: 'label', text: t('session.projectOptions') }),
      el('label', { class: 'choice' }, completeBox, el('span', { text: t('session.completeProject') })),
      discardChoice,
    );

  completeBox.addEventListener('change', () => {
    if (completeBox.checked) discardBox.checked = false;
  });
  discardBox.addEventListener('change', () => {
    if (discardBox.checked) completeBox.checked = false;
  });

  const error = formError();
  const save = el('button', { type: 'submit', class: 'btn btn-primary btn-block btn-large', text: t('session.save') });

  const form = el(
    'form',
    {
      class: 'form',
      novalidate: true,
      onChange: () => {
        const selected = form.querySelector(`input[name="${resultName}"]:checked`);
        if (canChangeProject) {
          discardChoice.hidden = !(selected && selected.value === 'obsolete');
          if (discardChoice.hidden) discardBox.checked = false;
        }
        if (selected) setFormError(error, '');
      },
      onSubmit: async (event) => {
        event.preventDefault();
        const selected = form.querySelector(`input[name="${resultName}"]:checked`);
        if (!selected) {
          setFormError(error, t('errors.resultRequired'));
          resultOptions[0].querySelector('input').focus();
          return;
        }
        const projectAction = completeBox.checked ? 'complete' : discardBox.checked ? 'discard' : null;
        if (projectAction) {
          const ok = await confirmDialog({
            title: t(projectAction === 'complete' ? 'project.completeTitle' : 'project.discardTitle'),
            message: t(
              project.status === store.STATUS.ACTIVE
                ? projectAction === 'complete'
                  ? 'project.completeActiveMessage'
                  : 'project.discardActiveMessage'
                : projectAction === 'complete'
                  ? 'project.completeMessage'
                  : 'project.discardMessage',
              { name: project.name },
            ),
            confirmLabel: t(projectAction === 'complete' ? 'project.complete' : 'project.discard'),
          });
          if (!ok) return;
        }
        save.disabled = true;
        try {
          clearTimeout(saveTimer);
          await store.updateSessionIntention(intention.value);
          await store.finishSession({ result: selected.value, note: note.value, projectAction });
          showToast(t('session.saved'));
          navigate('today');
        } catch (err) {
          save.disabled = false;
          showError(err);
        }
      },
    },
    el(
      'fieldset',
      { class: 'fieldset' },
      el('legend', { class: 'label', text: t('session.resultQuestion') }),
      ...resultOptions,
    ),
    field({ label: t('session.noteLabel'), control: note, optional: true }),
    projectOptions,
    error,
    save,
  );

  const cancel = el('button', {
    type: 'button',
    class: 'btn btn-ghost btn-block',
    text: t('session.cancel'),
    onClick: async () => {
      const ok = await confirmDialog({
        title: t('session.cancelTitle'),
        message: t('session.cancelMessage'),
        confirmLabel: t('session.cancelConfirm'),
        cancelLabel: t('session.keepGoing'),
        danger: true,
      });
      if (!ok) return;
      try {
        await store.cancelSession();
        navigate('today');
      } catch (err) {
        showError(err);
      }
    },
  });

  root.append(
    el(
      'section',
      { class: 'section', 'aria-labelledby': 'finish-heading' },
      el('h2', { id: 'finish-heading', class: 'section-title', text: t('session.finishTitle') }),
      form,
      cancel,
    ),
  );
  return root;
}
