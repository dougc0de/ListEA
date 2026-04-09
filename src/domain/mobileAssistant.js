import { TaskActivityDashboard, DASHBOARD_GRANULARITY } from './activity';
import { AvatarCoach, AvatarPreferences, AVATAR_TIMINGS } from './avatar';
import { ProfessionalControlCenter } from './controlCenter';
import { ENTITLEMENT_KEYS } from './license';
import {
  ReminderPersonalityCopywriter,
  REMINDER_PERSONALITIES,
} from './operability';
import { TASK_DATE_PRECISION, TASK_STATUS } from './tasks';

export const REMINDER_LANES = Object.freeze({
  BASIC: 'basic',
  PREP: 'advanced-prep',
  RISK: 'advanced-risk',
  BRIEFING: 'briefing',
});

export const WEEKDAY_OPTIONS = Object.freeze([
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miercoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sabado' },
  { value: 0, label: 'Domingo' },
]);

const DEFAULT_PRE_REMINDER_OFFSET = 15;
const DEFAULT_QUIET_HOURS_START = '22:00';
const DEFAULT_QUIET_HOURS_END = '07:00';
const DEFAULT_WEEKLY_BRIEF_DAY = 1;
const DEFAULT_WEEKLY_BRIEF_TIME = '08:00';
const BRIEF_HISTORY_LIMIT = 8;
const DEFAULT_REMINDER_PERSONALITY = REMINDER_PERSONALITIES.PROFESSIONAL;

function normalizeText(value) {
  return `${value ?? ''}`.trim();
}

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

function formatDateLabel(value, locale = 'es-MX') {
  const date = parseDate(value);
  if (!date) return 'Sin fecha';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatRangeDayLabel(value, locale = 'es-MX') {
  const date = parseDate(value);
  if (!date) return 'Sin fecha';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

function formatDateKey(value) {
  const date = parseDate(value) ?? new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeTimeValue(value, fallback) {
  const normalized = normalizeText(value);
  return /^\d{2}:\d{2}$/.test(normalized) ? normalized : fallback;
}

function normalizeDayValue(value, fallback) {
  const numeric = Number(value);
  return WEEKDAY_OPTIONS.some(option => option.value === numeric) ? numeric : fallback;
}

function normalizePreReminderOffset(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_PRE_REMINDER_OFFSET;
  }

  return Math.max(0, Math.min(60, Math.round(numeric)));
}

function normalizeReminderPersonality(value) {
  return Object.values(REMINDER_PERSONALITIES).includes(value)
    ? value
    : DEFAULT_REMINDER_PERSONALITY;
}

function normalizeBriefHistory(history = []) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter(item => item && typeof item === 'object' && normalizeText(item.weekKey))
    .slice(-BRIEF_HISTORY_LIMIT)
    .map(item => ({
      weekKey: normalizeText(item.weekKey),
      createdAt: normalizeText(item.createdAt),
      summary: {
        atRisk: Number(item.summary?.atRisk ?? 0),
        responses: Number(item.summary?.responses ?? 0),
        staleBlocked: Number(item.summary?.staleBlocked ?? 0),
        launches: Number(item.summary?.launches ?? 0),
        completionRate: Number(item.summary?.completionRate ?? 0),
      },
      highlights: Array.isArray(item.highlights)
        ? item.highlights.map(highlight => normalizeText(highlight)).filter(Boolean).slice(0, 4)
        : [],
    }));
}

function timeToMinutes(value, fallback = 0) {
  const [hours, minutes] = normalizeTimeValue(value, '').split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return fallback;
  }
  return (hours * 60) + minutes;
}

function isWithinQuietHours(date, preferences) {
  const minuteOfDay = (date.getHours() * 60) + date.getMinutes();
  const quietStart = timeToMinutes(preferences.quietHoursStart, 22 * 60);
  const quietEnd = timeToMinutes(preferences.quietHoursEnd, 7 * 60);

  if (quietStart === quietEnd) {
    return false;
  }

  if (quietStart < quietEnd) {
    return minuteOfDay >= quietStart && minuteOfDay < quietEnd;
  }

  return minuteOfDay >= quietStart || minuteOfDay < quietEnd;
}

function moveToQuietEnd(date, preferences) {
  const nextDate = new Date(date);
  const [hours, minutes] = normalizeTimeValue(preferences.quietHoursEnd, DEFAULT_QUIET_HOURS_END)
    .split(':')
    .map(Number);

  nextDate.setHours(hours, minutes, 0, 0);
  if (nextDate <= date) {
    nextDate.setDate(nextDate.getDate() + 1);
  }

  return nextDate;
}

function applyQuietHours(date, preferences) {
  if (!isWithinQuietHours(date, preferences)) {
    return date;
  }

  return moveToQuietEnd(date, preferences);
}

function resolveAnchor(task) {
  return parseDate(task?.dueAt || task?.followUpAt || '');
}

function hasExplicitTime(task) {
  const precision = task?.dueAt
    ? task?.dueAtPrecision
    : task?.followUpAtPrecision;
  return precision === TASK_DATE_PRECISION.DATETIME;
}

function sortBySchedule(left, right) {
  return new Date(left.scheduledAt) - new Date(right.scheduledAt);
}

function formatReminderBody(task, lane, locale = 'es-MX') {
  const parts = [];
  if (task?.project) {
    parts.push(task.project);
  }

  const anchor = resolveAnchor(task);
  if (anchor) {
    if (lane === REMINDER_LANES.RISK) {
      parts.push('Sigue pendiente');
    } else if (task?.status === TASK_STATUS.WAITING || task?.status === TASK_STATUS.BLOCKED || task?.followUpAt) {
      parts.push(`Seguimiento ${formatDateLabel(anchor, locale)}`);
    } else {
      parts.push(`Programada ${formatDateLabel(anchor, locale)}`);
    }
  }

  return parts.join(' · ') || 'Toca actuar desde ListEA.';
}

export class MobileAssistantPreferences {
  constructor(rawPreferences = {}) {
    this.assistantEnabled = Boolean(rawPreferences.assistantEnabled ?? false);
    this.preReminderOffset = normalizePreReminderOffset(
      rawPreferences.preReminderOffset ?? DEFAULT_PRE_REMINDER_OFFSET,
    );
    this.quietHoursStart = normalizeTimeValue(
      rawPreferences.quietHoursStart,
      DEFAULT_QUIET_HOURS_START,
    );
    this.quietHoursEnd = normalizeTimeValue(
      rawPreferences.quietHoursEnd,
      DEFAULT_QUIET_HOURS_END,
    );
    this.weeklyBriefDay = normalizeDayValue(
      rawPreferences.weeklyBriefDay,
      DEFAULT_WEEKLY_BRIEF_DAY,
    );
    this.weeklyBriefTime = normalizeTimeValue(
      rawPreferences.weeklyBriefTime,
      DEFAULT_WEEKLY_BRIEF_TIME,
    );
    this.reminderPersonality = normalizeReminderPersonality(
      rawPreferences.reminderPersonality,
    );
    this.directOpenCompatibleApp = Boolean(rawPreferences.directOpenCompatibleApp ?? true);
    this.briefHistory = normalizeBriefHistory(rawPreferences.briefHistory);
  }

  withBriefHistory(history = []) {
    return new MobileAssistantPreferences({
      ...this.toJSON(),
      briefHistory: normalizeBriefHistory(history),
    });
  }

  toJSON() {
    return {
      assistantEnabled: this.assistantEnabled,
      preReminderOffset: this.preReminderOffset,
      quietHoursStart: this.quietHoursStart,
      quietHoursEnd: this.quietHoursEnd,
      weeklyBriefDay: this.weeklyBriefDay,
      weeklyBriefTime: this.weeklyBriefTime,
      reminderPersonality: this.reminderPersonality,
      directOpenCompatibleApp: this.directOpenCompatibleApp,
      briefHistory: this.briefHistory,
    };
  }
}

export class ReminderPlan {
  constructor({
    id = '',
    lane = REMINDER_LANES.BASIC,
    taskId = '',
    scheduledAt = '',
    title = '',
    body = '',
    largeBody = '',
    summaryText = '',
    extra = {},
  } = {}) {
    this.id = normalizeText(id);
    this.lane = normalizeText(lane) || REMINDER_LANES.BASIC;
    this.taskId = normalizeText(taskId);
    this.scheduledAt = parseDate(scheduledAt)?.toISOString() || '';
    this.title = normalizeText(title);
    this.body = normalizeText(body);
    this.largeBody = normalizeText(largeBody);
    this.summaryText = normalizeText(summaryText);
    this.extra = extra && typeof extra === 'object' ? extra : {};
  }

  isSchedulable(referenceDate = new Date()) {
    const scheduledAt = parseDate(this.scheduledAt);
    return Boolean(this.id && scheduledAt && scheduledAt > referenceDate);
  }

  toJSON() {
    return {
      id: this.id,
      lane: this.lane,
      taskId: this.taskId,
      scheduledAt: this.scheduledAt,
      title: this.title,
      body: this.body,
      largeBody: this.largeBody,
      summaryText: this.summaryText,
      extra: this.extra,
    };
  }
}

export class ReminderPolicyEngine {
  constructor({
    avatarCoach = new AvatarCoach(),
    copywriter = new ReminderPersonalityCopywriter(),
    locale = 'es-MX',
  } = {}) {
    this.avatarCoach = avatarCoach;
    this.copywriter = copywriter;
    this.locale = locale;
  }

  buildKnownReminderIds(tasks = []) {
    const ids = new Set(['weekly-brief']);
    tasks.forEach(task => {
      if (!task?.id) return;
      ids.add(task.id);
      ids.add(`${task.id}:${REMINDER_LANES.BASIC}`);
      ids.add(`${task.id}:${REMINDER_LANES.PREP}`);
      ids.add(`${task.id}:${REMINDER_LANES.RISK}`);
    });
    return Array.from(ids);
  }

  buildTaskPlans(tasks = [], {
    referenceDate = new Date(),
    avatarPreferences = new AvatarPreferences(),
    assistantPreferences = new MobileAssistantPreferences(),
    entitlements = {},
  } = {}) {
    const plans = [];
    const advancedEnabled = Boolean(
      entitlements?.[ENTITLEMENT_KEYS.ADVANCED_REMINDERS]
      && entitlements?.[ENTITLEMENT_KEYS.MOBILE_ASSISTANT]
      && assistantPreferences.assistantEnabled,
    );

    tasks.forEach(task => {
      if (!task || task.status === TASK_STATUS.COMPLETED) {
        return;
      }

      const basicPlan = this.buildBasicPlan(task, avatarPreferences, assistantPreferences, referenceDate);
      if (basicPlan) {
        plans.push(basicPlan);
      }

      if (!advancedEnabled) {
        return;
      }

      const prepPlan = this.buildPreReminderPlan(task, assistantPreferences, avatarPreferences, referenceDate);
      if (prepPlan) {
        plans.push(prepPlan);
      }

      const riskPlan = this.buildRiskReminderPlan(task, assistantPreferences, referenceDate);
      if (riskPlan) {
        plans.push(riskPlan);
      }
    });

    return plans.sort(sortBySchedule);
  }

  buildBasicPlan(task, avatarPreferences, assistantPreferences, referenceDate) {
    const reminderAt = this.avatarCoach.getReminderAt(task, avatarPreferences);
    const scheduledAt = parseDate(reminderAt);
    if (!scheduledAt || scheduledAt <= referenceDate) {
      return null;
    }

    const copy = this.copywriter.buildTaskReminder(
      task,
      REMINDER_LANES.BASIC,
      assistantPreferences.reminderPersonality,
    );

    return new ReminderPlan({
      id: `${task.id}:${REMINDER_LANES.BASIC}`,
      lane: REMINDER_LANES.BASIC,
      taskId: task.id,
      scheduledAt,
      title: copy.title,
      body: copy.body,
      largeBody: normalizeText(task?.notes) || copy.largeBody || formatReminderBody(task, REMINDER_LANES.BASIC, this.locale),
      summaryText: copy.summaryText,
      extra: {
        taskId: task.id,
        preferredView: task?.followUpAt || [TASK_STATUS.WAITING, TASK_STATUS.BLOCKED].includes(task?.status)
          ? 'follow-up'
          : 'today',
        lane: REMINDER_LANES.BASIC,
      },
    });
  }

  buildPreReminderPlan(task, assistantPreferences, avatarPreferences, referenceDate) {
    const anchor = resolveAnchor(task);
    if (!anchor || !hasExplicitTime(task) || assistantPreferences.preReminderOffset <= 0) {
      return null;
    }

    if (avatarPreferences.reminderTiming !== AVATAR_TIMINGS.ON_TIME) {
      return null;
    }

    const scheduledAt = new Date(anchor);
    scheduledAt.setMinutes(scheduledAt.getMinutes() - assistantPreferences.preReminderOffset);
    const quietSafeAt = applyQuietHours(scheduledAt, assistantPreferences);
    if (quietSafeAt <= referenceDate || quietSafeAt >= anchor) {
      return null;
    }

    const copy = this.copywriter.buildTaskReminder(
      task,
      REMINDER_LANES.PREP,
      assistantPreferences.reminderPersonality,
    );

    return new ReminderPlan({
      id: `${task.id}:${REMINDER_LANES.PREP}`,
      lane: REMINDER_LANES.PREP,
      taskId: task.id,
      scheduledAt: quietSafeAt,
      title: copy.title,
      body: copy.body,
      largeBody: normalizeText(task?.notes) || copy.largeBody || formatReminderBody(task, REMINDER_LANES.PREP, this.locale),
      summaryText: copy.summaryText,
      extra: {
        taskId: task.id,
        preferredView: task?.followUpAt ? 'follow-up' : 'today',
        lane: REMINDER_LANES.PREP,
      },
    });
  }

  buildRiskReminderPlan(task, assistantPreferences, referenceDate) {
    const anchor = resolveAnchor(task);
    if (!anchor || !hasExplicitTime(task)) {
      return null;
    }

    const isPriorityTask = task?.priority === 'high' || task?.impact === 'high';
    if (!isPriorityTask) {
      return null;
    }

    const scheduledAt = new Date(anchor);
    scheduledAt.setMinutes(scheduledAt.getMinutes() + 15);
    const quietSafeAt = applyQuietHours(scheduledAt, assistantPreferences);
    if (quietSafeAt <= referenceDate) {
      return null;
    }

    const copy = this.copywriter.buildTaskReminder(
      task,
      REMINDER_LANES.RISK,
      assistantPreferences.reminderPersonality,
    );

    return new ReminderPlan({
      id: `${task.id}:${REMINDER_LANES.RISK}`,
      lane: REMINDER_LANES.RISK,
      taskId: task.id,
      scheduledAt: quietSafeAt,
      title: copy.title,
      body: copy.body,
      largeBody: normalizeText(task?.notes) || copy.largeBody || formatReminderBody(task, REMINDER_LANES.RISK, this.locale),
      summaryText: copy.summaryText,
      extra: {
        taskId: task.id,
        preferredView: task?.followUpAt ? 'follow-up' : 'today',
        lane: REMINDER_LANES.RISK,
      },
    });
  }
}

export class OperationalReportService {
  constructor({
    dashboard = new TaskActivityDashboard(),
    controlCenter = new ProfessionalControlCenter(),
    locale = 'es-MX',
  } = {}) {
    this.dashboard = dashboard;
    this.controlCenter = controlCenter;
    this.locale = locale;
  }

  build(tasks = [], analytics = [], {
    referenceDate = new Date(),
    history = [],
  } = {}) {
    const weekStart = startOfWeek(referenceDate);
    const weekEnd = endOfWeek(referenceDate);
    const dashboard = this.dashboard.build(analytics, {
      tasks,
      referenceDate,
      granularity: DASHBOARD_GRANULARITY.DAY,
      startDate: weekStart,
      endDate: weekEnd,
    });
    const center = this.controlCenter.build(tasks, analytics, {
      referenceDate,
      rangeStart: weekStart.toISOString(),
      rangeEnd: weekEnd.toISOString(),
      completionRate: dashboard.summary.completionRate,
    });

    const weekKey = formatDateKey(weekStart);
    const previous = normalizeBriefHistory(history)
      .slice()
      .reverse()
      .find(item => item.weekKey !== weekKey);

    const highlights = [
      center.summary.atRisk
        ? `${center.summary.atRisk} compromiso${center.summary.atRisk === 1 ? '' : 's'} en riesgo.`
        : 'Sin compromisos en riesgo esta semana.',
      center.summary.responses
        ? `${center.summary.responses} respuesta${center.summary.responses === 1 ? '' : 's'} por enviar.`
        : 'No hay respuestas pendientes detectadas.',
      center.summary.staleBlocked
        ? `${center.summary.staleBlocked} bloqueo${center.summary.staleBlocked === 1 ? '' : 's'} viejo${center.summary.staleBlocked === 1 ? '' : 's'}.`
        : 'No hay bloqueos viejos enfriando el trabajo.',
      `Cumplimiento local: ${dashboard.summary.completionRate}%.`,
    ].slice(0, 4);

    return {
      id: `brief-${weekKey}`,
      weekKey,
      createdAt: new Date().toISOString(),
      range: {
        startDate: weekStart.toISOString(),
        endDate: weekEnd.toISOString(),
        label: `${formatRangeDayLabel(weekStart, this.locale)} - ${formatRangeDayLabel(weekEnd, this.locale)}`,
      },
      summary: {
        atRisk: center.summary.atRisk,
        responses: center.summary.responses,
        staleBlocked: center.summary.staleBlocked,
        launches: center.summary.launches,
        completionRate: dashboard.summary.completionRate,
      },
      highlights,
      pulse: center.pulse,
      topRisk: center.riskItems.slice(0, 3),
      topResponses: center.responseItems.slice(0, 3),
      topBlocked: center.blockedItems.slice(0, 3),
      topApps: center.appUsage.slice(0, 3),
      comparison: previous
        ? {
          atRiskDelta: center.summary.atRisk - previous.summary.atRisk,
          responsesDelta: center.summary.responses - previous.summary.responses,
          blockedDelta: center.summary.staleBlocked - previous.summary.staleBlocked,
          completionRateDelta: dashboard.summary.completionRate - previous.summary.completionRate,
        }
        : null,
    };
  }
}

export class AssistantBriefService {
  constructor({
    reportService = new OperationalReportService(),
    copywriter = new ReminderPersonalityCopywriter(),
    locale = 'es-MX',
  } = {}) {
    this.reportService = reportService;
    this.copywriter = copywriter;
    this.locale = locale;
  }

  buildWeeklyBrief(tasks = [], analytics = [], {
    referenceDate = new Date(),
    assistantPreferences = new MobileAssistantPreferences(),
    entitlements = {},
  } = {}) {
    const enabled = Boolean(
      entitlements?.[ENTITLEMENT_KEYS.WEEKLY_BRIEFING]
      && entitlements?.[ENTITLEMENT_KEYS.MOBILE_ASSISTANT]
      && assistantPreferences.assistantEnabled,
    );

    const report = this.reportService.build(tasks, analytics, {
      referenceDate,
      history: assistantPreferences.briefHistory,
    });

    if (!enabled) {
      return {
        report,
        plan: null,
      };
    }

    const nextRun = this.resolveNextBriefDate(referenceDate, assistantPreferences);
    const copy = this.copywriter.buildWeeklyBrief(
      report,
      assistantPreferences.reminderPersonality,
    );
    return {
      report,
      plan: new ReminderPlan({
        id: 'weekly-brief',
        lane: REMINDER_LANES.BRIEFING,
        scheduledAt: nextRun,
        title: copy.title,
        body: copy.body,
        largeBody: copy.largeBody,
        summaryText: copy.summaryText,
        extra: {
          preferredView: 'dashboard',
          lane: REMINDER_LANES.BRIEFING,
          briefingWeekKey: report.weekKey,
          reminderKind: 'weekly-brief',
        },
      }),
    };
  }

  resolveNextBriefDate(referenceDate, assistantPreferences) {
    const nextDate = new Date(referenceDate);
    const targetDay = assistantPreferences.weeklyBriefDay;
    const [hours, minutes] = assistantPreferences.weeklyBriefTime.split(':').map(Number);

    nextDate.setHours(hours, minutes, 0, 0);

    const currentDay = nextDate.getDay();
    let delta = targetDay - currentDay;
    if (delta < 0 || (delta === 0 && nextDate <= referenceDate)) {
      delta += 7;
    }

    nextDate.setDate(nextDate.getDate() + delta);
    if (nextDate <= referenceDate) {
      nextDate.setDate(nextDate.getDate() + 7);
    }

    return nextDate.toISOString();
  }
}
