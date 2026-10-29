// Pantalla «Hoy»: una sola recomendación, basada en el proyecto prioritario.

import { t, capitalizeFirst, formatLongDate, formatDate, relativeDays, daysUntil } from '../i18n.js';
import * as store from '../store.js';
import { CONFIG } from '../config.js';
import { el, navigate, showToast, showError, confirmDialog } from '../ui.js';
import { quickAddIdea } from './ideas.js';

export async function todayView() {
  const [projects, current] = await Promise.all([store.listProjects(), store.getCurrentSession()]);
  const active = projects.find((p) => p.status === store.STATUS.ACTIVE) || null;

  const root = el('div', { class: 'view view-today' });
  root.append(el('p', { class: 'today-date', text: capitalizeFirst(formatLongDate()) }));

  if (projects.length === 0) {
    root.append(
      el('h1', { class: 'screen-title', text: t('today.title') }),
      el(
        'div',
        { class: 'empty' },
        el('p', { text: t('today.empty.text') }),
        el('a', { class: 'btn btn-primary btn-block', href: '#/projects/new', text: t('today.empty.action') }),
      ),
      extraActions(),
    );
    return root;
  }

  if (current) root.append(sessionBanner(current));

  if (active) root.append(recommendation(active, current));
  else root.append(noPriority(projects, current));

  const warnings = deadlineWarnings(projects);
  if (warnings) root.append(warnings);

  root.append(extraActions());
  return root;
}

function sessionBanner(session) {
  const what = session.projectName || session.customTask;
  return el(
    'section',
    { class: 'notice notice-session', 'aria-label': t('today.sessionInProgress.label') },
    el('p', { class: 'notice-text', text: t('today.sessionInProgress.text', { what }) }),
    el('a', { class: 'btn btn-primary btn-block', href: '#/session', text: t('session.resume') }),
  );
}

function lastWorkedText(project) {
  if (!project.lastWorkedAt) return t('today.noProgressYet');
  return t('today.lastWorked', { when: relativeDays(Math.min(0, daysUntil(project.lastWorkedAt))) });
}

function recommendation(project, current) {
  const start = el('button', {
    type: 'button',
    class: 'btn btn-primary btn-block btn-large',
    text: t('today.start'),
    onClick: async () => {
      start.disabled = true;
      try {
        await store.startSession({ projectId: project.id });
        navigate('session');
      } catch (error) {
        start.disabled = false;
        showError(error);
      }
    },
  });

  return el(
    'section',
    { class: 'hero', 'aria-labelledby': 'today-heading' },
    el('h1', { id: 'today-heading', class: 'hero-label', text: t('today.title') }),
    el('p', { class: 'hero-project' }, el('a', { href: `#/projects/${project.id}`, text: project.name })),
    el('p', { class: 'hero-task', text: t('today.task') }),
    project.desiredOutcome &&
      el(
        'div',
        { class: 'hero-outcome' },
        el('p', { class: 'hero-outcome-label', text: t('today.outcomeLabel') }),
        el('p', { class: 'hero-outcome-text', text: project.desiredOutcome }),
      ),
    el('p', { class: 'hero-meta', text: lastWorkedText(project) }),
    !current &&
      el(
        'div',
        { class: 'hero-actions' },
        start,
        el('a', { class: 'btn btn-secondary btn-block', href: '#/choose', text: t('today.chooseOther') }),
      ),
  );
}

function noPriority(projects, current) {
  const parked = store.sortProjects(projects.filter((p) => p.status === store.STATUS.PARKED));
  const section = el(
    'section',
    { class: 'no-priority' },
    el('h1', { class: 'screen-title', text: t('today.title') }),
    el('p', { class: 'lead', text: t('today.noPriority.text') }),
  );

  if (!parked.length) {
    section.append(
      el('p', { text: t('today.noPriority.nothingParked') }),
      el('a', { class: 'btn btn-primary btn-block', href: '#/projects/new', text: t('projects.new') }),
    );
    return section;
  }

  section.append(el('h2', { class: 'section-title', text: t('today.noPriority.pick') }));
  const list = el('ul', { class: 'list', role: 'list' });
  for (const project of parked) {
    list.append(
      el(
        'li',
        { class: 'list-row' },
        el(
          'div',
          { class: 'list-main' },
          el('a', { class: 'list-title', href: `#/projects/${project.id}`, text: project.name }),
          el('p', { class: 'list-meta', text: t(`importance.${project.importance}`) }),
        ),
        el('button', {
          type: 'button',
          class: 'btn btn-small btn-secondary',
          text: t('priority.makeShort'),
          'aria-label': t('priority.makeFor', { name: project.name }),
          onClick: async () => {
            const ok = await confirmDialog({
              title: t('priority.makeTitle'),
              message: t('priority.makeMessage', { name: project.name }),
              confirmLabel: t('priority.makeConfirm'),
            });
            if (!ok) return;
            try {
              await store.changePriority(project.id);
              showToast(t('priority.done', { name: project.name }));
              navigate('today');
            } catch (error) {
              showError(error);
            }
          },
        }),
      ),
    );
  }
  section.append(list);
  if (!current) {
    section.append(el('a', { class: 'btn btn-secondary btn-block', href: '#/choose', text: t('today.workOnSomethingElse') }));
  }
  return section;
}

function deadlineWarnings(projects) {
  const upcoming = projects
    .filter(
      (p) =>
        [store.STATUS.ACTIVE, store.STATUS.PARKED].includes(p.status) &&
        p.deadline &&
        daysUntil(p.deadline) <= CONFIG.deadlineWarningDays,
    )
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
  if (!upcoming.length) return null;

  const list = el('ul', { class: 'list list-compact', role: 'list' });
  for (const project of upcoming) {
    list.append(
      el(
        'li',
        { class: 'list-row' },
        el(
          'div',
          { class: 'list-main' },
          el('a', { class: 'list-title', href: `#/projects/${project.id}`, text: project.name }),
          el('p', {
            class: 'list-meta',
            text: t('deadline.label', { when: relativeDays(daysUntil(project.deadline)), date: formatDate(project.deadline) }),
          }),
        ),
      ),
    );
  }
  return el(
    'section',
    { class: 'notice notice-deadline', 'aria-labelledby': 'deadline-heading' },
    el('h2', { id: 'deadline-heading', class: 'section-title', text: t('deadline.title') }),
    list,
    el('p', { class: 'hint', text: t('deadline.hint') }),
  );
}

function extraActions() {
  return el(
    'div',
    { class: 'today-extra' },
    el('button', { type: 'button', class: 'btn btn-ghost', text: t('ideas.quickAdd'), onClick: () => quickAddIdea() }),
    el('a', { class: 'btn btn-ghost', href: '#/projects', text: t('today.seeProjects') }),
  );
}
