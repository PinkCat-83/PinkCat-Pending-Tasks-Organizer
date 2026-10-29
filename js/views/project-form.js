// Crear o editar un proyecto. Solo el nombre es obligatorio.

import { t } from '../i18n.js';
import * as store from '../store.js';
import { CONFIG } from '../config.js';
import { el, navigate, showToast, showError, confirmDialog, screenHeader, field, formError, setFormError } from '../ui.js';
import { requestPersistence } from '../persistence.js';

export async function projectFormView({ params, query }) {
  const [id] = params;
  const editing = Boolean(id);
  const project = editing ? await store.getProject(id) : null;
  const root = el('div', { class: 'view' });

  if (editing && !project) {
    root.append(
      screenHeader(t('project.notFoundTitle'), { backHref: '#/projects', backLabel: t('nav.projects') }),
      el('p', { class: 'lead', text: t('errors.projectNotFound') }),
    );
    return root;
  }

  // Proyecto creado a partir de una idea del bloc de notas
  const ideaId = !editing ? query.get('fromIdea') : null;
  const idea = ideaId ? await store.getIdea(ideaId) : null;

  const active = await store.getActiveProject();
  const backHref = editing ? `#/projects/${project.id}` : idea ? '#/ideas' : '#/projects';

  root.append(
    screenHeader(t(editing ? 'project.editTitle' : 'project.newTitle'), {
      backHref,
      backLabel: t('common.cancel'),
    }),
  );

  const firstLine = idea ? idea.text.split('\n')[0].slice(0, CONFIG.maxLength.name) : '';
  const name = el('input', {
    type: 'text',
    name: 'name',
    required: true,
    maxlength: String(CONFIG.maxLength.name),
    autocomplete: 'off',
    value: project?.name ?? firstLine,
  });
  const desiredOutcome = el('textarea', {
    name: 'desiredOutcome',
    rows: '2',
    maxlength: String(CONFIG.maxLength.longText),
    value: project?.desiredOutcome ?? '',
  });
  const description = el('textarea', {
    name: 'description',
    rows: '3',
    maxlength: String(CONFIG.maxLength.longText),
    value: project?.description ?? (idea ? idea.text : ''),
  });
  const importance = el(
    'select',
    { name: 'importance' },
    store.IMPORTANCE.map((level) =>
      el('option', {
        value: level,
        selected: (project?.importance ?? 'medium') === level,
        text: t(`importance.${level}`),
      }),
    ),
  );
  const deadline = el('input', { type: 'date', name: 'deadline', value: project?.deadline ?? '' });

  const makeActive = el('input', { type: 'checkbox', name: 'makeActive', checked: !active });
  const statusInfo = editing
    ? null
    : active
      ? el('p', { class: 'hint', text: t('project.form.parkedNote', { name: active.name }) })
      : el('label', { class: 'choice' }, makeActive, el('span', { text: t('project.form.makeActive') }));

  const error = formError();
  const save = el('button', { type: 'submit', class: 'btn btn-primary btn-block btn-large', text: t('project.form.save') });

  const form = el(
    'form',
    {
      class: 'form',
      novalidate: true,
      onSubmit: async (event) => {
        event.preventDefault();
        if (!name.value.trim()) {
          setFormError(error, t('errors.nameRequired'));
          name.focus();
          return;
        }
        setFormError(error, '');
        const data = {
          name: name.value,
          desiredOutcome: desiredOutcome.value,
          description: description.value,
          importance: importance.value,
          deadline: deadline.value,
        };
        save.disabled = true;
        try {
          let saved;
          if (editing) {
            saved = await store.updateProject(project.id, data);
            showToast(t('project.form.updated'));
          } else {
            saved = await store.createProject(data, { makeActive: !active && makeActive.checked });
            showToast(t('project.form.created'));
            requestPersistence();
            if (idea) {
              const remove = await confirmDialog({
                title: t('ideas.afterConvertTitle'),
                message: t('ideas.afterConvertMessage'),
                confirmLabel: t('ideas.delete'),
                cancelLabel: t('ideas.keep'),
              });
              if (remove) await store.deleteIdea(idea.id);
            }
          }
          navigate(`projects/${saved.id}`);
        } catch (err) {
          save.disabled = false;
          showError(err);
        }
      },
    },
    field({ label: t('project.fields.name'), control: name }),
    field({
      label: t('project.fields.desiredOutcome'),
      hint: t('project.form.desiredOutcomeHint'),
      control: desiredOutcome,
      optional: true,
    }),
    field({ label: t('project.fields.description'), control: description, optional: true }),
    field({ label: t('project.fields.importance'), control: importance }),
    field({
      label: t('project.fields.deadline'),
      hint: t('project.form.deadlineHint'),
      control: deadline,
      optional: true,
    }),
    statusInfo,
    error,
    save,
  );

  root.append(form);
  return root;
}
