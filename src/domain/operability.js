import { TaskFilterService, FILTER_IDS } from './filters';
import { TASK_DATE_PRECISION, TASK_STATUS } from './tasks';

export const TASK_HEALTH_STATES = Object.freeze({
  NEW: 'new',
  ACTIVE: 'active',
  AT_RISK: 'at-risk',
  STALLED: 'stalled',
  OVERDUE: 'overdue',
  COMPLETED: 'completed',
});

export const REMINDER_PERSONALITIES = Object.freeze({
  SOFT: 'soft',
  PROFESSIONAL: 'professional',
  FIRM: 'firm',
  WARM: 'warm',
});

export const REMINDER_PERSONALITY_OPTIONS = Object.freeze([
  { value: REMINDER_PERSONALITIES.SOFT, label: 'Suave' },
  { value: REMINDER_PERSONALITIES.PROFESSIONAL, label: 'Profesional' },
  { value: REMINDER_PERSONALITIES.FIRM, label: 'Firme' },
  { value: REMINDER_PERSONALITIES.WARM, label: 'Calido' },
]);

const HEALTH_LABELS = Object.freeze({
  [TASK_HEALTH_STATES.NEW]: 'Nueva',
  [TASK_HEALTH_STATES.ACTIVE]: 'Activa',
  [TASK_HEALTH_STATES.AT_RISK]: 'En riesgo',
  [TASK_HEALTH_STATES.STALLED]: 'Estancada',
  [TASK_HEALTH_STATES.OVERDUE]: 'Vencida',
  [TASK_HEALTH_STATES.COMPLETED]: 'Completada',
});

const HEALTH_TONES = Object.freeze({
  [TASK_HEALTH_STATES.NEW]: 'fresh',
  [TASK_HEALTH_STATES.ACTIVE]: 'steady',
  [TASK_HEALTH_STATES.AT_RISK]: 'warn',
  [TASK_HEALTH_STATES.STALLED]: 'stalled',
  [TASK_HEALTH_STATES.OVERDUE]: 'danger',
  [TASK_HEALTH_STATES.COMPLETED]: 'done',
});

function parseDate(value) {
  if (!value) return null;
  const parsed = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(value) {
  const nextDate = parseDate(value) ?? new Date();
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function diffInDays(left, right) {
  const start = startOfDay(left);
  const end = startOfDay(right);
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
}

function isCompleted(task) {
  if (!task) return false;
  return typeof task.isCompleted === 'function'
    ? task.isCompleted()
    : task.status === TASK_STATUS.COMPLETED;
}

function getRelevantDate(task) {
  const raw = typeof task?.getRelevantDate === 'function'
    ? task.getRelevantDate()
    : (task?.dueAt || task?.followUpAt || '');
  return parseDate(raw);
}

function getPriorityWeight(task) {
  const priority = task?.priority === 'high' || task?.impact === 'high'
    ? 0
    : task?.priority === 'low' && task?.impact === 'low'
      ? 2
      : 1;
  return priority;
}

function sortByUrgency(left, right) {
  const leftDate = getRelevantDate(left)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const rightDate = getRelevantDate(right)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  if (leftDate !== rightDate) {
    return leftDate - rightDate;
  }

  return getPriorityWeight(left) - getPriorityWeight(right);
}

function normalizePersonality(value) {
  return Object.values(REMINDER_PERSONALITIES).includes(value)
    ? value
    : REMINDER_PERSONALITIES.PROFESSIONAL;
}

function formatDateLabel(value, precision = TASK_DATE_PRECISION.DATETIME, locale = 'es-MX') {
  const parsed = parseDate(value);
  if (!parsed) return 'sin fecha';

  if (precision === TASK_DATE_PRECISION.DATE) {
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
    }).format(parsed);
  }

  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed);
}

function getTaskPrecision(task) {
  return task?.dueAt
    ? task?.dueAtPrecision
    : task?.followUpAtPrecision;
}

function hasHighImportance(task) {
  return task?.priority === 'high' || task?.impact === 'high';
}

function hasLargeUndefinedWork(task) {
  return !task?.hasSubtasks?.() && (task?.effortMinutes ?? 0) >= 45;
}

function buildReason(message) {
  return `${message ?? ''}`.trim();
}

export class TaskHealthAnalyzer {
  analyze(task, { referenceDate = new Date() } = {}) {
    if (!task) {
      return {
        state: TASK_HEALTH_STATES.ACTIVE,
        label: HEALTH_LABELS[TASK_HEALTH_STATES.ACTIVE],
        tone: HEALTH_TONES[TASK_HEALTH_STATES.ACTIVE],
        reason: '',
      };
    }

    if (isCompleted(task)) {
      return this.buildResult(TASK_HEALTH_STATES.COMPLETED, 'Ya fue cerrada y no necesita energia adicional.');
    }

    const createdAt = parseDate(task.createdAt) ?? referenceDate;
    const updatedAt = parseDate(task.updatedAt) ?? createdAt;
    const relevantDate = getRelevantDate(task);
    const ageDays = diffInDays(createdAt, referenceDate);
    const idleDays = diffInDays(updatedAt, referenceDate);
    const postponedCount = Number(task?.postponedCount ?? 0);

    if (relevantDate && relevantDate < referenceDate) {
      return this.buildResult(
        TASK_HEALTH_STATES.OVERDUE,
        task?.followUpAt && !task?.dueAt
          ? 'El seguimiento ya se paso y conviene decidir una respuesta o nueva fecha.'
          : 'Su fecha ya vencio y necesita una decision inmediata.',
      );
    }

    if (postponedCount >= 3 || ((task?.status === TASK_STATUS.BLOCKED || task?.status === TASK_STATUS.WAITING) && idleDays >= 4)) {
      return this.buildResult(
        TASK_HEALTH_STATES.STALLED,
        postponedCount >= 3
          ? `Se ha movido ${postponedCount} veces y ya pide otra estrategia.`
          : 'Lleva varios dias quieta en espera o bloqueo.',
      );
    }

    if (
      (hasHighImportance(task) && hasLargeUndefinedWork(task))
      || (relevantDate && idleDays >= 4 && !task?.hasSubtasks?.())
    ) {
      return this.buildResult(
        TASK_HEALTH_STATES.AT_RISK,
        hasLargeUndefinedWork(task)
          ? 'Es importante, grande y aun no tiene pasos claros.'
          : 'Tiene fecha, pero no muestra suficiente avance para llegar bien.',
      );
    }

    if (ageDays <= 2 && postponedCount === 0 && idleDays <= 2) {
      return this.buildResult(TASK_HEALTH_STATES.NEW, 'Acaba de entrar y todavia tiene contexto fresco.');
    }

    return this.buildResult(TASK_HEALTH_STATES.ACTIVE, 'Tiene suficiente contexto para seguir en movimiento.');
  }

  summarize(tasks = [], { referenceDate = new Date() } = {}) {
    return tasks.reduce((summary, task) => {
      const health = this.analyze(task, { referenceDate });
      summary[health.state] = (summary[health.state] ?? 0) + 1;
      return summary;
    }, {
      [TASK_HEALTH_STATES.NEW]: 0,
      [TASK_HEALTH_STATES.ACTIVE]: 0,
      [TASK_HEALTH_STATES.AT_RISK]: 0,
      [TASK_HEALTH_STATES.STALLED]: 0,
      [TASK_HEALTH_STATES.OVERDUE]: 0,
      [TASK_HEALTH_STATES.COMPLETED]: 0,
    });
  }

  buildResult(state, reason) {
    return {
      state,
      label: HEALTH_LABELS[state],
      tone: HEALTH_TONES[state],
      reason: buildReason(reason),
    };
  }
}

export class DailyRecoveryPlanner {
  constructor({
    filterService = new TaskFilterService(),
    healthAnalyzer = new TaskHealthAnalyzer(),
  } = {}) {
    this.filterService = filterService;
    this.healthAnalyzer = healthAnalyzer;
  }

  build(tasks = [], { referenceDate = new Date() } = {}) {
    const activeTasks = tasks.filter(task => !isCompleted(task));
    const todayTasks = this.filterService.apply(activeTasks, FILTER_IDS.TODAY, { referenceDate }).slice().sort(sortByUrgency);
    const overdueTasks = this.filterService.apply(activeTasks, FILTER_IDS.OVERDUE, { referenceDate }).slice().sort(sortByUrgency);
    const quickWins = this.filterService.apply(activeTasks, FILTER_IDS.QUICK, { referenceDate }).slice().sort(sortByUrgency);
    const highImportanceToday = todayTasks.filter(task => hasHighImportance(task));
    const scheduledMinutes = todayTasks.reduce((total, task) => total + Number(task?.effortMinutes ?? 0), 0);

    const priorityPool = [...overdueTasks, ...highImportanceToday, ...todayTasks]
      .filter((task, index, list) => list.findIndex(item => item.id === task.id) === index)
      .sort(sortByUrgency);
    const priorityTasks = priorityPool.slice(0, 3).map(task => {
      const health = this.healthAnalyzer.analyze(task, { referenceDate });
      return {
        id: task.id,
        title: task.title,
        badge: health.label,
        tone: health.tone,
      };
    });

    const overloadReasons = [];
    if (todayTasks.length >= 6) {
      overloadReasons.push('hay demasiadas tareas programadas hoy');
    }
    if (scheduledMinutes >= 240) {
      overloadReasons.push('la carga del dia ya supera cuatro horas de trabajo planificado');
    }
    if (highImportanceToday.length >= 3) {
      overloadReasons.push('estas cargando demasiados compromisos importantes en la misma jornada');
    }
    if (overdueTasks.length >= 2) {
      overloadReasons.push('ya arrastras vencidas sobre la agenda de hoy');
    }

    const staleNoDateCount = activeTasks.filter(task => {
      if (task.getRelevantDate?.()) return false;
      return diffInDays(task.createdAt, referenceDate) >= 10;
    }).length;

    const shouldShow = Boolean(overloadReasons.length || overdueTasks.length || staleNoDateCount || priorityTasks.length);
    const headline = overloadReasons.length
      ? 'Modo recuperacion activo'
      : 'Dia en control';
    const message = overloadReasons.length
      ? `ListEA recorto el ruido: enfocate primero en ${priorityTasks.length || 3} prioridades y deja el resto para despues.`
      : 'Tu lista sigue manejable. Aun asi, ListEA dejo visibles las prioridades mas claras para hoy.';

    const cleanupMessage = staleNoDateCount
      ? `${staleNoDateCount} tarea(s) sin fecha piden limpieza de backlog antes de crecer mas.`
      : overdueTasks.length
        ? `Rescata ${overdueTasks.length} vencida(s) antes de sumar mas carga hoy.`
        : '';

    return {
      shouldShow,
      isRecoveryMode: overloadReasons.length > 0,
      headline,
      message,
      reasons: overloadReasons,
      priorityTasks,
      quickWins: quickWins.slice(0, 3).map(task => ({
        id: task.id,
        title: task.title,
        minutes: Number(task?.effortMinutes ?? 0),
      })),
      hiddenCount: Math.max(todayTasks.length - priorityTasks.length, 0),
      cleanupMessage,
    };
  }
}

export class BacklogRescuePlanner {
  constructor({
    healthAnalyzer = new TaskHealthAnalyzer(),
  } = {}) {
    this.healthAnalyzer = healthAnalyzer;
  }

  build(tasks = [], { referenceDate = new Date() } = {}) {
    const activeTasks = tasks.filter(task => !isCompleted(task));
    const candidates = activeTasks
      .map(task => this.buildSuggestion(task, { referenceDate }))
      .filter(Boolean)
      .sort((left, right) => sortByUrgency(left.task, right.task));

    return {
      shouldShow: candidates.length > 0,
      items: candidates.slice(0, 4).map(({ task, actionId, actionLabel, reason }) => ({
        id: `${task.id}:${actionId}`,
        taskId: task.id,
        title: task.title,
        actionId,
        actionLabel,
        reason,
      })),
      counts: candidates.reduce((summary, item) => {
        summary[item.actionId] = (summary[item.actionId] ?? 0) + 1;
        return summary;
      }, {}),
    };
  }

  buildSuggestion(task, { referenceDate = new Date() } = {}) {
    const health = this.healthAnalyzer.analyze(task, { referenceDate });
    const ageDays = diffInDays(task.createdAt, referenceDate);
    const hasDate = Boolean(task.getRelevantDate?.());

    if (!task?.hasSubtasks?.() && (task?.effortMinutes ?? 0) >= 60) {
      return {
        task,
        actionId: 'split',
        actionLabel: 'Dividir',
        reason: 'Es demasiado grande para seguir como una sola pieza.',
      };
    }

    if (health.state === TASK_HEALTH_STATES.OVERDUE || health.state === TASK_HEALTH_STATES.AT_RISK) {
      return {
        task,
        actionId: 'replan',
        actionLabel: 'Reprogramar',
        reason: 'La fecha actual ya no la esta ayudando a avanzar.',
      };
    }

    if (!hasDate && ageDays >= 21 && task.priority === 'low' && task.impact !== 'high') {
      return {
        task,
        actionId: 'archive',
        actionLabel: 'Congelar',
        reason: 'Lleva semanas abierta sin fecha ni urgencia real.',
      };
    }

    if (!task?.hasSubtasks?.() && (task?.effortMinutes ?? 0) <= 25) {
      return {
        task,
        actionId: 'quick-step',
        actionLabel: 'Primer paso',
        reason: 'Puede resolverse si la conviertes en una accion pequena y concreta.',
      };
    }

    if (health.state === TASK_HEALTH_STATES.STALLED || task.status === TASK_STATUS.BLOCKED || task.status === TASK_STATUS.WAITING) {
      return {
        task,
        actionId: 'regroup',
        actionLabel: 'Reagrupar',
        reason: 'Necesita contexto nuevo o un siguiente paso distinto para destrabarse.',
      };
    }

    return null;
  }
}

export class ProductivityPatternAnalyzer {
  analyze(tasks = [], analytics = [], { referenceDate = new Date() } = {}) {
    const completedTasks = tasks.filter(task => isCompleted(task) && parseDate(task.completedAt));
    const activeTasks = tasks.filter(task => !isCompleted(task));
    const insights = [];

    const morningCompletions = completedTasks.filter(task => parseDate(task.completedAt).getHours() < 12).length;
    const afternoonCompletions = completedTasks.filter(task => {
      const hour = parseDate(task.completedAt).getHours();
      return hour >= 12 && hour < 18;
    }).length;
    if (morningCompletions >= 3 && morningCompletions > afternoonCompletions) {
      insights.push({
        id: 'morning',
        title: 'Rindes mejor en la manana',
        message: `Cerras ${morningCompletions} tareas en la manana, mas que en el resto del dia.`,
        tone: 'good',
      });
    }

    const postponementGroups = activeTasks.reduce((groups, task) => {
      const count = Number(task?.postponedCount ?? 0);
      if (count <= 0) return groups;
      const key = task.area || task.project || 'Sin contexto';
      groups.set(key, (groups.get(key) ?? 0) + count);
      return groups;
    }, new Map());
    const topPostponed = Array.from(postponementGroups.entries()).sort((left, right) => right[1] - left[1])[0];
    if (topPostponed?.[1] >= 3) {
      insights.push({
        id: 'postpone-context',
        title: 'Hay un contexto que siempre pateas',
        message: `${topPostponed[0]} concentra ${topPostponed[1]} reprogramaciones y merece una estrategia distinta.`,
        tone: 'warn',
      });
    }

    const mondayLoad = tasks.filter(task => getRelevantDate(task)?.getDay() === 1).length;
    const otherWeekdays = [2, 3, 4, 5].map(day =>
      tasks.filter(task => getRelevantDate(task)?.getDay() === day).length,
    );
    const weekdayAverage = otherWeekdays.length
      ? otherWeekdays.reduce((total, value) => total + value, 0) / otherWeekdays.length
      : 0;
    if (mondayLoad >= 3 && mondayLoad > weekdayAverage + 1) {
      insights.push({
        id: 'monday-load',
        title: 'Los lunes cargas de mas',
        message: `Tus lunes acumulan ${mondayLoad} tareas, por encima del ritmo medio de la semana.`,
        tone: 'warn',
      });
    }

    const quickWins = tasks.filter(task => Number(task?.effortMinutes ?? 0) <= 15);
    const quickWinsCompleted = quickWins.filter(task => isCompleted(task)).length;
    if (quickWins.length >= 4) {
      const quickRate = Math.round((quickWinsCompleted / quickWins.length) * 100);
      insights.push({
        id: 'quick-wins',
        title: quickRate >= 60 ? 'Tus quick wins si salen' : 'Tus quick wins se te estan escapando',
        message: `${quickRate}% de tus tareas rapidas terminan cerrandose.`,
        tone: quickRate >= 60 ? 'good' : 'warn',
      });
    }

    const dateOnlyTasks = tasks.filter(task => task?.dueAt && task?.dueAtPrecision === TASK_DATE_PRECISION.DATE);
    const dateOnlyOverdue = dateOnlyTasks.filter(task => !isCompleted(task) && parseDate(task.dueAt) < referenceDate).length;
    const dateTimeTasks = tasks.filter(task => task?.dueAt && task?.dueAtPrecision === TASK_DATE_PRECISION.DATETIME);
    const dateTimeOverdue = dateTimeTasks.filter(task => !isCompleted(task) && parseDate(task.dueAt) < referenceDate).length;
    const dateOnlyRate = dateOnlyTasks.length ? dateOnlyOverdue / dateOnlyTasks.length : 0;
    const dateTimeRate = dateTimeTasks.length ? dateTimeOverdue / dateTimeTasks.length : 0;
    if (dateOnlyTasks.length >= 3 && dateOnlyRate > (dateTimeRate + 0.2)) {
      insights.push({
        id: 'date-only-risk',
        title: 'Las tareas sin hora concreta se te vencen mas',
        message: 'Cuando una tarea solo tiene fecha general, se cae mas facil que las que tienen hora definida.',
        tone: 'warn',
      });
    }

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        completedCount: completedTasks.length,
        activeCount: activeTasks.length,
        analyticsCount: Array.isArray(analytics?.events) ? analytics.events.length : (Array.isArray(analytics) ? analytics.length : 0),
      },
      insights: insights.slice(0, 4),
    };
  }
}

export class ReminderPersonalityCopywriter {
  constructor({ locale = 'es-MX' } = {}) {
    this.locale = locale;
  }

  buildTaskReminder(task, lane, personality = REMINDER_PERSONALITIES.PROFESSIONAL) {
    const normalized = normalizePersonality(personality);
    const anchor = getRelevantDate(task);
    const dateLabel = anchor ? formatDateLabel(anchor, getTaskPrecision(task), this.locale) : 'sin fecha';
    const projectLabel = task?.project || task?.area || (task?.followUpAt ? 'Seguimiento' : 'Tarea');

    if (normalized === REMINDER_PERSONALITIES.SOFT) {
      return this.buildSoftCopy(task, lane, dateLabel, projectLabel);
    }

    if (normalized === REMINDER_PERSONALITIES.FIRM) {
      return this.buildFirmCopy(task, lane, dateLabel, projectLabel);
    }

    if (normalized === REMINDER_PERSONALITIES.WARM) {
      return this.buildWarmCopy(task, lane, dateLabel, projectLabel);
    }

    return this.buildProfessionalCopy(task, lane, dateLabel, projectLabel);
  }

  buildWeeklyBrief(report, personality = REMINDER_PERSONALITIES.PROFESSIONAL) {
    const normalized = normalizePersonality(personality);
    const topHighlight = report?.highlights?.[0] || 'Tu lectura operativa semanal ya esta lista.';
    const baseLargeBody = Array.isArray(report?.highlights)
      ? report.highlights.join(' ')
      : topHighlight;

    if (normalized === REMINDER_PERSONALITIES.SOFT) {
      return {
        title: 'Tu semana merece una mirada tranquila',
        body: topHighlight,
        largeBody: baseLargeBody,
        summaryText: 'Semana local',
      };
    }

    if (normalized === REMINDER_PERSONALITIES.FIRM) {
      return {
        title: 'Revisa tu semana antes de que se te vaya',
        body: topHighlight,
        largeBody: baseLargeBody,
        summaryText: 'Control semanal',
      };
    }

    if (normalized === REMINDER_PERSONALITIES.WARM) {
      return {
        title: 'Tu lectura semanal te esta esperando',
        body: topHighlight,
        largeBody: baseLargeBody,
        summaryText: 'Semana contigo',
      };
    }

    return {
      title: 'Tu lectura operativa de ListEA ya esta lista',
      body: topHighlight,
      largeBody: baseLargeBody,
      summaryText: 'Resumen semanal',
    };
  }

  buildSnippet(task, snippet, personality = REMINDER_PERSONALITIES.PROFESSIONAL) {
    const normalized = normalizePersonality(personality);
    const nextSnippet = {
      ...snippet,
    };

    if (normalized === REMINDER_PERSONALITIES.SOFT) {
      nextSnippet.title = task?.followUpAt ? 'Pequeno recordatorio de seguimiento' : 'Pequeno recordatorio';
      nextSnippet.message = task?.title || snippet?.message;
      return nextSnippet;
    }

    if (normalized === REMINDER_PERSONALITIES.FIRM) {
      nextSnippet.title = task?.followUpAt ? 'Este seguimiento ya necesita una decision' : 'Es hora de mover esta tarea';
      nextSnippet.message = task?.title || snippet?.message;
      return nextSnippet;
    }

    if (normalized === REMINDER_PERSONALITIES.WARM) {
      nextSnippet.title = task?.followUpAt ? 'No dejes caer este seguimiento' : 'Tu siguiente paso ya te espera';
      nextSnippet.message = task?.title || snippet?.message;
      return nextSnippet;
    }

    nextSnippet.title = task?.followUpAt ? 'Seguimiento pendiente' : 'Es momento de esta tarea';
    nextSnippet.message = task?.title || snippet?.message;
    return nextSnippet;
  }

  buildProfessionalCopy(task, lane, dateLabel, projectLabel) {
    if (lane === 'advanced-prep') {
      return {
        title: 'ListEA te prepara para actuar',
        body: task?.title || 'Tienes una tarea por empezar',
        largeBody: `${projectLabel} · Preparala antes de ${dateLabel}.`,
        summaryText: projectLabel,
      };
    }

    if (lane === 'advanced-risk') {
      return {
        title: 'ListEA detecto un compromiso abierto',
        body: task?.title || 'Sigue pendiente una tarea importante',
        largeBody: `${projectLabel} · Sigue abierta despues de ${dateLabel}.`,
        summaryText: projectLabel,
      };
    }

    return {
      title: task?.followUpAt && !task?.dueAt ? 'Seguimiento pendiente' : 'Es momento de esta tarea',
      body: task?.title || 'Tienes una tarea pendiente en ListEA',
      largeBody: `${projectLabel} · Programada para ${dateLabel}.`,
      summaryText: projectLabel,
    };
  }

  buildSoftCopy(task, lane, dateLabel, projectLabel) {
    if (lane === 'advanced-prep') {
      return {
        title: 'Vale la pena prepararla con calma',
        body: task?.title || 'Tu siguiente accion se acerca',
        largeBody: `${projectLabel} · Si la adelantas un poco antes de ${dateLabel}, llegas con mas margen.`,
        summaryText: projectLabel,
      };
    }

    if (lane === 'advanced-risk') {
      return {
        title: 'Sigue aqui por si quieres retomarla',
        body: task?.title || 'Hay una tarea importante abierta',
        largeBody: `${projectLabel} · Quedo pendiente despues de ${dateLabel}.`,
        summaryText: projectLabel,
      };
    }

    return {
      title: task?.followUpAt && !task?.dueAt ? 'Un seguimiento suave para ti' : 'Un recordatorio amable',
      body: task?.title || 'Hay una tarea pendiente',
      largeBody: `${projectLabel} · Tocaba revisarla en ${dateLabel}.`,
      summaryText: projectLabel,
    };
  }

  buildFirmCopy(task, lane, dateLabel, projectLabel) {
    if (lane === 'advanced-prep') {
      return {
        title: 'Preparala ya para no llegar tarde',
        body: task?.title || 'Tu tarea arranca pronto',
        largeBody: `${projectLabel} · Se acerca ${dateLabel} y aun conviene preparar el primer paso.`,
        summaryText: projectLabel,
      };
    }

    if (lane === 'advanced-risk') {
      return {
        title: 'No dejes caer este compromiso',
        body: task?.title || 'Sigue pendiente una tarea importante',
        largeBody: `${projectLabel} · La dejaste abierta despues de ${dateLabel}.`,
        summaryText: projectLabel,
      };
    }

    return {
      title: task?.followUpAt && !task?.dueAt ? 'Este seguimiento ya toca' : 'Esta tarea ya toca',
      body: task?.title || 'Hay una tarea pendiente que no deberias ignorar',
      largeBody: `${projectLabel} · Estaba prevista para ${dateLabel}.`,
      summaryText: projectLabel,
    };
  }

  buildWarmCopy(task, lane, dateLabel, projectLabel) {
    if (lane === 'advanced-prep') {
      return {
        title: 'Te dejo lista la pista para empezar',
        body: task?.title || 'Tu siguiente paso ya se acerca',
        largeBody: `${projectLabel} · Si la preparas antes de ${dateLabel}, te sera mucho mas liviana.`,
        summaryText: projectLabel,
      };
    }

    if (lane === 'advanced-risk') {
      return {
        title: 'Esta promesa sigue contigo',
        body: task?.title || 'Hay una tarea importante abierta',
        largeBody: `${projectLabel} · Quedo pendiente despues de ${dateLabel}.`,
        summaryText: projectLabel,
      };
    }

    return {
      title: task?.followUpAt && !task?.dueAt ? 'Tu seguimiento sigue aqui' : 'Tu siguiente paso ya te espera',
      body: task?.title || 'Hay una tarea pendiente en ListEA',
      largeBody: `${projectLabel} · Tocaba verla en ${dateLabel}.`,
      summaryText: projectLabel,
    };
  }
}
