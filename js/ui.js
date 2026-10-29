// Utilidades de interfaz: creación de nodos, navegación, avisos y diálogos.

import { t } from './i18n.js';

/**
 * Crea un elemento DOM sin usar innerHTML (evita inyectar HTML).
 * props: class, text, on<Evento>, dataset, value, booleanos y atributos.
 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'value') node.value = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) {
      node.setAttribute(key, '');
      if (key in node) node[key] = true;
    } else node.setAttribute(key, value);
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** Icono SVG decorativo a partir de un path. */
export function icon(pathData) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'icon');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', pathData);
  svg.append(path);
  return svg;
}

let idCounter = 0;
export function uniqueId(prefix = 'f') {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/** Navega a una ruta (#/ruta). Si ya estamos en ella, vuelve a pintarla. */
export function navigate(path) {
  const target = `#/${path}`;
  if (location.hash === target) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = target;
}

let toastTimer = null;
export function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 3200);
}

/** Muestra el error de dominio traducido o uno genérico. */
export function showError(error) {
  console.error(error);
  const code = error && error.code ? `errors.${error.code}` : 'errors.generic';
  showToast(t(code));
}

/** Diálogo de confirmación accesible. Resuelve true/false. */
export function confirmDialog({ title, message = '', confirmLabel, cancelLabel = t('common.cancel'), danger = false }) {
  if (typeof HTMLDialogElement !== 'function') {
    return Promise.resolve(window.confirm(message ? `${title}\n\n${message}` : title));
  }
  return new Promise((resolve) => {
    const titleId = uniqueId('dialog-title');
    const dialog = el(
      'dialog',
      { class: 'dialog', 'aria-labelledby': titleId },
      el(
        'form',
        { method: 'dialog' },
        el('h2', { id: titleId, class: 'dialog-title', text: title }),
        message && el('p', { class: 'dialog-message', text: message }),
        el(
          'div',
          { class: 'dialog-actions' },
          el('button', { type: 'submit', value: 'confirm', class: danger ? 'btn btn-danger' : 'btn btn-primary', text: confirmLabel }),
          el('button', { type: 'submit', value: 'cancel', class: 'btn btn-secondary', text: cancelLabel }),
        ),
      ),
    );
    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue === 'confirm');
      dialog.remove();
    });
    document.body.append(dialog);
    dialog.showModal();
  });
}

/**
 * Diálogo con un área de texto. Resuelve el texto o null si se cancela.
 */
export function textDialog({ title, label, hint = '', confirmLabel, initial = '', maxLength = 2000 }) {
  if (typeof HTMLDialogElement !== 'function') {
    const value = window.prompt(title, initial);
    return Promise.resolve(value && value.trim() ? value : null);
  }
  return new Promise((resolve) => {
    const titleId = uniqueId('dialog-title');
    const fieldId = uniqueId('dialog-field');
    const hintId = uniqueId('dialog-hint');
    const textarea = el('textarea', { id: fieldId, rows: '5', maxlength: String(maxLength), required: true, 'aria-describedby': hint ? hintId : null, value: initial });
    const dialog = el(
      'dialog',
      { class: 'dialog', 'aria-labelledby': titleId },
      el(
        'form',
        { method: 'dialog' },
        el('h2', { id: titleId, class: 'dialog-title', text: title }),
        el('label', { for: fieldId, class: 'label', text: label }),
        hint && el('p', { id: hintId, class: 'hint', text: hint }),
        textarea,
        el(
          'div',
          { class: 'dialog-actions' },
          el('button', { type: 'submit', value: 'confirm', class: 'btn btn-primary', text: confirmLabel }),
          el('button', { type: 'submit', value: 'cancel', class: 'btn btn-secondary', formnovalidate: true, text: t('common.cancel') }),
        ),
      ),
    );
    dialog.addEventListener('close', () => {
      const value = textarea.value.trim();
      resolve(dialog.returnValue === 'confirm' && value ? value : null);
      dialog.remove();
    });
    document.body.append(dialog);
    dialog.showModal();
    textarea.focus();
  });
}

/** Campo de formulario con etiqueta, ayuda opcional y control. */
export function field({ label, control, hint = '', optional = false }) {
  const id = control.id || uniqueId('field');
  control.id = id;
  const hintId = hint ? `${id}-hint` : null;
  if (hintId) control.setAttribute('aria-describedby', hintId);
  return el(
    'div',
    { class: 'field' },
    el('label', { for: id, class: 'label' }, label, optional && el('span', { class: 'optional', text: ` ${t('common.optional')}` })),
    hint && el('p', { id: hintId, class: 'hint', text: hint }),
    control,
  );
}

/** Zona de mensajes de error de formulario, anunciada por lectores de pantalla. */
export function formError() {
  return el('p', { class: 'form-error', role: 'alert', hidden: true });
}

export function setFormError(node, message) {
  node.textContent = message || '';
  node.hidden = !message;
}

/** Cabecera de pantalla con enlace de vuelta opcional. */
export function screenHeader(title, { backHref = null, backLabel = null } = {}) {
  return el(
    'header',
    { class: 'screen-header' },
    backHref && el('a', { class: 'back-link', href: backHref }, icon(ICONS.back), el('span', { text: backLabel || t('common.back') })),
    el('h1', { class: 'screen-title', text: title }),
  );
}

export const ICONS = {
  back: 'M15 18l-6-6 6-6',
  plus: 'M12 5v14M5 12h14',
  chevron: 'M9 6l6 6-6 6',
};
