function createEventId(prefix = 'activity') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeDateTime(value) {
  if (!value) return '';
  const nextDate = value instanceof Date ? value : new Date(value);
  return Number.isNaN(nextDate.getTime()) ? '' : nextDate.toISOString();
}

function trimLabel(value) {
  return `${value ?? ''}`.trim();
}

function startOfDay(value) {
  const nextDate = value instanceof Date ? new Date(value) : new Date(value);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function endOfDay(value) {
  const nextDate = startOfDay(value);
  nextDate.setHours(23, 59, 59, 999);
  return nextDate;
}

function startOfWeek(value) {
  const nextDate = startOfDay(value);
  const offset = (nextDate.getDay() + 6) % 7;
  nextDate.setDate(nextDate.getDate() - offset);
  return nextDate;
}

function endOfWeek(value) {
  const nextDate = startOfWeek(value);
  nextDate.setDate(nextDate.getDate() + 6);
  nextDate.setHours(23, 59, 59, 999);
  return nextDate;
}

function addDays(value, amount) {
  const nextDate = new Date(value);
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate;
}

function addWeeks(value, amount) {
  return addDays(value, amount * 7);
}

function formatDayLabel(value, locale = 'es-MX') {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric' }).format(value);
}

function formatWeekLabel(startDate, endDate, locale = 'es-MX') {
  const formatter = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
  return `${formatter.format(startDate)} - ${formatter.format(endDate)}`;
}

function formatRangeLabel(startDate, endDate, locale = 'es-MX') {
  const formatter = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  return `${formatter.format(startDate)} - ${formatter.format(endDate)}`;
}

function buildBucketKey(value, granularity) {
  if (granularity === DASHBOARD_GRANULARITY.WEEK) {
    return startOfWeek(value).toISOString().slice(0, 10);
  }

  return startOfDay(value).toISOString().slice(0, 10);
}

export const ACTIVITY_TYPES = Object.freeze({
  COMPLETED: 'completed',
  DELETED: 'deleted',
});

export const DASHBOARD_GRANULARITY = Object.freeze({
  DAY: 'day',
  WEEK: 'week',
});

export class TaskActivityEvent {
  constructor({
    id,
    type = ACTIVITY_TYPES.COMPLETED,
    taskId = '',
    title = '',
    project = '',
    area = '',
    happenedAt = new Date().toISOString(),
  } = {}) {
    this.id = id || createEventId();
    this.type = Object.values(ACTIVITY_TYPES).includes(type) ? type : ACTIVITY_TYPES.COMPLETED;
    this.taskId = trimLabel(taskId);
    this.title = trimLabel(title);
    this.project = trimLabel(project);
    this.area = trimLabel(area);
    this.happenedAt = normalizeDateTime(happenedAt) || normalizeDateTime(new Date());
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      taskId: this.taskId,
      title: this.title,
      project: this.project,
      area: this.area,
      happenedAt: this.happenedAt,
    };
  }
}

export class TaskActivityLedger {
  constructor(events = []) {
    this.events = events
      .map(event => event instanceof TaskActivityEvent ? event : new TaskActivityEvent(event))
      .filter(event => event.happenedAt)
      .sort((left, right) => new Date(left.happenedAt) - new Date(right.happenedAt));
  }

  recordCompleted(task, happenedAt = new Date().toISOString()) {
    this.events.push(new TaskActivityEvent({
      type: ACTIVITY_TYPES.COMPLETED,
      taskId: task?.id,
      title: task?.title,
      project: task?.project,
      area: task?.area,
      happenedAt,
    }));
    this.prune();
  }

  recordDeleted(task, happenedAt = new Date().toISOString()) {
    this.events.push(new TaskActivityEvent({
      type: ACTIVITY_TYPES.DELETED,
      taskId: task?.id,
      title: task?.title,
      project: task?.project,
      area: task?.area,
      happenedAt,
    }));
    this.prune();
  }

  prune(limit = 400) {
    if (this.events.length <= limit) return;
    this.events = this.events.slice(this.events.length - limit);
  }

  toJSON() {
    return this.events.map(event => event.toJSON());
  }
}

export class TaskActivityRange {
  constructor({
    granularity = DASHBOARD_GRANULARITY.DAY,
    startDate,
    endDate,
    bucketCount = 7,
    locale = 'es-MX',
  } = {}) {
    this.granularity = Object.values(DASHBOARD_GRANULARITY).includes(granularity)
      ? granularity
      : DASHBOARD_GRANULARITY.DAY;
    this.startDate = startDate instanceof Date ? new Date(startDate) : new Date(startDate);
    this.endDate = endDate instanceof Date ? new Date(endDate) : new Date(endDate);
    this.bucketCount = bucketCount;
    this.locale = locale;
  }

  createBuckets() {
    if (this.granularity === DASHBOARD_GRANULARITY.WEEK) {
      return Array.from({ length: this.bucketCount }, (_, index) => {
        const bucketStart = addWeeks(this.startDate, index);
        const bucketEnd = endOfWeek(bucketStart);
        return {
          key: bucketStart.toISOString().slice(0, 10),
          label: formatWeekLabel(bucketStart, bucketEnd, this.locale),
          completed: 0,
          deleted: 0,
          total: 0,
        };
      });
    }

    return Array.from({ length: this.bucketCount }, (_, index) => {
      const bucketDate = addDays(this.startDate, index);
      return {
        key: bucketDate.toISOString().slice(0, 10),
        label: formatDayLabel(bucketDate, this.locale),
        completed: 0,
        deleted: 0,
        total: 0,
      };
    });
  }

  buildLabel() {
    return formatRangeLabel(this.startDate, this.endDate, this.locale);
  }
}

export class TaskActivityDashboard {
  resolveRange({
    referenceDate = new Date(),
    granularity = DASHBOARD_GRANULARITY.DAY,
    days = 7,
    weeks = 6,
    startDate,
    endDate,
    locale = 'es-MX',
  } = {}) {
    if (startDate || endDate) {
      const firstBoundary = startOfDay(startDate || referenceDate);
      const lastBoundary = endOfDay(endDate || startDate || referenceDate);
      const normalizedStart = firstBoundary <= lastBoundary ? firstBoundary : startOfDay(lastBoundary);
      const normalizedEnd = firstBoundary <= lastBoundary ? lastBoundary : endOfDay(firstBoundary);
      const resolvedGranularity = granularity === DASHBOARD_GRANULARITY.WEEK
        ? DASHBOARD_GRANULARITY.WEEK
        : DASHBOARD_GRANULARITY.DAY;
      const spanMs = normalizedEnd.getTime() - normalizedStart.getTime();
      const bucketCount = resolvedGranularity === DASHBOARD_GRANULARITY.WEEK
        ? Math.max(1, Math.ceil((spanMs + 1) / (7 * 24 * 60 * 60 * 1000)))
        : Math.max(1, Math.ceil((spanMs + 1) / (24 * 60 * 60 * 1000)));

      return new TaskActivityRange({
        granularity: resolvedGranularity,
        startDate: resolvedGranularity === DASHBOARD_GRANULARITY.WEEK ? startOfWeek(normalizedStart) : normalizedStart,
        endDate: resolvedGranularity === DASHBOARD_GRANULARITY.WEEK ? endOfWeek(normalizedEnd) : normalizedEnd,
        bucketCount,
        locale,
      });
    }

    if (granularity === DASHBOARD_GRANULARITY.WEEK) {
      const lastWeekEnd = endOfWeek(referenceDate);
      const firstWeekStart = startOfWeek(addWeeks(lastWeekEnd, -(weeks - 1)));
      return new TaskActivityRange({
        granularity,
        startDate: firstWeekStart,
        endDate: lastWeekEnd,
        bucketCount: weeks,
        locale,
      });
    }

    const lastDayEnd = endOfDay(referenceDate);
    const firstDayStart = startOfDay(addDays(lastDayEnd, -(days - 1)));
    return new TaskActivityRange({
      granularity: DASHBOARD_GRANULARITY.DAY,
      startDate: firstDayStart,
      endDate: lastDayEnd,
      bucketCount: days,
      locale,
    });
  }

  build(ledger, options = {}) {
    const events = ledger instanceof TaskActivityLedger ? ledger.events : new TaskActivityLedger(ledger).events;
    const range = this.resolveRange(options);
    const series = range.createBuckets();
    const bucketsByKey = new Map(series.map(bucket => [bucket.key, bucket]));
    const visibleEvents = [];
    let completed = 0;
    let deleted = 0;

    events.forEach(event => {
      const happenedAt = new Date(event.happenedAt);
      if (Number.isNaN(happenedAt.getTime())) return;
      if (happenedAt < range.startDate || happenedAt > range.endDate) return;

      visibleEvents.push(event);
      const bucketKey = buildBucketKey(happenedAt, range.granularity);
      const bucket = bucketsByKey.get(bucketKey);
      if (bucket) {
        if (event.type === ACTIVITY_TYPES.COMPLETED) {
          bucket.completed += 1;
        }
        if (event.type === ACTIVITY_TYPES.DELETED) {
          bucket.deleted += 1;
        }
        bucket.total += 1;
      }

      if (event.type === ACTIVITY_TYPES.COMPLETED) completed += 1;
      if (event.type === ACTIVITY_TYPES.DELETED) deleted += 1;
    });

    const handled = completed + deleted;
    const completionRate = handled ? Math.round((completed / handled) * 100) : 0;

    return {
      summary: {
        completed,
        deleted,
        handled,
        completionRate,
      },
      range: {
        label: range.buildLabel(),
        granularity: range.granularity,
        startDate: range.startDate.toISOString(),
        endDate: range.endDate.toISOString(),
      },
      series,
      recentEvents: visibleEvents
        .slice()
        .sort((left, right) => new Date(right.happenedAt) - new Date(left.happenedAt))
        .slice(0, 6),
    };
  }
}
