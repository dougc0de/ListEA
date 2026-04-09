import {
  ACTIVITY_TYPES,
  DASHBOARD_GRANULARITY,
  TaskActivityDashboard,
  TaskActivityLedger,
} from './activity';
import { ProfessionalControlCenter } from './controlCenter';
import { ProductivityPatternAnalyzer, TaskHealthAnalyzer } from './operability';
import { TASK_DATE_PRECISION, TASK_STATUS } from './tasks';

export const REPORT_PERIODS = Object.freeze({
  WEEK: 'week',
  BIWEEKLY: 'biweekly',
  MONTH: 'month',
});

const PERIOD_TITLES = Object.freeze({
  [REPORT_PERIODS.WEEK]: 'Semana cerrada',
  [REPORT_PERIODS.BIWEEKLY]: 'Quincena cerrada',
  [REPORT_PERIODS.MONTH]: 'Mes cerrado',
});

function parseDate(value) {
  if (!value) return null;
  const parsed = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(value) {
  const date = parseDate(value) ?? new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value) {
  const date = startOfDay(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function startOfWeek(value) {
  const date = startOfDay(value);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return date;
}

function endOfWeek(value) {
  const date = startOfWeek(value);
  date.setDate(date.getDate() + 6);
  date.setHours(23, 59, 59, 999);
  return date;
}

function startOfMonth(value) {
  const date = startOfDay(value);
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(value) {
  const date = startOfMonth(value);
  return endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function formatDateKey(value) {
  const date = parseDate(value) ?? new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatShortDate(value, locale = 'es-MX') {
  const date = parseDate(value);
  if (!date) return 'Sin fecha';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

function formatMonthLabel(value, locale = 'es-MX') {
  const date = parseDate(value);
  if (!date) return 'Sin fecha';
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatDateTime(value, locale = 'es-MX') {
  const date = parseDate(value);
  if (!date) return 'Sin fecha';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function buildTaskCountLabel(value, singular = 'tarea', plural = 'tareas') {
  return `${value} ${value === 1 ? singular : plural}`;
}

function normalizeAnalyticsEvents(analytics = new TaskActivityLedger()) {
  if (analytics instanceof TaskActivityLedger) {
    return analytics.events;
  }

  if (analytics && Array.isArray(analytics.events)) {
    return new TaskActivityLedger(analytics.events).events;
  }

  return new TaskActivityLedger(analytics).events;
}

function isCompletedTask(task) {
  if (!task) return false;
  return typeof task.isCompleted === 'function'
    ? task.isCompleted()
    : task.status === TASK_STATUS.COMPLETED;
}

function resolveRelevantDate(task) {
  const rawValue = typeof task?.getRelevantDate === 'function'
    ? task.getRelevantDate()
    : (task?.dueAt || task?.followUpAt || task?.createdAt);
  return parseDate(rawValue);
}

function resolveAnchorDate(task) {
  return parseDate(task?.dueAt || task?.followUpAt || task?.createdAt);
}

function resolveScheduledAnchorDate(task) {
  return parseDate(task?.dueAt || task?.followUpAt);
}

function resolveCompletedAt(task) {
  return parseDate(task?.completedAt);
}

function resolveCreatedAt(task) {
  return parseDate(task?.createdAt);
}

function resolveContextLabel(task) {
  return task?.project || task?.area || task?.tags?.[0] || 'General';
}

function hasExplicitAnchorTime(task) {
  const precision = task?.dueAt
    ? task?.dueAtPrecision
    : task?.followUpAtPrecision;
  return precision === TASK_DATE_PRECISION.DATETIME;
}

function touchesRange(task, range) {
  const createdAt = resolveCreatedAt(task);
  const completedAt = resolveCompletedAt(task);
  const anchorDate = resolveAnchorDate(task);

  if (!createdAt || createdAt > range.endDate) {
    return false;
  }

  if (completedAt && completedAt < range.startDate && (!anchorDate || anchorDate < range.startDate)) {
    return false;
  }

  return true;
}

function wasOpenAtClose(task, endDate) {
  const createdAt = resolveCreatedAt(task);
  const completedAt = resolveCompletedAt(task);
  if (!createdAt || createdAt > endDate) {
    return false;
  }

  return !(completedAt && completedAt <= endDate);
}

function toTaskStateAtClose(task, endDate) {
  const completedAt = resolveCompletedAt(task);
  const shouldRemainOpen = !completedAt || completedAt > endDate;
  return {
    ...task,
    status: shouldRemainOpen ? (task?.status === TASK_STATUS.COMPLETED ? TASK_STATUS.ACTIVE : task?.status) : task?.status,
    completedAt: shouldRemainOpen ? '' : task?.completedAt,
    isCompleted() {
      return !shouldRemainOpen && isCompletedTask(task);
    },
    getRelevantDate() {
      return typeof task?.getRelevantDate === 'function'
        ? task.getRelevantDate()
        : (task?.dueAt || task?.followUpAt || task?.createdAt || '');
    },
  };
}

function sortByUrgency(left, right) {
  const leftAnchor = resolveAnchorDate(left)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const rightAnchor = resolveAnchorDate(right)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  if (leftAnchor !== rightAnchor) {
    return leftAnchor - rightAnchor;
  }

  const weights = { high: 0, medium: 1, low: 2 };
  return (weights[left?.priority] ?? 1) - (weights[right?.priority] ?? 1);
}

function collectCompletionRecords(tasks = [], analytics = [], range) {
  const completedEvents = normalizeAnalyticsEvents(analytics)
    .filter(event => [ACTIVITY_TYPES.COMPLETED, ACTIVITY_TYPES.DELETED_AFTER_COMPLETION].includes(event.type))
    .filter(event => {
      const happenedAt = parseDate(event.happenedAt);
      return happenedAt && happenedAt >= range.startDate && happenedAt <= range.endDate;
    })
    .map(event => ({
      key: `${event.taskId || event.title}:${event.happenedAt}`,
      taskId: event.taskId || '',
      title: event.title || 'Tarea sin titulo',
      context: event.project || event.area || 'General',
      happenedAt: event.happenedAt,
      source: 'analytics',
    }));

  const taskRecords = tasks
    .filter(task => {
      const completedAt = resolveCompletedAt(task);
      return completedAt && completedAt >= range.startDate && completedAt <= range.endDate;
    })
    .map(task => ({
      key: `${task.id || task.title}:${task.completedAt}`,
      taskId: task.id || '',
      title: task.title || 'Tarea sin titulo',
      context: resolveContextLabel(task),
      happenedAt: task.completedAt,
      source: 'task',
    }));

  const merged = new Map();
  [...completedEvents, ...taskRecords].forEach(record => {
    if (!merged.has(record.key)) {
      merged.set(record.key, record);
    }
  });

  return Array.from(merged.values())
    .sort((left, right) => new Date(right.happenedAt) - new Date(left.happenedAt));
}

function buildHourRangeFromRecords(records = []) {
  const hourMap = new Map();
  records.forEach(record => {
    const date = parseDate(record.happenedAt);
    if (!date) return;
    const hour = date.getHours();
    hourMap.set(hour, (hourMap.get(hour) ?? 0) + 1);
  });

  const bestHour = Array.from(hourMap.entries()).sort((left, right) => right[1] - left[1])[0]?.[0];
  if (!Number.isFinite(bestHour)) {
    return 'Sin datos suficientes';
  }

  return `${`${bestHour}`.padStart(2, '0')}:00 - ${`${(bestHour + 1) % 24}`.padStart(2, '0')}:00`;
}

function buildMissedHourRange(tasks = [], endDate) {
  const records = [];

  tasks.forEach(task => {
    const anchorDate = resolveScheduledAnchorDate(task);
    if (!anchorDate || !hasExplicitAnchorTime(task) || anchorDate > endDate) {
      return;
    }

    const completedAt = resolveCompletedAt(task);
    const wasMissed = !completedAt || completedAt > anchorDate;
    if (!wasMissed) {
      return;
    }

    records.push({ happenedAt: anchorDate.toISOString() });
  });

  return buildHourRangeFromRecords(records);
}

function buildMostPostponedContext(tasks = []) {
  const grouped = tasks.reduce((map, task) => {
    const postponedCount = Number(task?.postponedCount ?? 0);
    if (postponedCount <= 0) {
      return map;
    }

    const context = resolveContextLabel(task);
    map.set(context, (map.get(context) ?? 0) + postponedCount);
    return map;
  }, new Map());

  const best = Array.from(grouped.entries()).sort((left, right) => right[1] - left[1])[0];
  return best?.[0] || 'Sin contexto dominante';
}

function buildListItems(tasks = [], formatter, limit = 4) {
  return tasks.slice(0, limit).map(task => formatter(task));
}

function buildInsightPool({
  patternInsights = [],
  overdueCount = 0,
  noDateCount = 0,
  openAtCloseCount = 0,
  controlCenter,
  completionRate = 0,
  createdCount = 0,
  completedCount = 0,
}) {
  const items = patternInsights
    .map(item => item?.message)
    .filter(Boolean);

  if (overdueCount > 0) {
    items.unshift(`Cerraste el periodo con ${overdueCount} ${overdueCount === 1 ? 'tarea vencida' : 'tareas vencidas'}.`);
  } else if (openAtCloseCount > 0) {
    items.unshift(`El cierre dejo ${openAtCloseCount} ${openAtCloseCount === 1 ? 'tarea pendiente' : 'tareas pendientes'} activas.`);
  } else if (createdCount || completedCount) {
    items.unshift(`Cerraste el ${completionRate}% de lo que estuvo vivo en el periodo.`);
  }

  if (noDateCount > 0) {
    items.push(`${noDateCount} ${noDateCount === 1 ? 'tarea seguia' : 'tareas seguian'} sin fecha al cierre.`);
  }

  if (controlCenter?.summary?.responses > 0) {
    items.push(`${controlCenter.summary.responses} ${controlCenter.summary.responses === 1 ? 'respuesta por enviar detectada' : 'respuestas por enviar detectadas'}.`);
  }

  if (controlCenter?.summary?.launches > 0) {
    items.push(`${controlCenter.summary.launches} apertura${controlCenter.summary.launches === 1 ? '' : 's'} locales de apps compatibles en el periodo.`);
  }

  return Array.from(new Set(items)).slice(0, 5);
}

function buildEmptyInsight(periodTitle) {
  return `Todavia no hay suficiente actividad local para leer ${periodTitle.toLowerCase()}.`;
}

function resolvePeriodWindow(period, referenceDate, locale = 'es-MX') {
  const normalizedReference = parseDate(referenceDate) ?? new Date();

  if (period === REPORT_PERIODS.WEEK) {
    const currentWeekStart = startOfWeek(normalizedReference);
    const endDate = endOfDay(new Date(currentWeekStart.getTime() - 24 * 60 * 60 * 1000));
    const startDate = startOfWeek(endDate);
    return {
      period,
      id: period,
      title: PERIOD_TITLES[period],
      startDate,
      endDate,
      label: `${formatShortDate(startDate, locale)} - ${formatShortDate(endDate, locale)}`,
      fileLabel: `${formatDateKey(startDate)}_${formatDateKey(endDate)}`,
    };
  }

  if (period === REPORT_PERIODS.BIWEEKLY) {
    const year = normalizedReference.getFullYear();
    const month = normalizedReference.getMonth();
    const day = normalizedReference.getDate();

    let startDate;
    let endDate;
    if (day <= 15) {
      endDate = endOfDay(new Date(year, month, 0));
      startDate = startOfDay(new Date(endDate.getFullYear(), endDate.getMonth(), 16));
    } else {
      startDate = startOfDay(new Date(year, month, 1));
      endDate = endOfDay(new Date(year, month, 15));
    }

    return {
      period,
      id: period,
      title: PERIOD_TITLES[period],
      startDate,
      endDate,
      label: `${formatShortDate(startDate, locale)} - ${formatShortDate(endDate, locale)}`,
      fileLabel: `${formatDateKey(startDate)}_${formatDateKey(endDate)}`,
    };
  }

  const endDate = endOfDay(new Date(normalizedReference.getFullYear(), normalizedReference.getMonth(), 0));
  const startDate = startOfMonth(endDate);
  return {
    period,
    id: REPORT_PERIODS.MONTH,
    title: PERIOD_TITLES[REPORT_PERIODS.MONTH],
    startDate,
    endDate,
    label: formatMonthLabel(startDate, locale),
    fileLabel: `${startDate.getFullYear()}-${`${startDate.getMonth() + 1}`.padStart(2, '0')}`,
  };
}

export class PeriodicReportService {
  constructor({
    dashboard = new TaskActivityDashboard(),
    controlCenter = new ProfessionalControlCenter(),
    patternAnalyzer = new ProductivityPatternAnalyzer(),
    healthAnalyzer = new TaskHealthAnalyzer(),
    locale = 'es-MX',
  } = {}) {
    this.dashboard = dashboard;
    this.controlCenter = controlCenter;
    this.patternAnalyzer = patternAnalyzer;
    this.healthAnalyzer = healthAnalyzer;
    this.locale = locale;
  }

  resolveWindow(period, referenceDate = new Date()) {
    return resolvePeriodWindow(period, referenceDate, this.locale);
  }

  build(tasks = [], analytics = new TaskActivityLedger(), {
    period = REPORT_PERIODS.WEEK,
    referenceDate = new Date(),
  } = {}) {
    const range = this.resolveWindow(period, referenceDate);
    const scopedTasks = tasks.filter(task => touchesRange(task, range));
    const openAtCloseTasks = scopedTasks
      .filter(task => wasOpenAtClose(task, range.endDate))
      .map(task => toTaskStateAtClose(task, range.endDate))
      .sort(sortByUrgency);

    const completionRecords = collectCompletionRecords(tasks, analytics, range);
    const createdTasks = tasks.filter(task => {
      const createdAt = resolveCreatedAt(task);
      return createdAt && createdAt >= range.startDate && createdAt <= range.endDate;
    });
    const overdueAtCloseTasks = openAtCloseTasks.filter(task => {
      const anchorDate = resolveScheduledAnchorDate(task);
      return anchorDate && anchorDate < range.endDate;
    });
    const noDateTasks = openAtCloseTasks.filter(task => !resolveRelevantDate(task));

    const dashboard = this.dashboard.build(analytics, {
      tasks: scopedTasks,
      referenceDate: range.endDate,
      granularity: DASHBOARD_GRANULARITY.DAY,
      startDate: range.startDate,
      endDate: range.endDate,
    });
    const controlCenter = this.controlCenter.build(openAtCloseTasks, analytics, {
      referenceDate: range.endDate,
      rangeStart: range.startDate.toISOString(),
      rangeEnd: range.endDate.toISOString(),
      completionRate: dashboard.summary.completionRate,
    });
    const patternStats = this.patternAnalyzer.analyze(scopedTasks, analytics, {
      referenceDate: range.endDate,
    });
    const healthSummary = this.healthAnalyzer.summarize(openAtCloseTasks, {
      referenceDate: range.endDate,
    });

    const completedCount = completionRecords.length;
    const openAtCloseCount = openAtCloseTasks.length;
    const overdueCount = overdueAtCloseTasks.length;
    const noDateCount = noDateTasks.length;
    const completionRate = Math.round((completedCount / Math.max(1, completedCount + openAtCloseCount)) * 100);
    const insights = buildInsightPool({
      patternInsights: patternStats.insights,
      overdueCount,
      noDateCount,
      openAtCloseCount,
      controlCenter,
      completionRate,
      createdCount: createdTasks.length,
      completedCount,
    });
    const mainInsight = insights[0] || buildEmptyInsight(range.title);

    const snapshot = {
      id: range.id,
      period: range.period,
      title: range.title,
      range: {
        startDate: range.startDate.toISOString(),
        endDate: range.endDate.toISOString(),
        label: range.label,
        fileLabel: range.fileLabel,
      },
      summary: {
        created: createdTasks.length,
        completed: completedCount,
        openAtClose: openAtCloseCount,
        overdue: overdueCount,
        noDate: noDateCount,
        completionRate,
      },
      signals: {
        atRisk: healthSummary['at-risk'] ?? 0,
        stalled: healthSummary.stalled ?? 0,
        responses: controlCenter.summary.responses,
        blocked: controlCenter.summary.staleBlocked,
        launches: controlCenter.summary.launches,
      },
      patterns: {
        bestHourRange: buildHourRangeFromRecords(completionRecords),
        missedHourRange: buildMissedHourRange(scopedTasks, range.endDate),
        mostPostponedContext: buildMostPostponedContext(scopedTasks),
        insights,
        mainInsight,
      },
      lists: {
        completed: completionRecords.slice(0, 4).map(record => ({
          id: record.key,
          title: record.title,
          tag: record.context,
          meta: `Cerrada ${formatDateTime(record.happenedAt, this.locale)}`,
          detail: 'Se completo dentro del periodo observado.',
        })),
        pending: buildListItems(openAtCloseTasks, task => ({
          id: task.id,
          title: task.title || 'Tarea sin titulo',
          tag: resolveContextLabel(task),
          meta: resolveRelevantDate(task)
            ? `Seguia abierta al cierre · ${formatDateTime(resolveRelevantDate(task), this.locale)}`
            : 'Seguia abierta al cierre',
          detail: task.notes || 'Conviene revisar el siguiente paso para que no siga abierta.',
        })),
        overdue: buildListItems(overdueAtCloseTasks, task => ({
          id: `${task.id}:overdue`,
          title: task.title || 'Tarea sin titulo',
          tag: resolveContextLabel(task),
          meta: `Vencio ${formatDateTime(resolveScheduledAnchorDate(task), this.locale)}`,
          detail: task.followUpAt && !task.dueAt
            ? 'El seguimiento llego al cierre sin resolverse.'
            : 'La fecha objetivo ya habia pasado al momento del cierre.',
        })),
        noDate: buildListItems(noDateTasks, task => ({
          id: `${task.id}:no-date`,
          title: task.title || 'Tarea sin titulo',
          tag: resolveContextLabel(task),
          meta: 'Activa sin fecha al cierre',
          detail: task.notes || 'Necesita una fecha o un proximo paso claro.',
        })),
      },
      dashboard,
      controlCenter,
      isEmpty: createdTasks.length === 0 && completedCount === 0 && openAtCloseCount === 0,
    };

    snapshot.preview = {
      completionLabel: `${snapshot.summary.completionRate}%`,
      pendingLabel: `${snapshot.summary.openAtClose} al cierre`,
      overdueLabel: snapshot.summary.overdue
        ? `${buildTaskCountLabel(snapshot.summary.overdue, 'vencida', 'vencidas')}`
        : 'Sin vencidas',
      insight: snapshot.patterns.mainInsight,
    };

    return snapshot;
  }
}

export function buildPeriodReport(tasks = [], analytics = new TaskActivityLedger(), options = {}) {
  return new PeriodicReportService().build(tasks, analytics, options);
}
