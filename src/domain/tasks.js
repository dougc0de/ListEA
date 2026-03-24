export const TASK_STATUS = Object.freeze({
  ACTIVE: 'active',
  BLOCKED: 'blocked',
  WAITING: 'waiting',
  COMPLETED: 'completed',
});

export const TASK_PRIORITY = Object.freeze({
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
});

export const TASK_ENERGY = Object.freeze({
  DEEP: 'deep',
  MEDIUM: 'medium',
  LIGHT: 'light',
});

export const TASK_IMPACT = Object.freeze({
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
});

const RECURRENCE_PRESETS = new Set([
  'none',
  'daily',
  'weekly',
  'monthly',
  'yearly',
  'weekdays',
  'weekends',
  'every-x-days',
]);

const RECURRENCE_MODES = new Set(['fixed', 'after-completion']);

function createId(prefix = 'task') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeDateTime(value) {
  if (!value) return '';
  const nextDate = value instanceof Date ? value : new Date(value);
  return Number.isNaN(nextDate.getTime()) ? '' : nextDate.toISOString();
}

export function toDateTimeInputValue(value) {
  if (!value) return '';

  const nextDate = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(nextDate.getTime())) return '';

  const localDate = new Date(nextDate.getTime() - nextDate.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function normalizePriority(priority) {
  return Object.values(TASK_PRIORITY).includes(priority) ? priority : TASK_PRIORITY.MEDIUM;
}

function normalizeStatus(status, done) {
  if (done) return TASK_STATUS.COMPLETED;
  return Object.values(TASK_STATUS).includes(status) ? status : TASK_STATUS.ACTIVE;
}

function normalizeEnergy(energy) {
  return Object.values(TASK_ENERGY).includes(energy) ? energy : TASK_ENERGY.MEDIUM;
}

function normalizeImpact(impact) {
  return Object.values(TASK_IMPACT).includes(impact) ? impact : TASK_IMPACT.MEDIUM;
}

function normalizeEffort(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 20;
  }

  return Math.min(480, Math.round(numeric));
}

function titleize(value) {
  return `${value ?? ''}`.trim();
}

export class RecurrenceRule {
  constructor({
    preset = 'none',
    interval = 1,
    mode = 'fixed',
    resetNotes = true,
    seriesId = '',
    anchorAt = undefined,
  } = {}) {
    this.preset = RECURRENCE_PRESETS.has(preset) ? preset : 'none';
    this.interval = Number.isFinite(Number(interval)) && Number(interval) > 0 ? Number(interval) : 1;
    this.mode = RECURRENCE_MODES.has(mode) ? mode : 'fixed';
    this.resetNotes = Boolean(resetNotes);
    this.seriesId = seriesId || (this.preset === 'none' ? '' : createId('series'));
    this.anchorAt = this.preset === 'none'
      ? ''
      : (anchorAt === undefined ? '' : normalizeDateTime(anchorAt));
  }

  isEnabled() {
    return this.preset !== 'none';
  }

  canScheduleNext() {
    if (!this.isEnabled()) {
      return false;
    }

    if (this.mode === 'fixed') {
      return Boolean(this.anchorAt);
    }

    return true;
  }

  toJSON() {
    return {
      preset: this.preset,
      interval: this.interval,
      mode: this.mode,
      resetNotes: this.resetNotes,
      seriesId: this.seriesId,
      anchorAt: this.anchorAt,
    };
  }
}

export class TaskSubtask {
  constructor({ id, title, done = false } = {}) {
    this.id = id || createId('subtask');
    this.title = titleize(title);
    this.done = Boolean(done);
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      done: this.done,
    };
  }
}

export class TaskEntity {
  constructor(task) {
    this.id = task.id;
    this.title = task.title;
    this.notes = task.notes;
    this.status = task.status;
    this.priority = task.priority;
    this.energy = task.energy;
    this.impact = task.impact;
    this.effortMinutes = task.effortMinutes;
    this.project = task.project;
    this.area = task.area;
    this.tags = task.tags;
    this.subtasks = task.subtasks;
    this.dueAt = task.dueAt;
    this.followUpAt = task.followUpAt;
    this.createdAt = task.createdAt;
    this.updatedAt = task.updatedAt;
    this.completedAt = task.completedAt;
    this.reminderSent = task.reminderSent;
    this.avatarSnippetShownAt = task.avatarSnippetShownAt;
    this.recurrence = task.recurrence;
  }

  isCompleted() {
    return this.status === TASK_STATUS.COMPLETED;
  }

  getRelevantDate() {
    return this.dueAt || this.followUpAt || '';
  }

  getPendingSubtasksCount() {
    return this.subtasks.filter(subtask => !subtask.done).length;
  }

  hasSubtasks() {
    return this.subtasks.length > 0;
  }

  complete(completedAt = new Date().toISOString()) {
    this.status = TASK_STATUS.COMPLETED;
    this.completedAt = normalizeDateTime(completedAt);
    this.updatedAt = this.completedAt;
    this.reminderSent = true;
  }

  reopen(updatedAt = new Date().toISOString()) {
    this.status = TASK_STATUS.ACTIVE;
    this.completedAt = '';
    this.updatedAt = normalizeDateTime(updatedAt);
    this.reminderSent = false;
    this.avatarSnippetShownAt = '';
  }

  applyPatch(patch = {}, timestamp = new Date().toISOString()) {
    if (typeof patch.title === 'string' && patch.title.trim()) {
      this.title = patch.title.trim();
    }

    if (typeof patch.notes === 'string') {
      this.notes = patch.notes.trim();
    }

    if (typeof patch.project === 'string') {
      this.project = patch.project.trim();
    }

    if (typeof patch.area === 'string') {
      this.area = patch.area.trim();
    }

    if (patch.priority !== undefined) {
      this.priority = normalizePriority(patch.priority);
    }

    if (patch.status !== undefined) {
      this.status = normalizeStatus(patch.status, false);
      if (this.status !== TASK_STATUS.COMPLETED) {
        this.completedAt = '';
      }
    }

    if (patch.energy !== undefined) {
      this.energy = normalizeEnergy(patch.energy);
    }

    if (patch.impact !== undefined) {
      this.impact = normalizeImpact(patch.impact);
    }

    if (patch.effortMinutes !== undefined) {
      this.effortMinutes = normalizeEffort(patch.effortMinutes);
    }

    if (patch.dueAt !== undefined) {
      this.dueAt = normalizeDateTime(patch.dueAt);
      this.reminderSent = false;
      this.avatarSnippetShownAt = '';
      if (this.recurrence.isEnabled() && this.recurrence.mode === 'fixed') {
        this.recurrence.anchorAt = this.dueAt;
      }
    }

    if (patch.followUpAt !== undefined) {
      this.followUpAt = normalizeDateTime(patch.followUpAt);
    }

    if (patch.tags !== undefined) {
      this.tags = TaskFactory.normalizeTags(patch.tags);
    }

    if (patch.subtasks !== undefined) {
      this.subtasks = TaskFactory.normalizeSubtasks(patch.subtasks);
    }

    if (patch.recurrence !== undefined) {
      this.recurrence = TaskFactory.normalizeRecurrence(patch.recurrence, {
        dueAt: patch.dueAt !== undefined ? patch.dueAt : this.dueAt,
      });
    }

    if (patch.reminderSent !== undefined) {
      this.reminderSent = Boolean(patch.reminderSent);
    }

    if (patch.avatarSnippetShownAt !== undefined) {
      this.avatarSnippetShownAt = normalizeDateTime(patch.avatarSnippetShownAt);
    }

    this.updatedAt = normalizeDateTime(timestamp);
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      notes: this.notes,
      status: this.status,
      priority: this.priority,
      energy: this.energy,
      impact: this.impact,
      effortMinutes: this.effortMinutes,
      project: this.project,
      area: this.area,
      tags: [...this.tags],
      subtasks: this.subtasks.map(subtask => subtask.toJSON()),
      dueAt: this.dueAt,
      followUpAt: this.followUpAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      completedAt: this.completedAt,
      reminderSent: this.reminderSent,
      avatarSnippetShownAt: this.avatarSnippetShownAt,
      recurrence: this.recurrence.toJSON(),
    };
  }
}

export class TaskFactory {
  constructor({ clock = () => new Date(), idProvider = createId } = {}) {
    this.clock = clock;
    this.idProvider = idProvider;
  }

  create(payload = {}) {
    const now = normalizeDateTime(this.clock());
    return new TaskEntity({
      id: payload.id || this.idProvider('task'),
      title: titleize(payload.title),
      notes: `${payload.notes ?? ''}`.trim(),
      status: normalizeStatus(payload.status, payload.done),
      priority: normalizePriority(payload.priority),
      energy: normalizeEnergy(payload.energy),
      impact: normalizeImpact(payload.impact),
      effortMinutes: normalizeEffort(payload.effortMinutes),
      project: titleize(payload.project),
      area: titleize(payload.area),
      tags: TaskFactory.normalizeTags(payload.tags),
      subtasks: TaskFactory.normalizeSubtasks(payload.subtasks),
      dueAt: normalizeDateTime(payload.dueAt),
      followUpAt: normalizeDateTime(payload.followUpAt),
      createdAt: normalizeDateTime(payload.createdAt) || now,
      updatedAt: normalizeDateTime(payload.updatedAt) || now,
      completedAt: normalizeDateTime(payload.completedAt),
      reminderSent: Boolean(payload.reminderSent),
      avatarSnippetShownAt: normalizeDateTime(payload.avatarSnippetShownAt),
      recurrence: TaskFactory.normalizeRecurrence(payload.recurrence, {
        dueAt: payload.dueAt,
      }),
    });
  }

  rehydrate(rawTask = {}, index = 0) {
    return this.create({
      ...rawTask,
      id: rawTask.id || this.idProvider(`task-${index}`),
    });
  }

  createDemoTasks(baseDate = this.clock()) {
    const now = baseDate instanceof Date ? new Date(baseDate) : new Date(baseDate);
    const dueSoon = new Date(now);
    dueSoon.setDate(dueSoon.getDate() + 1);
    dueSoon.setHours(10, 0, 0, 0);

    const followUp = new Date(now);
    followUp.setDate(followUp.getDate() + 2);
    followUp.setHours(9, 0, 0, 0);

    const recurringSeriesId = createId('series-demo');
    const recurringCompletedDue = new Date(now);
    recurringCompletedDue.setDate(recurringCompletedDue.getDate() - 7);
    recurringCompletedDue.setHours(18, 0, 0, 0);

    const recurringCompletedAt = new Date(now);
    recurringCompletedAt.setDate(recurringCompletedAt.getDate() - 1);
    recurringCompletedAt.setHours(18, 10, 0, 0);

    const recurringNextDue = new Date(now);
    recurringNextDue.setDate(recurringNextDue.getDate() + 1);
    recurringNextDue.setHours(18, 0, 0, 0);

    const recurringFailureDue = new Date(now);
    recurringFailureDue.setHours(20, 0, 0, 0);

    return [
      this.create({
        title: 'Preparar propuesta para Mario',
        notes: 'Ordena el alcance y deja claro el siguiente paso.',
        project: 'Clientes',
        area: 'Trabajo',
        priority: TASK_PRIORITY.HIGH,
        impact: TASK_IMPACT.HIGH,
        energy: TASK_ENERGY.DEEP,
        effortMinutes: 50,
        dueAt: dueSoon,
        tags: ['cliente', 'propuesta'],
        subtasks: ['Definir alcance', 'Confirmar costos'],
      }),
      this.create({
        title: 'Follow-up de feedback pendiente',
        project: 'Clientes',
        area: 'Trabajo',
        status: TASK_STATUS.WAITING,
        followUpAt: followUp,
        effortMinutes: 10,
        tags: ['follow-up'],
      }),
      this.create({
        title: 'Recurring Task',
        project: 'Hogar',
        area: 'Casa',
        priority: TASK_PRIORITY.MEDIUM,
        effortMinutes: 10,
        dueAt: recurringNextDue,
        tags: ['hogar', 'rutina'],
        subtasks: ['Revisar macetas grandes', 'Agregar agua a las suculentas'],
        recurrence: {
          preset: 'weekly',
          mode: 'fixed',
          resetNotes: true,
          seriesId: recurringSeriesId,
        },
      }),
      this.create({
        title: 'Cerrar caja semanal',
        notes: 'Esta serie necesita repararse antes de generar la siguiente ocurrencia.',
        project: 'Finanzas',
        area: 'Administracion',
        priority: TASK_PRIORITY.HIGH,
        effortMinutes: 20,
        dueAt: recurringFailureDue,
        tags: ['revision', 'semanal'],
        recurrence: {
          preset: 'weekly',
          mode: 'fixed',
          resetNotes: false,
          anchorAt: '',
        },
      }),
      this.create({
        title: 'Recurring Task done',
        project: 'Hogar',
        area: 'Casa',
        priority: TASK_PRIORITY.MEDIUM,
        status: TASK_STATUS.COMPLETED,
        effortMinutes: 10,
        dueAt: recurringCompletedDue,
        completedAt: recurringCompletedAt,
        tags: ['hogar', 'rutina'],
        subtasks: ['Revisar macetas grandes', 'Agregar agua a las suculentas'],
        recurrence: {
          preset: 'weekly',
          mode: 'fixed',
          resetNotes: true,
          seriesId: recurringSeriesId,
        },
      }),
      this.create({
        title: 'Revisar agenda sin fecha',
        area: 'Personal',
        priority: TASK_PRIORITY.MEDIUM,
        effortMinutes: 15,
      }),
    ];
  }

  static normalizeTags(tags = []) {
    if (typeof tags === 'string') {
      return tags
        .split(',')
        .map(tag => tag.trim().replace(/^#/, ''))
        .filter(Boolean);
    }

    return Array.isArray(tags)
      ? tags.map(tag => `${tag}`.trim().replace(/^#/, '')).filter(Boolean)
      : [];
  }

  static normalizeSubtasks(subtasks = []) {
    if (!Array.isArray(subtasks)) {
      return [];
    }

    return subtasks
      .map(subtask => {
        if (typeof subtask === 'string') {
          return new TaskSubtask({ title: subtask });
        }

        return new TaskSubtask(subtask);
      })
      .filter(subtask => subtask.title);
  }

  static normalizeRecurrence(recurrence = {}, { dueAt = '' } = {}) {
    if (recurrence instanceof RecurrenceRule) {
      return recurrence;
    }

    if (!recurrence || typeof recurrence !== 'object') {
      return new RecurrenceRule();
    }

    const normalizedDueAt = normalizeDateTime(dueAt);
    const hasExplicitAnchor = Object.prototype.hasOwnProperty.call(recurrence, 'anchorAt');

    return new RecurrenceRule({
      ...recurrence,
      anchorAt: hasExplicitAnchor ? recurrence.anchorAt : normalizedDueAt,
    });
  }
}

export class TaskContextPresenter {
  formatDate(value, locale = 'es-MX') {
    if (!value) return 'Sin fecha';
    const nextDate = new Date(value);
    if (Number.isNaN(nextDate.getTime())) return 'Sin fecha';

    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }).format(nextDate);
  }

  buildTaskContext(task) {
    return [
      task.project || 'Sin proyecto',
      task.area || 'Sin area',
      this.getStatusLabel(task.status),
      this.getPriorityLabel(task.priority),
      this.formatDate(task.getRelevantDate()),
    ];
  }

  buildSubtaskContext(task, subtask) {
    return {
      id: subtask.id,
      title: subtask.title,
      done: subtask.done,
      context: this.buildTaskContext(task).join(' · '),
    };
  }

  getStatusLabel(status) {
    const labels = {
      [TASK_STATUS.ACTIVE]: 'Activa',
      [TASK_STATUS.BLOCKED]: 'Bloqueada',
      [TASK_STATUS.WAITING]: 'En espera',
      [TASK_STATUS.COMPLETED]: 'Completada',
    };

    return labels[status] || 'Activa';
  }

  getPriorityLabel(priority) {
    const labels = {
      [TASK_PRIORITY.HIGH]: 'Alta prioridad',
      [TASK_PRIORITY.MEDIUM]: 'Prioridad media',
      [TASK_PRIORITY.LOW]: 'Baja prioridad',
    };

    return labels[priority] || 'Prioridad media';
  }
}
