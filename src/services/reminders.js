import { AndroidMobileNotifications } from './mobileNotificationsAndroid';
import { AppleMobileNotifications } from './mobileNotificationsApple';

const reminderTimeouts = new Map();
const nativeGatewayCatalog = [AndroidMobileNotifications, AppleMobileNotifications];

let capacitorModulesPromise;
let nativeReminderInteractionsPromise;
let reminderInteractionHandlers = {
  onNotificationReceived: null,
  onNotificationAction: null,
};

export const REMINDER_ACTION_IDS = Object.freeze({
  OPEN: 'tap',
  COMPLETE: 'complete-task',
  SNOOZE_10: 'snooze-10m',
  MOVE_TOMORROW: 'move-tomorrow',
  DISMISS: 'dismiss',
});

const REMINDER_ACTION_TYPE_ID = 'listea-reminder-actions';

function toNativeNotificationId(id) {
  const numericId = Number(id);
  if (Number.isNaN(numericId)) {
    return Math.abs(`${id}`.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0));
  }

  return Math.abs(numericId % 2147483647);
}

function getCapacitorModules() {
  if (!capacitorModulesPromise) {
    capacitorModulesPromise = Promise.all([
      import('@capacitor/core'),
      import('@capacitor/local-notifications'),
    ]).then(([core, notifications]) => ({
      Capacitor: core.Capacitor,
      LocalNotifications: notifications.LocalNotifications,
    }));
  }

  return capacitorModulesPromise;
}

async function getNativeEnvironment() {
  try {
    const { Capacitor, LocalNotifications } = await getCapacitorModules();
    if (!Capacitor.isNativePlatform()) {
      return null;
    }

    const platform = Capacitor.getPlatform();
    const GatewayClass = nativeGatewayCatalog.find(gateway => gateway.supports(platform));
    if (!GatewayClass) {
      return null;
    }

    return {
      platform,
      gateway: new GatewayClass(LocalNotifications),
    };
  } catch {
    return null;
  }
}

function buildReminderPayload(todo) {
  const explicitTaskId = `${todo.taskId ?? ''}`.trim();
  const explicitTitle = `${todo.title ?? ''}`.trim();
  const explicitBody = `${todo.body ?? ''}`.trim();
  const explicitLargeBody = `${todo.largeBody ?? ''}`.trim();
  const explicitSummaryText = `${todo.summaryText ?? ''}`.trim();
  const explicitExtra = todo.extra && typeof todo.extra === 'object' ? todo.extra : {};

  if (explicitTitle || explicitBody || explicitSummaryText) {
    return {
      title: explicitTitle || 'Recordatorio de ListEA',
      body: explicitBody || explicitTitle || 'Hay una accion pendiente en ListEA',
      largeBody: explicitLargeBody || explicitBody || explicitTitle || 'Hay una accion pendiente en ListEA',
      summaryText: explicitSummaryText || 'ListEA',
      extra: {
        taskId: explicitTaskId || `${todo.id ?? ''}`.trim(),
        preferredView: explicitExtra.preferredView ?? '',
        lane: explicitExtra.lane ?? todo.lane ?? 'basic',
        reminderKind: explicitExtra.reminderKind ?? '',
        ...explicitExtra,
      },
    };
  }

  const isFollowUpReminder = Boolean(todo.followUpAt && !todo.dueAt);
  const title = isFollowUpReminder ? 'Seguimiento pendiente' : 'Es momento de esta tarea';
  const body = todo.title?.trim() || 'Tienes una tarea pendiente en ListEA';
  const summaryLabel = todo.project?.trim() || (isFollowUpReminder ? 'Seguimiento profesional' : 'Tarea activa');

  return {
    title,
    body,
    largeBody: todo.notes?.trim() || body,
    summaryText: summaryLabel,
    extra: {
      taskId: todo.id,
      preferredView: isFollowUpReminder || ['waiting', 'blocked'].includes(todo.status)
        ? 'follow-up'
        : 'today',
    },
  };
}

async function ensureNativeReminderInteractions() {
  if (nativeReminderInteractionsPromise) {
    return nativeReminderInteractionsPromise;
  }

  nativeReminderInteractionsPromise = (async () => {
    const nativeEnvironment = await getNativeEnvironment();
    if (!nativeEnvironment) {
      return null;
    }

    await nativeEnvironment.gateway.plugin.registerActionTypes({
      types: [
        {
          id: REMINDER_ACTION_TYPE_ID,
          actions: [
            { id: REMINDER_ACTION_IDS.COMPLETE, title: 'Completar', foreground: true },
            { id: REMINDER_ACTION_IDS.SNOOZE_10, title: 'Posponer 10m', foreground: true },
            { id: REMINDER_ACTION_IDS.MOVE_TOMORROW, title: 'Manana', foreground: true },
          ],
        },
      ],
    });

    await nativeEnvironment.gateway.plugin.addListener('localNotificationReceived', notification => {
      reminderInteractionHandlers.onNotificationReceived?.(notification);
    });

    await nativeEnvironment.gateway.plugin.addListener('localNotificationActionPerformed', notificationAction => {
      reminderInteractionHandlers.onNotificationAction?.(notificationAction);
    });

    return nativeEnvironment;
  })();

  return nativeReminderInteractionsPromise;
}

export async function getReminderPermission() {
  const nativeEnvironment = await getNativeEnvironment();
  if (nativeEnvironment) {
    return nativeEnvironment.gateway.getPermission();
  }

  if (typeof Notification === 'undefined') {
    return 'unsupported';
  }

  return Notification.permission;
}

export async function isNativeReminderRuntime() {
  return Boolean(await getNativeEnvironment());
}

export async function getExactAlarmPermission() {
  const nativeEnvironment = await getNativeEnvironment();
  if (nativeEnvironment) {
    return nativeEnvironment.gateway.getExactAlarmPermission();
  }

  return 'granted';
}

export async function enableReminders() {
  const nativeEnvironment = await getNativeEnvironment();
  if (nativeEnvironment) {
    return nativeEnvironment.gateway.requestPermission();
  }

  if (typeof Notification === 'undefined') {
    return 'unsupported';
  }

  return Notification.requestPermission();
}

export async function enableExactReminders() {
  const nativeEnvironment = await getNativeEnvironment();
  if (nativeEnvironment) {
    return nativeEnvironment.gateway.requestExactAlarmPermission();
  }

  return 'granted';
}

export async function registerReminderInteractions(handlers = {}) {
  reminderInteractionHandlers = {
    onNotificationReceived: handlers.onNotificationReceived ?? null,
    onNotificationAction: handlers.onNotificationAction ?? null,
  };

  await ensureNativeReminderInteractions();
}

export function clearReminderInteractions() {
  reminderInteractionHandlers = {
    onNotificationReceived: null,
    onNotificationAction: null,
  };
}

export async function cancelReminder(id) {
  const timeoutId = reminderTimeouts.get(id);
  if (timeoutId) {
    clearTimeout(timeoutId);
    reminderTimeouts.delete(id);
  }

  const nativeEnvironment = await getNativeEnvironment();
  if (nativeEnvironment) {
    await nativeEnvironment.gateway.cancel(toNativeNotificationId(id));
  }
}

export async function clearAllReminderTimers() {
  reminderTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
  reminderTimeouts.clear();
}

async function scheduleNativeReminder(todo) {
  const nativeEnvironment = await ensureNativeReminderInteractions();
  if (!nativeEnvironment) return;

  const notificationCopy = buildReminderPayload(todo);
  const scheduledAt = todo.reminderAt || todo.scheduledAt;
  await nativeEnvironment.gateway.schedule({
    id: toNativeNotificationId(todo.id),
    title: notificationCopy.title,
    body: notificationCopy.body,
    largeBody: notificationCopy.largeBody,
    summaryText: notificationCopy.summaryText,
    actionTypeId: REMINDER_ACTION_TYPE_ID,
    extra: notificationCopy.extra,
    group: 'listea-reminders',
    threadIdentifier: 'listea-reminders',
    summaryArgument: notificationCopy.summaryText,
    at: new Date(scheduledAt),
  });
}

function triggerWebNotification(todo) {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    const notificationCopy = buildReminderPayload(todo);
    new Notification(notificationCopy.title, {
      body: notificationCopy.body,
      tag: `listea-${todo.id}`,
    });
  }
}

function scheduleWebReminder(todo, onTrigger) {
  const dueAt = new Date(todo.reminderAt || todo.scheduledAt).getTime();
  const now = Date.now();

  if (Number.isNaN(dueAt)) return;

  if (dueAt <= now) {
    triggerWebNotification(todo);
    onTrigger?.({
      id: todo.id,
      taskId: todo.taskId || todo.id,
      lane: todo.lane || todo.extra?.lane || 'basic',
    });
    return;
  }

  const delay = Math.min(dueAt - now, 2147483647);
  const timeoutId = window.setTimeout(() => {
    triggerWebNotification(todo);
    reminderTimeouts.delete(todo.id);
    onTrigger?.({
      id: todo.id,
      taskId: todo.taskId || todo.id,
      lane: todo.lane || todo.extra?.lane || 'basic',
    });
  }, delay);

  reminderTimeouts.set(todo.id, timeoutId);
}

export async function scheduleReminder(todo, onTrigger) {
  const scheduledAt = todo.reminderAt || todo.scheduledAt;
  if (!scheduledAt) return;

  const nativeEnvironment = await getNativeEnvironment();
  if (nativeEnvironment) {
    await scheduleNativeReminder(todo);
    return;
  }

  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return;
  }

  scheduleWebReminder(todo, onTrigger);
}
