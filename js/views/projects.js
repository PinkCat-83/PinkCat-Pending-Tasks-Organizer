// Lista de proyectos y ficha de cada proyecto.

import { t, formatDate, formatDateTime, relativeDays, daysUntil } from '../i18n.js';
import * as store from '../store.js';
import { el, icon, ICONS, navigate, showToast, showError, confirmDialog, screenHeader } from '../ui.js';

function projectMeta(project) {
  const parts = [t(`importance.${project.importance}`)];
  if (project.deadline) parts.push(t('projects.deadlineShort', { date: formatDate(project.deadline) }));
  return parts.join(t('common.separator'));
}

function projectRow(project) {
  return el(
    'li',
    { class: 'list-row list-row-link' },
    el(
      'a',
      { class: 'row-link', href: `#/projects/${project.id}` },
      el(
        'span',
        { class: 'list-main' },
        el('span', { class: 'list-title', text: project.name }),
        el('span', { class: 'list-meta', text: projectMeta(project) }),
      ),
      icon(ICONS.chevron),
    ),
  );
}

function group(title, projects, { collapsible = false, emptyText = null } = {}) {
  if (!projects.length && !emptyText) return null;
  const content = projects.length
    ? el('ul', { class: 'list', role: 'list' }, projects.map(projectRow))
    : el('p', { class: 'muted', text: emptyText });
  const label = t('projects.groupCount', { title, count: projects.length });
  if (collapsible) {
    return el('details', { class: 'group' }, el('summary', { class: 'section-title', text: label }), content);
  }
  return el('section', { class: 'group' }, el('h2', { class: 'section-title', text: label }), content);
}

export async function projectsView() {
  const projects = await store.listProjects();
  const by = (status) => store.sortProjects(projects.filter((p) => p.status === status));

  const root = el('div', { class: 'view' });
  root.append(
    screenHeader(t('projects.title')),
    el('a', { class: 'btn btn-primary btn-block', href: '#/projects/new' }, icon(ICONS.plus), el('span', { text: t('projects.new') })),
  );

  if (!projects.length) {
    root.append(el('p', { class: 'empty muted', text: t('projects.empty') }));
    return root;
  }

  const groups = [
    group(t('status.active'), by(store.STATUS.ACTIVE), { emptyText: t('projects.noActive') }),
    group(t('projects.parkedGroup'), by(store.STATUS.PARKED)),
    group(t('projects.completedGroup'), by(store.STATUS.COMPLETED), { collapsible: true }),
    group(t('projects.discardedGroup'), by(store.STATUS.DISCARDED), { collapsible: true }),
  ];
  root.append(...groups.filter(Boolean));
  return root;
}

// ---------- Ficha ----------

function detailRow(label, value) {
  if (!value) return null;
  return [el('dt', { text: label }), el('dd', { text: value })];
}

export async function projectDetailView({ params }) {
  const [id] = params;
  const project = await store.getProject(id);
  const root = el('div', { class: 'view' });

  if (!project) {
    root.append(
      screenHeader(t('project.notFoundTitle'), { backHref: '#/projects', backLabel: t('nav.projects') }),
      el('p', { class: 'lead', text: t('errors.projectNotFound') }),
    );
    return root;
  }

  const sessions = await store.getProjectSessions(project.id);

  root.append(
    screenHeader(project.name, { backHref: '#/projects', backLabel: t('nav.projects') }),
    el('p', { class: `status status-${project.status}`, text: t(`status.${project.status}`) }),
  );

  let deadlineText = null;
  if (project.deadline) {
    deadlineText = `${formatDate(project.deadline)} (${relativeDays(daysUntil(project.deadline))})`;
  }

  root.append(
    el(
      'dl',
      { class: 'details' },
      detailRow(t('project.fields.desiredOutcome'), project.desiredOutcome),
      detailRow(t('project.fields.description'), project.description),
      detailRow(t('project.fields.importance'), t(`importance.${project.importance}`)),
      detailRow(t('project.fields.deadline'), deadlineText),
      detailRow(
        t('project.fields.lastWorkedAt'),
        project.lastWorkedAt ? formatDateTime(project.lastWorkedAt) : t('today.noProgressYet'),
      ),
      detailRow(t('project.fields.createdAt'), formatDate(project.createdAt)),
    ),
  );

  // Acciones según el estado
  const actions = el('div', { class: 'actions' });
  const isOpen = [store.STATUS.ACTIVE, store.STATUS.PARKED].includes(project.status);

  if (project.status === store.STATUS.PARKED) {
    actions.append(
      el('a', { class: 'btn btn-primary btn-block', href: `#/projects/${project.id}/priority`, text: t('priority.make') }),
    );
  }
  actions.append(el('a', { class: 'btn btn-secondary btn-block', href: `#/projects/${project.id}/edit`, text: t('project.edit') }));

  async function changeStatus(toStatus, { title, message, confirmLabel, done, danger = false }) {
    const ok = await confirmDialog({ title, message, confirmLabel, danger });
    if (!ok) return;
    try {
      await store.setProjectStatus(project.id, toStatus);
      showToast(done);
      navigate(`projects/${project.id}`);
    } catch (error) {
      showError(error);
    }
  }

  if (isOpen) {
    const isActive = project.status === store.STATUS.ACTIVE;
    actions.append(
      el('button', {
        type: 'button',
        class: 'btn btn-secondary btn-block',
        text: t('project.complete'),
        onClick: () =>
          changeStatus(store.STATUS.COMPLETED, {
            title: t('project.completeTitle'),
            message: t(isActive ? 'project.completeActiveMessage' : 'project.completeMessage', { name: project.name }),
            confirmLabel: t('project.complete'),
            done: t('project.completed'),
          }),
      }),
      el('button', {
        type: 'button',
        class: 'btn btn-ghost btn-block',
        text: t('project.discard'),
        onClick: () =>
          changeStatus(store.STATUS.DISCARDED, {
            title: t('project.discardTitle'),
            message: t(isActive ? 'project.discardActiveMessage' : 'project.discardMessage', { name: project.name }),
            confirmLabel: t('project.discard'),
            done: t('project.discarded'),
            danger: true,
          }),
      }),
    );
  } else {
    actions.append(
      el('button', {
        type: 'button',
        class: 'btn btn-secondary btn-block',
        text: t('project.recover'),
        onClick: () =>
          changeStatus(store.STATUS.PARKED, {
            title: t('project.recoverTitle'),
            message: t('project.recoverMessage', { name: project.name }),
            confirmLabel: t('project.recover'),
            done: t('project.recovered'),
          }),
      }),
    );
  }
  root.append(actions);

  // Sesiones recientes del proyecto
  const recent = el(
    'section',
    { class: 'section', 'aria-labelledby': 'recent-sessions' },
    el('h2', { id: 'recent-sessions', class: 'section-title', text: t('project.recentSessions') }),
  );
  if (!sessions.length) {
    recent.append(el('p', { class: 'muted', text: t('project.noSessions') }));
  } else {
    recent.append(
      el(
        'ul',
        { class: 'list list-compact', role: 'list' },
        sessions.map((s) =>
          el(
            'li',
            { class: 'list-row' },
            el(
              'div',
              { class: 'list-main' },
              el('p', { class: 'list-title', text: t(`session.results.${s.result}`) }),
              el('p', { class: 'list-meta', text: formatDateTime(s.endedAt || s.startedAt) }),
              s.note && el('p', { class: 'list-note', text: s.note }),
            ),
          ),
        ),
      ),
    );
  }
  root.append(recent);
  return root;
}
