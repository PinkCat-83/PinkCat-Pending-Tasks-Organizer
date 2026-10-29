// Arranque de la aplicación y enrutado por hash (compatible con GitHub Pages).

import { initI18n, t, applyStaticTranslations } from './i18n.js';
import { openDB } from './db.js';
import { el } from './ui.js';
import { registerServiceWorker } from './sw-status.js';
import { todayView } from './views/today.js';
import { chooseView } from './views/choose.js';
import { sessionView } from './views/session.js';
import { projectsView, projectDetailView } from './views/projects.js';
import { projectFormView } from './views/project-form.js';
import { priorityView } from './views/priority.js';
import { ideasView } from './views/ideas.js';
import { historyView } from './views/history.js';
import { dataView } from './views/data.js';

const ID = '([\\w-]+)';
const routes = [
  { pattern: /^today$/, view: todayView, nav: 'today' },
  { pattern: /^choose$/, view: chooseView, nav: 'today' },
  { pattern: /^session$/, view: sessionView, nav: 'today' },
  { pattern: /^projects$/, view: projectsView, nav: 'projects' },
  { pattern: /^projects\/new$/, view: projectFormView, nav: 'projects' },
  { pattern: new RegExp(`^projects/${ID}/edit$`), view: projectFormView, nav: 'projects' },
  { pattern: new RegExp(`^projects/${ID}/priority$`), view: priorityView, nav: 'projects' },
  { pattern: new RegExp(`^projects/${ID}$`), view: projectDetailView, nav: 'projects' },
  { pattern: /^ideas$/, view: ideasView, nav: 'ideas' },
  { pattern: /^history$/, view: historyView, nav: 'history' },
  { pattern: /^data$/, view: dataView, nav: 'data' },
];

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, queryString = ''] = raw.split('?');
  return { path: path || 'today', query: new URLSearchParams(queryString) };
}

function updateNav(active) {
  document.querySelectorAll('[data-nav]').forEach((link) => {
    if (link.dataset.nav === active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function errorView() {
  return el(
    'div',
    { class: 'view' },
    el('h1', { class: 'screen-title', text: t('errors.screenTitle') }),
    el('p', { class: 'lead', text: t('errors.generic') }),
    el('a', { class: 'btn btn-primary btn-block', href: '#/today', text: t('nav.today') }),
  );
}

let renderToken = 0;
let firstRender = true;

async function render() {
  const token = ++renderToken;
  const { path, query } = parseHash();
  let route = null;
  let match = null;
  for (const candidate of routes) {
    match = path.match(candidate.pattern);
    if (match) {
      route = candidate;
      break;
    }
  }
  if (!route) {
    location.replace('#/today');
    return;
  }

  const main = document.getElementById('main');
  let node;
  try {
    node = await route.view({ params: match.slice(1), query });
  } catch (error) {
    console.error(error);
    node = errorView();
  }
  if (token !== renderToken) return;

  main.replaceChildren(node);
  updateNav(route.nav);

  const heading = main.querySelector('h1');
  document.title = heading
    ? t('app.titlePattern', { page: heading.textContent, app: t('app.shortName') })
    : t('app.name');
  window.scrollTo(0, 0);
  if (!firstRender && heading) {
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }
  firstRender = false;
}

function setupSkipLink() {
  const link = document.querySelector('.skip-link');
  link?.addEventListener('click', (event) => {
    event.preventDefault();
    document.getElementById('main').focus();
  });
}

function setupOfflineBanner() {
  const banners = document.getElementById('banners');
  const banner = el('div', { class: 'banner banner-offline', hidden: true }, el('span', { text: t('app.offline') }));
  banners.append(banner);
  const update = () => {
    banner.hidden = navigator.onLine;
  };
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

function showFatal(messageKey) {
  document.getElementById('main').replaceChildren(
    el(
      'div',
      { class: 'view' },
      el('h1', { class: 'screen-title', text: t('errors.screenTitle') }),
      el('p', { class: 'lead', text: t(messageKey) }),
    ),
  );
}

async function boot() {
  try {
    await initI18n();
  } catch (error) {
    // Sin textos no se puede mostrar nada útil; se deja constancia en consola.
    console.error(error);
    return;
  }
  applyStaticTranslations();
  document.title = t('app.name');
  setupSkipLink();
  setupOfflineBanner();

  try {
    await openDB();
  } catch (error) {
    console.error(error);
    showFatal('errors.storageUnavailable');
    return;
  }

  window.addEventListener('hashchange', render);
  if (!location.hash) history.replaceState(null, '', '#/today');
  await render();
  registerServiceWorker();
}

boot();
