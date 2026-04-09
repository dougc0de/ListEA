import { TASK_DATE_PRECISION, TASK_STATUS } from './tasks';

export const CALENDAR_VIEW_MODES = Object.freeze({
  ALL: 'all',
  DUE: 'due',
  FOLLOW_UP: 'follow-up',
  COMPLETED: 'completed',
});

export const CALENDAR_ENTRY_KINDS = Object.freeze({
  DUE: 'due',
  FOLLOW_UP: 'follow-up',
  COMPLETED: 'completed',
});

const WEEKDAY_LABELS = Object.freeze(['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom']);
const PRIORITY_WEIGHT = Object.freeze({
  high: 0,
  medium: 1,
  low: 2,
});

function parseDate(value) {
  const nextDate = value ? new Date(value) : null;
  return nextDate && !Number.isNaN(nextDate.getTime()) ? nextDate : null;
}

function startOfDay(value) {
  const nextDate = parseDate(value) ?? new Date();
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function endOfDay(value) {
  const nextDate = startOfDay(value);
  nextDate.setHours(23, 59, 0, 0);
  return nextDate;
}

function startOfMonth(value) {
  const nextDate = startOfDay(value);
  nextDate.setDate(1);
  return nextDate;
}

function endOfMonth(value) {
  const nextDate = startOfMonth(value);
  nextDate.setMonth(nextDate.getMonth() + 1, 0);
  nextDate.setHours(23, 59, 0, 0);
  return nextDate;
}

function addDays(value, days) {
  const nextDate = startOfDay(value);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function startOfWeek(value, weekStartsOn = 1) {
  const nextDate = startOfDay(value);
  const weekday = nextDate.getDay();
  const normalizedWeekday = (weekday - weekStartsOn + 7) % 7;
  nextDate.setDate(nextDate.getDate() - normalizedWeekday);
  return nextDate;
}

function endOfWeek(value, weekStartsOn = 1) {
  return endOfDay(addDays(startOfWeek(value, weekStartsOn), 6));
}

function toDateKey(value) {
  const nextDate = startOfDay(value);
  const year = nextDate.getFullYear();
  const month = `${nextDate.getMonth() + 1}`.padStart(2, '0');
  const day = `${nextDate.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthKey(value) {
  const nextDate = startOfMonth(value);
  return `${nextDate.getFullYear()}-${`${nextDate.getMonth() + 1}`.padStart(2, '0')}`;
}

function uniqueTasks(entries = []) {
  const taskMap = new Map();

  entries.forEach(entry => {
    if (!entry?.task?.id) return;
    const current = taskMap.get(entry.task.id);
    if (!current) {
      taskMap.set(entry.task.id, entry.task);
    }
  });

  return Array.from(taskMap.values());
}

function compareTasks(left, right) {
  const leftRelevant = parseDate(left.dueAt || left.followUpAt || left.completedAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const rightRelevant = parseDate(right.dueAt || right.followUpAt || right.completedAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;

  if (leftRelevant !== rightRelevant) {
    return leftRelevant - rightRelevant;
  }

  const leftPriority = PRIORITY_WEIGHT[left.priority] ?? 3;
  const rightPriority = PRIORITY_WEIGHT[right.priority] ?? 3;
  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  return `${left.title ?? ''}`.localeCompare(`${right.title ?? ''}`, 'es');
}

function formatMonthLabel(value, locale = 'es-MX') {
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(value);
}

export class CalendarTaskEntry {
  constructor({ task, kind, value = '', precision = '' } = {}) {
    this.task = task;
    this.kind = kind;
    this.value = value;
    this.precision = precision;
    this.date = parseDate(value);
    this.dateKey = this.date ? toDateKey(this.date) : '';
  }

  matchesMode(mode = CALENDAR_VIEW_MODES.ALL) {
    if (mode === CALENDAR_VIEW_MODES.ALL) {
      return true;
    }

    if (mode === CALENDAR_VIEW_MODES.DUE) {
      return this.kind === CALENDAR_ENTRY_KINDS.DUE;
    }

    if (mode === CALENDAR_VIEW_MODES.FOLLOW_UP) {
      return this.kind === CALENDAR_ENTRY_KINDS.FOLLOW_UP;
    }

    if (mode === CALENDAR_VIEW_MODES.COMPLETED) {
      return this.kind === CALENDAR_ENTRY_KINDS.COMPLETED;
    }

    return true;
  }

  isAllDay() {
    return this.precision === TASK_DATE_PRECISION.DATE;
  }
}

export class CalendarDayCell {
  constructor({
    date,
    entries = [],
    isCurrentMonth = false,
    isToday = false,
    isSelected = false,
    mode = CALENDAR_VIEW_MODES.ALL,
  } = {}) {
    this.date = startOfDay(date);
    this.dateKey = toDateKey(date);
    this.dayNumber = this.date.getDate();
    this.entries = entries;
    this.isCurrentMonth = Boolean(isCurrentMonth);
    this.isToday = Boolean(isToday);
    this.isSelected = Boolean(isSelected);
    this.mode = mode;
    this.counts = this.buildCounts();
    this.visibleEntries = this.entries.filter(entry => entry.matchesMode(mode));
    this.visibleTasks = uniqueTasks(this.visibleEntries).sort(compareTasks);
    this.visibleCount = this.visibleTasks.length;
    this.loadMinutes = this.visibleTasks.reduce((total, task) => total + Number(task.effortMinutes || 0), 0);
    this.previewTitle = this.visibleTasks[0]?.title ?? '';
  }

  buildCounts() {
    return this.entries.reduce((result, entry) => {
      if (entry.kind === CALENDAR_ENTRY_KINDS.DUE) {
        result.due += 1;
      } else if (entry.kind === CALENDAR_ENTRY_KINDS.FOLLOW_UP) {
        result.followUp += 1;
      } else if (entry.kind === CALENDAR_ENTRY_KINDS.COMPLETED) {
        result.completed += 1;
      }
      return result;
    }, {
      due: 0,
      followUp: 0,
      completed: 0,
    });
  }
}

export class CalendarMonthBoard {
  constructor(payload = {}) {
    Object.assign(this, payload);
  }
}

export class TaskCalendarBoardService {
  constructor({ locale = 'es-MX' } = {}) {
    this.locale = locale;
  }

  build(tasks = [], {
    visibleMonth = new Date(),
    selectedDate = new Date(),
    mode = CALENDAR_VIEW_MODES.ALL,
  } = {}) {
    const monthStart = startOfMonth(visibleMonth);
    const monthEnd = endOfMonth(monthStart);
    const selectedDay = startOfDay(selectedDate);
    const entries = this.buildEntries(tasks);
    const entriesByDate = this.groupEntriesByDate(entries);
    const todayKey = toDateKey(new Date());
    const monthVisibleKey = monthKey(monthStart);
    const gridStart = startOfWeek(monthStart, 1);
    const gridEnd = endOfWeek(monthEnd, 1);
    const days = [];

    for (let cursor = new Date(gridStart); cursor <= gridEnd; cursor = addDays(cursor, 1)) {
      const key = toDateKey(cursor);
      days.push(new CalendarDayCell({
        date: cursor,
        entries: entriesByDate.get(key) ?? [],
        isCurrentMonth: monthKey(cursor) === monthVisibleKey,
        isToday: key === todayKey,
        isSelected: key === toDateKey(selectedDay),
        mode,
      }));
    }

    const selectedCell = days.find(day => day.dateKey === toDateKey(selectedDay))
      ?? new CalendarDayCell({
        date: selectedDay,
        entries: entriesByDate.get(toDateKey(selectedDay)) ?? [],
        isCurrentMonth: monthKey(selectedDay) === monthVisibleKey,
        isToday: toDateKey(selectedDay) === todayKey,
        isSelected: true,
        mode,
      });

    return new CalendarMonthBoard({
      visibleMonth: {
        value: monthStart,
        key: monthVisibleKey,
        label: formatMonthLabel(monthStart, this.locale),
      },
      weekdayLabels: WEEKDAY_LABELS,
      days,
      selectedDay: {
        value: selectedCell.date,
        key: selectedCell.dateKey,
        tasks: selectedCell.visibleTasks,
        counts: selectedCell.counts,
        loadMinutes: selectedCell.loadMinutes,
      },
      monthStats: this.buildMonthStats(tasks, days, monthStart, monthEnd),
      upcomingDays: this.buildUpcomingDays(days, startOfDay(new Date()), mode),
    });
  }

  buildEntries(tasks = []) {
    return tasks.flatMap(task => {
      const entries = [];

      if (task.dueAt && task.status !== TASK_STATUS.COMPLETED) {
        entries.push(new CalendarTaskEntry({
          task,
          kind: CALENDAR_ENTRY_KINDS.DUE,
          value: task.dueAt,
          precision: task.dueAtPrecision,
        }));
      }

      if (task.followUpAt && task.status !== TASK_STATUS.COMPLETED) {
        entries.push(new CalendarTaskEntry({
          task,
          kind: CALENDAR_ENTRY_KINDS.FOLLOW_UP,
          value: task.followUpAt,
          precision: task.followUpAtPrecision,
        }));
      }

      if (task.completedAt) {
        entries.push(new CalendarTaskEntry({
          task,
          kind: CALENDAR_ENTRY_KINDS.COMPLETED,
          value: task.completedAt,
          precision: TASK_DATE_PRECISION.DATETIME,
        }));
      }

      return entries.filter(entry => entry.dateKey);
    });
  }

  groupEntriesByDate(entries = []) {
    return entries.reduce((result, entry) => {
      const currentEntries = result.get(entry.dateKey) ?? [];
      currentEntries.push(entry);
      result.set(entry.dateKey, currentEntries);
      return result;
    }, new Map());
  }

  buildMonthStats(tasks, days, monthStart, monthEnd) {
    const monthCells = days.filter(day => day.isCurrentMonth);
    const busiestDay = monthCells
      .slice()
      .sort((left, right) => right.visibleCount - left.visibleCount || right.loadMinutes - left.loadMinutes)[0];
    const monthTasks = monthCells.flatMap(day => day.visibleTasks);
    const uniqueMonthTasks = uniqueTasks(monthTasks.map(task => ({ task })));
    const completedThisMonth = tasks.filter(task => {
      const completedAt = parseDate(task.completedAt);
      return completedAt && completedAt >= monthStart && completedAt <= monthEnd;
    }).length;
    const followUpsThisMonth = tasks.filter(task => {
      const followUpAt = parseDate(task.followUpAt);
      return followUpAt && followUpAt >= monthStart && followUpAt <= monthEnd && task.status !== TASK_STATUS.COMPLETED;
    }).length;
    const noDateCount = tasks.filter(task =>
      task.status !== TASK_STATUS.COMPLETED
      && !task.dueAt
      && !task.followUpAt,
    ).length;

    return {
      scheduled: uniqueMonthTasks.length,
      completed: completedThisMonth,
      followUps: followUpsThisMonth,
      withoutDate: noDateCount,
      busiestDay: busiestDay?.visibleCount
        ? {
          label: new Intl.DateTimeFormat(this.locale, {
            day: 'numeric',
            month: 'short',
          }).format(busiestDay.date),
          count: busiestDay.visibleCount,
        }
        : null,
    };
  }

  buildUpcomingDays(days = [], referenceDate = new Date(), mode = CALENDAR_VIEW_MODES.ALL) {
    const referenceKey = toDateKey(referenceDate);
    const lastUpcomingKey = toDateKey(addDays(referenceDate, 7));
    return days
      .filter(day =>
        day.dateKey >= referenceKey
        && day.dateKey <= lastUpcomingKey
        && day.visibleCount > 0,
      )
      .slice(0, 5)
      .map(day => ({
        date: day.date,
        dateKey: day.dateKey,
        count: day.visibleCount,
        loadMinutes: day.loadMinutes,
        title: day.previewTitle,
        counts: day.counts,
        mode,
      }));
  }
}

export function buildCalendarDraftForDate(value) {
  const nextDate = endOfDay(value);
  return {
    dueAt: nextDate.toISOString(),
    dueAtPrecision: TASK_DATE_PRECISION.DATE,
  };
}
