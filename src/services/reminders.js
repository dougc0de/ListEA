import { AndroidMobileNotifications } from './mobileNotificationsAndroid';
import { AppleMobileNotifications } from './mobileNotificationsApple';

const reminderTimeouts = new Map();
const nativeGatewayCatalog = [AndroidMobileNotifications, AppleMobileNotifications];

let capacitorModulesPromise;

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
  return {
    title: 'Es momento de esta tarea',
    body: todo.title?.trim() || 'Tienes una tarea pendiente en ListEA',
  };
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
  const nativeEnvironment = await getNativeEnvironment();
  if (!nativeEnvironment) return;

  const notificationCopy = buildReminderPayload(todo);
  await nativeEnvironment.gateway.schedule({
    id: toNativeNotificationId(todo.id),
    title: notificationCopy.title,
    body: notificationCopy.body,
    at: new Date(todo.reminderAt),
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
  const dueAt = new Date(todo.reminderAt).getTime();
  const now = Date.now();

  if (Number.isNaN(dueAt)) return;

  if (dueAt <= now) {
    triggerWebNotification(todo);
    onTrigger(todo.id);
    return;
  }

  const delay = Math.min(dueAt - now, 2147483647);
  const timeoutId = window.setTimeout(() => {
    triggerWebNotification(todo);
    reminderTimeouts.delete(todo.id);
    onTrigger(todo.id);
  }, delay);

  reminderTimeouts.set(todo.id, timeoutId);
}

export async function scheduleReminder(todo, onTrigger) {
  if (!todo.reminderAt) return;

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
