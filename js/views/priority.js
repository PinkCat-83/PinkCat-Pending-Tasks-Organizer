// Cambio consciente de prioridad: motivo obligatorio y confirmación.

import { t } from '../i18n.js';
import * as store from '../store.js';
import { CONFIG } from '../config.js';
import { el, navigate, showToast, showError, screenHeader, field, formError, setFormError, uniqueId } from '../ui.js';

export async function priorityView({ params }) {
  const [id] = params;
  const [target, current] = await Promise.all([store.getProject(id), store.getActiveProject()]);
  const root = el('div', { class: 'view' });
  const backHref = `#/projects/${id}`;

  root.append(screenHeader(t('priority.title'), { backHref, backLabel: t('common.cancel') }));

  if (!target || target.status !== store.STATUS.PARKED) {
    root.append(
      el('p', { class: 'lead', text: t('priority.notAvailable') }),
      el('a', { class: 'btn btn-secondary btn-block', href: '#/projects', text: t('nav.projects') }),
    );
    return root;
  }

  root.append(
    el(
      'dl',
      { class: 'swap' },
      el('dt', { text: t('priority.current') }),
      el('dd', { text: current ? current.name : t('priority.noCurrent') }),
      el('dt', { text: t('priority.next') }),
      el('dd', { class: 'swap-next', text: target.name }),
    ),
    el('p', { class: 'hint', text: t('priority.keepsData') }),
  );

  const reasonName = uniqueId('reason');
  const reasons = current
    ? el(
        'fieldset',
        { class: 'fieldset' },
        el('legend', { class: 'label', text: t('priority.reasonQuestion') }),
        store.PRIORITY_REASONS.map((reason) =>
          el(
            'label',
            { class: 'choice' },
            el('input', { type: 'radio', name: reasonName, value: reason }),
            el('span', { text: t(`priority.reasons.${reason}`) }),
          ),
        ),
      )
    : null;
  const note = el('textarea', { rows: '3', maxlength: String(CONFIG.maxLength.longText) });
  const error = formError();
  const confirm = el('button', { type: 'submit', class: 'btn btn-primary btn-block btn-large', text: t('priority.confirm') });

  const form = el(
    'form',
    {
      class: 'form',
      novalidate: true,
      onChange: () => setFormError(error, ''),
      onSubmit: async (event) => {
        event.preventDefault();
        const selected = form.querySelector(`input[name="${reasonName}"]:checked`);
        if (current && !selected) {
          setFormError(error, t('errors.reasonRequired'));
          form.querySelector(`input[name="${reasonName}"]`).focus();
          return;
        }
        confirm.disabled = true;
        try {
          await store.changePriority(target.id, { reason: selected ? selected.value : null, note: note.value });
          showToast(t('priority.done', { name: target.name }));
          navigate('today');
        } catch (err) {
          confirm.disabled = false;
          showError(err);
        }
      },
    },
    reasons,
    field({ label: t('priority.noteLabel'), control: note, optional: true }),
    error,
    confirm,
    el('a', { class: 'btn btn-secondary btn-block', href: backHref, text: t('common.cancel') }),
  );
  root.append(form);
  return root;
}
