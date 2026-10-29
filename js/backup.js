// Copias de seguridad: exportar, compartir, descargar, validar e importar.

import * as db from './db.js';
import { STORES } from './db.js';
import { CONFIG } from './config.js';
import { t, dayKey } from './i18n.js';
import {
  STATUS,
  STATUSES,
  IMPORTANCE,
  SESSION_RESULTS,
  PRIORITY_REASONS,
  HISTORY_TYPES,
} from './store.js';

const DATA_STORES = [STORES.projects, STORES.sessions, STORES.history, STORES.ideas];

export async function buildExport() {
  const [projects, sessions, history, ideas] = await Promise.all(DATA_STORES.map((s) => db.getAll(s)));
  return {
    format: CONFIG.exportFormat,
    schemaVersion: CONFIG.exportSchemaVersion,
    appVersion: CONFIG.appVersion,
    exportedAt: new Date().toISOString(),
    data: { projects, sessions, history, ideas },
  };
}

export function backupFileName() {
  return t('backup.fileName', { date: dayKey(new Date()) });
}

function toFile(payload) {
  return new File([JSON.stringify(payload, null, 2)], backupFileName(), { type: 'application/json' });
}

export function canShareFiles() {
  try {
    const probe = new File(['{}'], 'probe.json', { type: 'application/json' });
    return Boolean(navigator.canShare && navigator.share && navigator.canShare({ files: [probe] }));
  } catch {
    return false;
  }
}

/**
 * Abre la hoja de compartir del sistema (Mail, Archivos…).
 * Debe llamarse directamente desde el gesto del usuario, por eso recibe
 * los datos ya preparados. Devuelve false si el usuario cancela.
 */
export async function shareBackup(payload) {
  try {
    await navigator.share({ files: [toFile(payload)], title: t('backup.shareTitle') });
    return true;
  } catch (error) {
    if (error && error.name === 'AbortError') return false;
    throw error;
  }
}

export function downloadBackup(payload) {
  const file = toFile(payload);
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// ---------- Validación ----------

const isString = (v) => typeof v === 'string';
const isNonEmpty = (v) => isString(v) && v.trim().length > 0;
const isIso = (v) => isString(v) && !Number.isNaN(Date.parse(v));
const isOptIso = (v) => v === null || v === undefined || isIso(v);
const isOptString = (v) => v === null || v === undefined || isString(v);
const isDay = (v) => isString(v) && /^\d{4}-\d{2}-\d{2}$/.test(v);
const str = (v) => (isString(v) ? v : '');
const optStr = (v) => (isString(v) ? v : null);

function normalizeProject(p) {
  const ok =
    p &&
    isNonEmpty(p.id) &&
    isNonEmpty(p.name) &&
    STATUSES.includes(p.status) &&
    IMPORTANCE.includes(p.importance) &&
    (p.deadline === null || p.deadline === undefined || isDay(p.deadline)) &&
    isIso(p.createdAt) &&
    isIso(p.updatedAt) &&
    isOptIso(p.lastWorkedAt) &&
    isOptString(p.description) &&
    isOptString(p.desiredOutcome);
  if (!ok) return null;
  return {
    id: p.id,
    name: p.name,
    description: str(p.description),
    desiredOutcome: str(p.desiredOutcome),
    importance: p.importance,
    status: p.status,
    deadline: p.deadline || null,
    lastWorkedAt: p.lastWorkedAt || null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function normalizeSession(s) {
  const ok =
    s &&
    isNonEmpty(s.id) &&
    SESSION_RESULTS.includes(s.result) &&
    isIso(s.startedAt) &&
    isOptIso(s.endedAt) &&
    isOptString(s.projectId) &&
    isOptString(s.projectName) &&
    isOptString(s.customTask) &&
    isOptString(s.note) &&
    isOptString(s.intention) &&
    (s.projectId || s.customTask);
  if (!ok) return null;
  return {
    id: s.id,
    projectId: optStr(s.projectId),
    projectName: optStr(s.projectName),
    customTask: optStr(s.customTask),
    recommended: Boolean(s.recommended),
    intention: str(s.intention),
    result: s.result,
    note: str(s.note),
    startedAt: s.startedAt,
    endedAt: s.endedAt || null,
  };
}

function normalizeHistory(h) {
  if (!h || !isNonEmpty(h.id) || !isIso(h.at)) return null;
  const base = { id: h.id, type: h.type, at: h.at };
  switch (h.type) {
    case HISTORY_TYPES.PRIORITY:
      if (!isNonEmpty(h.toProjectId)) return null;
      if (h.reason !== null && h.reason !== undefined && !PRIORITY_REASONS.includes(h.reason)) return null;
      return {
        ...base,
        fromProjectId: optStr(h.fromProjectId),
        fromProjectName: optStr(h.fromProjectName),
        toProjectId: h.toProjectId,
        toProjectName: optStr(h.toProjectName),
        reason: h.reason || null,
        note: str(h.note),
      };
    case HISTORY_TYPES.TASK:
      if (!h.chosenProjectId && !isNonEmpty(h.customTask)) return null;
      return {
        ...base,
        recommendedProjectId: optStr(h.recommendedProjectId),
        recommendedProjectName: optStr(h.recommendedProjectName),
        chosenProjectId: optStr(h.chosenProjectId),
        chosenProjectName: optStr(h.chosenProjectName),
        customTask: optStr(h.customTask),
      };
    case HISTORY_TYPES.STATUS:
      if (!isNonEmpty(h.projectId) || !STATUSES.includes(h.fromStatus) || !STATUSES.includes(h.toStatus)) {
        return null;
      }
      return {
        ...base,
        projectId: h.projectId,
        projectName: optStr(h.projectName),
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
      };
    default:
      return null;
  }
}

function normalizeIdea(i) {
  if (!i || !isNonEmpty(i.id) || !isNonEmpty(i.text) || !isIso(i.createdAt) || !isOptIso(i.updatedAt)) {
    return null;
  }
  return { id: i.id, text: i.text, createdAt: i.createdAt, updatedAt: i.updatedAt || i.createdAt };
}

const NORMALIZERS = {
  projects: normalizeProject,
  sessions: normalizeSession,
  history: normalizeHistory,
  ideas: normalizeIdea,
};

/**
 * Valida el texto de un archivo de copia.
 * Devuelve { ok: true, data, counts } o { ok: false, errors: [{ key, params }] }.
 */
export function validateBackup(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, errors: [{ key: 'backup.errors.notJson' }] };
  }
  if (!parsed || typeof parsed !== 'object' || parsed.format !== CONFIG.exportFormat || !parsed.data) {
    return { ok: false, errors: [{ key: 'backup.errors.notBackup' }] };
  }
  if (typeof parsed.schemaVersion !== 'number' || parsed.schemaVersion > CONFIG.exportSchemaVersion) {
    return { ok: false, errors: [{ key: 'backup.errors.newerVersion' }] };
  }

  const errors = [];
  const data = {};
  for (const [section, normalize] of Object.entries(NORMALIZERS)) {
    const list = parsed.data[section];
    const label = t(`backup.sections.${section}`);
    if (!Array.isArray(list)) {
      errors.push({ key: 'backup.errors.invalidSection', params: { section: label } });
      continue;
    }
    const ids = new Set();
    data[section] = [];
    list.forEach((item, index) => {
      const normalized = normalize(item);
      if (!normalized) {
        errors.push({ key: 'backup.errors.invalidItem', params: { section: label, position: index + 1 } });
        return;
      }
      if (ids.has(normalized.id)) {
        errors.push({ key: 'backup.errors.duplicateId', params: { section: label } });
        return;
      }
      ids.add(normalized.id);
      data[section].push(normalized);
    });
  }

  if (data.projects && data.projects.filter((p) => p.status === STATUS.ACTIVE).length > 1) {
    errors.push({ key: 'backup.errors.multipleActive' });
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    data,
    exportedAt: isIso(parsed.exportedAt) ? parsed.exportedAt : null,
    counts: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])),
  };
}

/** Sustituye todos los datos locales por los de la copia (operación atómica). */
export async function replaceAllData(data) {
  await db.transaction([...DATA_STORES, STORES.meta], (tx) => {
    for (const store of [...DATA_STORES, STORES.meta]) tx.objectStore(store).clear();
    for (const store of DATA_STORES) {
      for (const item of data[store]) tx.objectStore(store).put(item);
    }
  });
}
