// Historial: sesiones, cambios de prioridad, cambios de tarea y de estado.

import { t, capitalizeFirst, formatLongDate, formatTime, dayKey, parseDateValue } from '../i18n.js';
import * as store from '../store.js';
import { el, screenHeader } from '../ui.js';

export async function historyView() {
  const [items, projects] = await Promise.all([store.getHistoryFeed(), store.listProjects()]);
  const names = new Map(projects.map((p) => [p.id, p.name]));
  const nameOf = (id, fallback) => (id && names.get(id)) || fallback || t('history.unknownProject');

  const root = el('div', { class: 'view' });
  root.append(screenHeader(t('history.title')));

  if (!items.length) {
    root.append(el('p', { class: 'empty muted', text: t('history.empty') }));
    return root;
  }

  const groups = new Map();
  for (const item of items) {
    const key = dayKey(item.at);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  for (const [key, dayItems] of groups) {
    const year = parseDateValue(key).getFullYear();
    const sameYear = year === new Date().getFullYear();
    const heading = capitalizeFirst(formatLongDate(key)) + (sameYear ? '' : ` ${year}`);
    root.append(
      el(
        'section',
        { class: 'history-day' },
        el('h2', { class: 'section-title', text: heading }),
        el('ol', { class: 'timeline', role: 'list' }, dayItems.map((item) => entry(item, nameOf))),
      ),
    );
  }
  return root;
}

function entry(item, nameOf) {
  const d = item.data;
  let kind;
  let title;
  const lines = [];

  switch (item.kind) {
    case 'session':
      kind = t('history.kinds.session');
      title = d.projectId ? nameOf(d.projectId, d.projectName) : d.customTask;
      lines.push(t(`session.results.${d.result}`));
      if (!d.recommended) lines.push(d.projectId ? t('history.notRecommended') : t('history.customTask'));
      if (d.intention) lines.push(t('history.intention', { text: d.intention }));
      if (d.note) lines.push(t('history.note', { text: d.note }));
      break;
    case store.HISTORY_TYPES.PRIORITY:
      kind = t('history.kinds.priorityChange');
      if (d.fromProjectId) {
        title = t('history.priorityFromTo', {
          from: nameOf(d.fromProjectId, d.fromProjectName),
          to: nameOf(d.toProjectId, d.toProjectName),
        });
      } else {
        title = t('history.priorityNew', { to: nameOf(d.toProjectId, d.toProjectName) });
      }
      if (d.reason) lines.push(t('history.reason', { reason: t(`priority.reasons.${d.reason}`) }));
      if (d.note) lines.push(t('history.note', { text: d.note }));
      break;
    case store.HISTORY_TYPES.TASK:
      kind = t('history.kinds.taskChange');
      title = d.chosenProjectId ? nameOf(d.chosenProjectId, d.chosenProjectName) : d.customTask;
      lines.push(
        d.recommendedProjectId
          ? t('history.insteadOf', { name: nameOf(d.recommendedProjectId, d.recommendedProjectName) })
          : t('history.noRecommendation'),
      );
      break;
    case store.HISTORY_TYPES.STATUS:
      kind = t('history.kinds.statusChange');
      title = nameOf(d.projectId, d.projectName);
      lines.push(t(`history.statusTo.${d.toStatus}`));
      break;
    default:
      return null;
  }

  return el(
    'li',
    { class: `timeline-item timeline-${item.kind}` },
    el('p', { class: 'timeline-head' }, el('span', { class: 'timeline-kind', text: kind }), el('time', { datetime: item.at, text: formatTime(item.at) })),
    el('p', { class: 'timeline-title', text: title }),
    lines.map((line) => el('p', { class: 'timeline-line', text: line })),
  );
}
