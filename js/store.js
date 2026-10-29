// Reglas de negocio: proyectos, prioridad, sesiones, ideas e historial.

import * as db from './db.js';
import { STORES } from './db.js';
import { CONFIG } from './config.js';

export const STATUS = Object.freeze({
  ACTIVE: 'active',
  PARKED: 'parked',
  COMPLETED: 'completed',
  DISCARDED: 'discarded',
});
export const STATUSES = Object.values(STATUS);
export const IMPORTANCE = Object.freeze(['low', 'medium', 'high']);
export const SESSION_RESULTS = Object.freeze(['progressed', 'partial', 'none', 'obsolete']);
export const PROGRESS_RESULTS = Object.freeze(['progressed', 'partial']);
export const PRIORITY_REASONS = Object.freeze([
  'urgent',
  'moreImportant',
  'lostInterest',
  'blocked',
  'opportunity',
  'other',
]);
export const HISTORY_TYPES = Object.freeze({
  PRIORITY: 'priorityChange',
  TASK: 'taskChange',
  STATUS: 'statusChange',
});

const CURRENT_SESSION_KEY = 'currentSession';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Error de dominio con un código traducible (errors.<code>). */
export class DomainError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

export function uid() {
  if (globalThis.crypto?.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch {
      // randomUUID solo existe en contextos seguros; se usa la alternativa.
    }
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const nowIso = () => new Date().toISOString();
const clean = (value, max = CONFIG.maxLength.longText) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

const importanceRank = { high: 0, medium: 1, low: 2 };

/** Orden estable: importancia, fecha límite más cercana, nombre. */
export function sortProjects(list) {
  return [...list].sort((a, b) => {
    const byImportance = importanceRank[a.importance] - importanceRank[b.importance];
    if (byImportance) return byImportance;
    if (a.deadline && b.deadline && a.deadline !== b.deadline) return a.deadline < b.deadline ? -1 : 1;
    if (a.deadline && !b.deadline) return -1;
    if (!a.deadline && b.deadline) return 1;
    return a.name.localeCompare(b.name);
  });
}

// ---------- Proyectos ----------

function sanitizeProjectFields(input) {
  return {
    name: clean(input.name, CONFIG.maxLength.name),
    description: clean(input.description),
    desiredOutcome: clean(input.desiredOutcome),
    importance: IMPORTANCE.includes(input.importance) ? input.importance : 'medium',
    deadline: DATE_RE.test(input.deadline || '') ? input.deadline : null,
  };
}

export async function listProjects() {
  return db.getAll(STORES.projects);
}

export async function getProject(id) {
  return (await db.get(STORES.projects, id)) || null;
}

export async function getActiveProject() {
  return (await listProjects()).find((p) => p.status === STATUS.ACTIVE) || null;
}

export async function createProject(input, { makeActive = false } = {}) {
  const fields = sanitizeProjectFields(input);
  if (!fields.name) throw new DomainError('nameRequired');

  const ts = nowIso();
  const project = {
    id: uid(),
    ...fields,
    status: STATUS.PARKED,
    lastWorkedAt: null,
    createdAt: ts,
    updatedAt: ts,
  };

  let entry = null;
  if (makeActive) {
    if (await getActiveProject()) throw new DomainError('activeExists');
    project.status = STATUS.ACTIVE;
    entry = {
      id: uid(),
      type: HISTORY_TYPES.PRIORITY,
      at: ts,
      fromProjectId: null,
      fromProjectName: null,
      toProjectId: project.id,
      toProjectName: project.name,
      reason: null,
      note: '',
    };
  }

  await db.transaction([STORES.projects, STORES.history], (tx) => {
    tx.objectStore(STORES.projects).put(project);
    if (entry) tx.objectStore(STORES.history).put(entry);
  });
  return project;
}

export async function updateProject(id, input) {
  const project = await getProject(id);
  if (!project) throw new DomainError('projectNotFound');
  const fields = sanitizeProjectFields(input);
  if (!fields.name) throw new DomainError('nameRequired');
  const updated = { ...project, ...fields, updatedAt: nowIso() };
  await db.put(STORES.projects, updated);
  return updated;
}

/**
 * Cambio consciente de prioridad.
 * Si ya hay un proyecto prioritario, el motivo es obligatorio.
 * Ambos proyectos conservan intactos sus datos; solo cambia el estado.
 */
export async function changePriority(targetId, { reason = null, note = '' } = {}) {
  const projects = await listProjects();
  const target = projects.find((p) => p.id === targetId);
  if (!target) throw new DomainError('projectNotFound');
  if (target.status === STATUS.ACTIVE) return target;
  if (target.status !== STATUS.PARKED) throw new DomainError('notParked');

  const current = projects.find((p) => p.status === STATUS.ACTIVE) || null;
  if (current && !PRIORITY_REASONS.includes(reason)) throw new DomainError('reasonRequired');

  const ts = nowIso();
  const entry = {
    id: uid(),
    type: HISTORY_TYPES.PRIORITY,
    at: ts,
    fromProjectId: current ? current.id : null,
    fromProjectName: current ? current.name : null,
    toProjectId: target.id,
    toProjectName: target.name,
    reason: current ? reason : null,
    note: clean(note),
  };

  await db.transaction([STORES.projects, STORES.history], (tx) => {
    const projectsStore = tx.objectStore(STORES.projects);
    if (current) projectsStore.put({ ...current, status: STATUS.PARKED, updatedAt: ts });
    projectsStore.put({ ...target, status: STATUS.ACTIVE, updatedAt: ts });
    tx.objectStore(STORES.history).put(entry);
  });
  return { ...target, status: STATUS.ACTIVE };
}

const ALLOWED_STATUS_CHANGES = {
  [STATUS.ACTIVE]: [STATUS.COMPLETED, STATUS.DISCARDED],
  [STATUS.PARKED]: [STATUS.COMPLETED, STATUS.DISCARDED],
  [STATUS.COMPLETED]: [STATUS.PARKED],
  [STATUS.DISCARDED]: [STATUS.PARKED],
};

function statusEntry(project, toStatus, ts) {
  return {
    id: uid(),
    type: HISTORY_TYPES.STATUS,
    at: ts,
    projectId: project.id,
    projectName: project.name,
    fromStatus: project.status,
    toStatus,
  };
}

/** Completar, descartar o recuperar (vuelve como aparcado). */
export async function setProjectStatus(id, toStatus) {
  const project = await getProject(id);
  if (!project) throw new DomainError('projectNotFound');
  if (!ALLOWED_STATUS_CHANGES[project.status]?.includes(toStatus)) {
    throw new DomainError('invalidStatusChange');
  }
  const ts = nowIso();
  const updated = { ...project, status: toStatus, updatedAt: ts };
  await db.transaction([STORES.projects, STORES.history], (tx) => {
    tx.objectStore(STORES.projects).put(updated);
    tx.objectStore(STORES.history).put(statusEntry(project, toStatus, ts));
  });
  return updated;
}

// ---------- Sesiones ----------

export async function getCurrentSession() {
  const record = await db.get(STORES.meta, CURRENT_SESSION_KEY);
  return record ? record.value : null;
}

/**
 * Empieza una sesión con un proyecto o con una tarea puntual.
 * Si no es la recomendación del día, se registra el cambio de tarea.
 */
export async function startSession({ projectId = null, customTask = '' } = {}) {
  if (await getCurrentSession()) throw new DomainError('sessionInProgress');

  const active = await getActiveProject();
  let project = null;
  if (projectId) {
    project = await getProject(projectId);
    if (!project || ![STATUS.ACTIVE, STATUS.PARKED].includes(project.status)) {
      throw new DomainError('projectNotFound');
    }
  }
  const task = project ? null : clean(customTask, CONFIG.maxLength.shortText);
  if (!project && !task) throw new DomainError('taskRequired');

  const recommended = Boolean(project && project.status === STATUS.ACTIVE);
  const ts = nowIso();
  const session = {
    id: uid(),
    projectId: project ? project.id : null,
    projectName: project ? project.name : null,
    customTask: task,
    recommended,
    intention: '',
    startedAt: ts,
  };

  await db.transaction([STORES.meta, STORES.history], (tx) => {
    tx.objectStore(STORES.meta).put({ key: CURRENT_SESSION_KEY, value: session });
    if (!recommended) {
      tx.objectStore(STORES.history).put({
        id: uid(),
        type: HISTORY_TYPES.TASK,
        at: ts,
        recommendedProjectId: active ? active.id : null,
        recommendedProjectName: active ? active.name : null,
        chosenProjectId: project ? project.id : null,
        chosenProjectName: project ? project.name : null,
        customTask: task,
      });
    }
  });
  return session;
}

export async function updateSessionIntention(text) {
  const session = await getCurrentSession();
  if (!session) return;
  session.intention = typeof text === 'string' ? text.slice(0, CONFIG.maxLength.shortText) : '';
  await db.put(STORES.meta, { key: CURRENT_SESSION_KEY, value: session });
}

/**
 * Guarda el resultado de la sesión en curso.
 * projectAction: null | 'complete' | 'discard'
 */
export async function finishSession({ result, note = '', projectAction = null }) {
  if (!SESSION_RESULTS.includes(result)) throw new DomainError('resultRequired');
  const session = await getCurrentSession();
  if (!session) throw new DomainError('noSession');

  const ts = nowIso();
  const record = {
    ...session,
    intention: clean(session.intention, CONFIG.maxLength.shortText),
    result,
    note: clean(note),
    endedAt: ts,
  };

  const project = session.projectId ? await getProject(session.projectId) : null;
  let updatedProject = null;
  let entry = null;
  if (project) {
    updatedProject = { ...project, updatedAt: ts };
    if (PROGRESS_RESULTS.includes(result)) updatedProject.lastWorkedAt = ts;
    const toStatus =
      projectAction === 'complete'
        ? STATUS.COMPLETED
        : projectAction === 'discard'
          ? STATUS.DISCARDED
          : null;
    if (toStatus && [STATUS.ACTIVE, STATUS.PARKED].includes(project.status)) {
      entry = statusEntry(project, toStatus, ts);
      updatedProject.status = toStatus;
    }
  }

  await db.transaction([STORES.meta, STORES.sessions, STORES.projects, STORES.history], (tx) => {
    tx.objectStore(STORES.sessions).put(record);
    tx.objectStore(STORES.meta).delete(CURRENT_SESSION_KEY);
    if (updatedProject) tx.objectStore(STORES.projects).put(updatedProject);
    if (entry) tx.objectStore(STORES.history).put(entry);
  });
  return record;
}

export async function cancelSession() {
  await db.remove(STORES.meta, CURRENT_SESSION_KEY);
}

export async function getProjectSessions(projectId, limit = 5) {
  const sessions = await db.getAll(STORES.sessions);
  return sessions
    .filter((s) => s.projectId === projectId)
    .sort((a, b) => (b.endedAt || b.startedAt).localeCompare(a.endedAt || a.startedAt))
    .slice(0, limit);
}

// ---------- Ideas (bloc de notas) ----------

export async function listIdeas() {
  const ideas = await db.getAll(STORES.ideas);
  return ideas.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addIdea(text) {
  const value = clean(text);
  if (!value) throw new DomainError('ideaRequired');
  const ts = nowIso();
  const idea = { id: uid(), text: value, createdAt: ts, updatedAt: ts };
  await db.put(STORES.ideas, idea);
  return idea;
}

export async function updateIdea(id, text) {
  const idea = await db.get(STORES.ideas, id);
  if (!idea) throw new DomainError('ideaNotFound');
  const value = clean(text);
  if (!value) throw new DomainError('ideaRequired');
  const updated = { ...idea, text: value, updatedAt: nowIso() };
  await db.put(STORES.ideas, updated);
  return updated;
}

export async function getIdea(id) {
  return (await db.get(STORES.ideas, id)) || null;
}

export async function deleteIdea(id) {
  await db.remove(STORES.ideas, id);
}

// ---------- Historial ----------

export async function getHistoryFeed(limit = CONFIG.historyLimit) {
  const [sessions, history] = await Promise.all([
    db.getAll(STORES.sessions),
    db.getAll(STORES.history),
  ]);
  const items = [
    ...sessions.map((s) => ({ kind: 'session', at: s.endedAt || s.startedAt, data: s })),
    ...history.map((h) => ({ kind: h.type, at: h.at, data: h })),
  ];
  items.sort((a, b) => b.at.localeCompare(a.at));
  return items.slice(0, limit);
}

// ---------- Recuento ----------

export async function countAll() {
  const [projects, sessions, history, ideas] = await Promise.all([
    db.getAll(STORES.projects),
    db.getAll(STORES.sessions),
    db.getAll(STORES.history),
    db.getAll(STORES.ideas),
  ]);
  return {
    projects: projects.length,
    sessions: sessions.length,
    history: history.length,
    ideas: ideas.length,
  };
}
