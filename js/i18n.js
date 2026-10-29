// Internacionalización: carga los textos de /locales/<idioma>.json
// y ofrece t(clave, parámetros) y utilidades de formato de fechas.

import { CONFIG } from './config.js';

let locale = CONFIG.defaultLocale;
let messages = {};
let fallbackMessages = {};

function pickLocale() {
  let saved = null;
  try {
    saved = localStorage.getItem(CONFIG.localeStorageKey);
  } catch {
    // localStorage puede no estar disponible; se ignora.
  }
  if (saved && CONFIG.supportedLocales.includes(saved)) return saved;

  const preferred = navigator.languages || [navigator.language || ''];
  for (const lang of preferred) {
    const base = String(lang).toLowerCase().split('-')[0];
    if (CONFIG.supportedLocales.includes(base)) return base;
  }
  return CONFIG.defaultLocale;
}

async function loadMessages(code) {
  const response = await fetch(`./locales/${code}.json`);
  if (!response.ok) throw new Error(`Locale ${code} could not be loaded (${response.status})`);
  return response.json();
}

export async function initI18n() {
  locale = pickLocale();
  fallbackMessages = await loadMessages(CONFIG.defaultLocale);
  if (locale === CONFIG.defaultLocale) {
    messages = fallbackMessages;
  } else {
    try {
      messages = await loadMessages(locale);
    } catch {
      locale = CONFIG.defaultLocale;
      messages = fallbackMessages;
    }
  }
  document.documentElement.lang = locale;
}

export function getLocale() {
  return locale;
}

function lookup(source, key) {
  return key.split('.').reduce(
    (node, part) => (node && typeof node === 'object' && part in node ? node[part] : undefined),
    source,
  );
}

/**
 * Devuelve el texto traducido.
 * - Los parámetros se insertan con {nombre}.
 * - Si el valor es un objeto con formas de plural (one / other...),
 *   se elige según params.count.
 */
export function t(key, params = {}) {
  let value = lookup(messages, key);
  if (value === undefined) value = lookup(fallbackMessages, key);

  if (value && typeof value === 'object' && params.count !== undefined) {
    const category = new Intl.PluralRules(locale).select(params.count);
    value = value[category] ?? value.other;
  }

  if (typeof value !== 'string') {
    console.warn(`[i18n] Missing key: ${key}`);
    return key;
  }

  return value.replace(/\{(\w+)\}/g, (match, name) =>
    params[name] !== undefined && params[name] !== null ? String(params[name]) : match,
  );
}

/** Traduce los elementos estáticos del HTML marcados con data-i18n*. */
export function applyStaticTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-aria-label]').forEach((node) => {
    node.setAttribute('aria-label', t(node.dataset.i18nAriaLabel));
  });
}

// ---------- Fechas ----------

const DAY_MS = 86400000;

/** Convierte 'YYYY-MM-DD' (fecha local) o una marca ISO en Date. */
export function parseDateValue(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(value);
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Días naturales desde hoy hasta la fecha (negativo si ya pasó). */
export function daysUntil(value) {
  return Math.round((startOfDay(parseDateValue(value)) - startOfDay(new Date())) / DAY_MS);
}

/** «hoy», «mañana», «dentro de 3 días», «hace 2 días»… según el idioma. */
export function relativeDays(days) {
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(days, 'day');
}

export function capitalizeFirst(text) {
  return text ? text.charAt(0).toLocaleUpperCase(locale) + text.slice(1) : text;
}

export function formatLongDate(value = new Date()) {
  return new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(
    parseDateValue(value),
  );
}

export function formatDate(value) {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(
    parseDateValue(value),
  );
}

export function formatTime(value) {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(
    parseDateValue(value),
  );
}

export function formatDateTime(value) {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parseDateValue(value));
}

/** Clave de día local 'YYYY-MM-DD' para agrupar. */
export function dayKey(value) {
  const d = parseDateValue(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
