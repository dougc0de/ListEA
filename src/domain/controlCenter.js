import { ACTIVITY_TYPES, TaskActivityLedger } from './activity';
import { FILTER_IDS, TaskFilterService } from './filters';
import { SupportedMobileAppCatalog, TaskAppLaunchResolver } from './taskAppLaunch';
import { TASK_STATUS } from './tasks';

const RESPONSE_CATEGORIES = new Set(['messaging', 'email', 'social', 'meeting', 'device']);
const STALE_BLOCKED_THRESHOLD_DAYS = 3;

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

function isSameDay(left, right) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function isSameWeek(left, right) {
  const start = startOfDay(right);
  const offset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - offset);

  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  return left >= start && left < end;
}

function formatDateLabel(value, locale = 'es-MX') {
  const parsed = parseDate(value);
  if (!parsed) return 'Sin fecha';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
  }).format(parsed);
}

function formatShortMeta(parts = []) {
  return parts.filter(Boolean).join(' · ');
}

function resolveTaskDate(task) {
  return parseDate(task?.getRelevantDate?.() || task?.dueAt || task?.followUpAt || task?.createdAt);
}

function resolveAnchorDate(task) {
  return parseDate(task?.updatedAt || task?.createdAt || task?.followUpAt || task?.dueAt);
}

function isCompleted(task) {
  if (!task) return false;
  return typeof task.isCompleted === 'function'
    ? task.isCompleted()
    : task.status === TASK_STATUS.COMPLETED;
}

function priorityWeight(task) {
  const weights = { high: 0, medium: 1, low: 2 };
  return weights[task?.priority] ?? weights.medium;
}

function sortByTaskUrgency(left, right) {
  const leftDate = resolveTaskDate(left)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const rightDate = resolveTaskDate(right)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  if (leftDate !== rightDate) {
    return leftDate - rightDate;
  }

  return priorityWeight(left) - priorityWeight(right);
}

function ageInDays(value, referenceDate = new Date()) {
  const anchor = resolveAnchorDate({ updatedAt: value });
  if (!anchor) return 0;
  return Math.max(0, Math.floor((startOfDay(referenceDate).getTime() - startOfDay(anchor).getTime()) / (24 * 60 * 60 * 1000)));
}

function normalizeAnalytics(analytics = new TaskActivityLedger()) {
  if (analytics instanceof TaskActivityLedger) {
    return analytics.events;
  }

  if (analytics && Array.isArray(analytics.events)) {
    return new TaskActivityLedger(analytics.events).events;
  }

  return new TaskActivityLedger(analytics).events;
}

export class ProfessionalControlCenter {
  constructor({
    filterService = new TaskFilterService(),
    resolver = new TaskAppLaunchResolver(),
    appCatalog = new SupportedMobileAppCatalog(),
    locale = 'es-MX',
  } = {}) {
    this.filterService = filterService;
    this.resolver = resolver;
    this.appCatalog = appCatalog;
    this.locale = locale;
    this.appLabels = new Map(this.appCatalog.getAll().map(app => [app.id, app.label]));
  }

  build(tasks = [], analytics = new TaskActivityLedger(), {
    referenceDate = new Date(),
    rangeStart = '',
    rangeEnd = '',
    completionRate = 0,
  } = {}) {
    const activeTasks = tasks
      .filter(task => !isCompleted(task))
      .slice()
      .sort(sortByTaskUrgency);

    const riskItems = this.buildRiskItems(activeTasks, referenceDate);
    const responseItems = this.buildResponseItems(activeTasks);
    const blockedItems = this.buildBlockedItems(activeTasks, referenceDate);
    const appUsage = this.buildAppUsage(analytics, { rangeStart, rangeEnd });
    const pulse = this.buildPulse(activeTasks, referenceDate);

    return {
      summary: {
        atRisk: riskItems.length,
        responses: responseItems.length,
        staleBlocked: blockedItems.length,
        launches: appUsage.reduce((total, item) => total + item.count, 0),
        completionRate,
      },
      pulse,
      riskItems: riskItems.slice(0, 4),
      responseItems: responseItems.slice(0, 4),
      blockedItems: blockedItems.slice(0, 4),
      appUsage: appUsage.slice(0, 4),
    };
  }

  buildPulse(tasks, referenceDate) {
    return [
      {
        id: FILTER_IDS.TODAY,
        label: 'Hoy',
        value: this.filterService.apply(tasks, FILTER_IDS.TODAY, { referenceDate }).length,
      },
      {
        id: FILTER_IDS.THIS_WEEK,
        label: 'Semana',
        value: this.filterService.apply(tasks, FILTER_IDS.THIS_WEEK, { referenceDate }).length,
      },
      {
        id: 'follow-up',
        label: 'Seguimiento',
        value: tasks.filter(task => task.status === TASK_STATUS.WAITING || task.status === TASK_STATUS.BLOCKED || Boolean(task.followUpAt)).length,
      },
      {
        id: FILTER_IDS.NO_DATE,
        label: 'Sin fecha',
        value: this.filterService.apply(tasks, FILTER_IDS.NO_DATE, { referenceDate }).length,
      },
    ];
  }

  buildRiskItems(tasks, referenceDate) {
    return tasks
      .filter(task => {
        const dueAt = parseDate(task?.dueAt);
        const followUpAt = parseDate(task?.followUpAt);
        return (dueAt && dueAt < referenceDate) || (followUpAt && followUpAt < referenceDate);
      })
      .sort(sortByTaskUrgency)
      .map(task => {
        const dueAt = parseDate(task?.dueAt);
        const followUpAt = parseDate(task?.followUpAt);
        const isFollowUpRisk = Boolean(followUpAt && followUpAt < referenceDate && (!dueAt || task.status !== TASK_STATUS.ACTIVE));
        const relevantDate = isFollowUpRisk ? followUpAt : (dueAt || followUpAt);
        return {
          id: task.id,
          title: task.title || 'Tarea sin titulo',
          meta: formatShortMeta([
            task.project || 'Sin proyecto',
            formatDateLabel(relevantDate, this.locale),
          ]),
          badge: isFollowUpRisk ? 'Seguimiento' : 'Vencida',
        };
      });
  }

  buildResponseItems(tasks) {
    return tasks
      .map(task => {
        const suggestions = this.resolver.resolve(task).filter(suggestion =>
          suggestion?.app
          && RESPONSE_CATEGORIES.has(suggestion.app.category),
        );

        if (!suggestions.length) {
          return null;
        }

        const topLabels = suggestions.slice(0, 2).map(suggestion => suggestion.app.label);
        return {
          task,
          suggestion: suggestions[0],
          labels: topLabels,
        };
      })
      .filter(Boolean)
      .sort((left, right) => sortByTaskUrgency(left.task, right.task))
      .map(({ task, suggestion, labels }) => ({
        id: task.id,
        title: task.title || 'Tarea sin titulo',
        meta: formatShortMeta([
          task.project || 'Sin proyecto',
          formatDateLabel(resolveTaskDate(task), this.locale),
          labels.join(' / '),
        ]),
        badge: suggestion.app.label,
      }));
  }

  buildBlockedItems(tasks, referenceDate) {
    return tasks
      .filter(task => task.status === TASK_STATUS.BLOCKED || task.status === TASK_STATUS.WAITING)
      .map(task => {
        const anchorDate = resolveAnchorDate(task);
        const staleDays = anchorDate ? ageInDays(anchorDate, referenceDate) : 0;
        return staleDays >= STALE_BLOCKED_THRESHOLD_DAYS
          ? { task, staleDays }
          : null;
      })
      .filter(Boolean)
      .sort((left, right) => right.staleDays - left.staleDays)
      .map(({ task, staleDays }) => ({
        id: task.id,
        title: task.title || 'Tarea sin titulo',
        meta: formatShortMeta([
          task.project || 'Sin proyecto',
          task.status === TASK_STATUS.BLOCKED ? 'Bloqueada' : 'En espera',
        ]),
        badge: `${staleDays}d`,
      }));
  }

  buildAppUsage(analytics, { rangeStart = '', rangeEnd = '' } = {}) {
    const events = normalizeAnalytics(analytics);
    const startDate = parseDate(rangeStart);
    const endDate = parseDate(rangeEnd);
    const grouped = new Map();

    events.forEach(event => {
      if (event.type !== ACTIVITY_TYPES.LAUNCHED || !event.appId) {
        return;
      }

      const happenedAt = parseDate(event.happenedAt);
      if (!happenedAt) {
        return;
      }

      if (startDate && happenedAt < startDate) {
        return;
      }

      if (endDate && happenedAt > endDate) {
        return;
      }

      const current = grouped.get(event.appId) ?? {
        id: event.appId,
        title: this.appLabels.get(event.appId) || event.appId,
        count: 0,
      };
      current.count += 1;
      grouped.set(event.appId, current);
    });

    return Array.from(grouped.values())
      .sort((left, right) => right.count - left.count)
      .map(item => ({
        ...item,
        meta: `${item.count} apertura${item.count === 1 ? '' : 's'} locales`,
        badge: item.count === 1 ? '1 vez' : `${item.count} veces`,
      }));
  }
}
