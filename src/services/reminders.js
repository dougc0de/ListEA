const reminderTimeouts = new Map();

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

async function isNativeNotificationsAvailable() {
  try {
    const { Capacitor } = await getCapacitorModules();
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function getNativeNotificationsPlugin() {
  if (!await isNativeNotificationsAvailable()) {
    return null;
  }

  const { LocalNotifications } = await getCapacitorModules();
  return LocalNotifications;
}

function buildReminderPayload(todo) {
  return {
    title: 'Es momento de esta tarea',
    body: todo.title?.trim() || 'Tienes una tarea pendiente en ListEA',
  };
}

export async function getReminderPermission() {
  const nativeNotifications = await getNativeNotificationsPlugin();
  if (nativeNotifications) {
    const permission = await nativeNotifications.checkPermissions();
    return permission.display;
  }

  if (typeof Notification === 'undefined') {
    return 'unsupported';
  }

  return Notification.permission;
}

export async function getExactAlarmPermission() {
  const nativeNotifications = await getNativeNotificationsPlugin();
  if (!nativeNotifications?.checkExactNotificationSetting) {
    return 'granted';
  }

  try {
    const permission = await nativeNotifications.checkExactNotificationSetting();
    return permission.exact_alarm;
  } catch {
    return 'prompt';
  }
}

export async function enableReminders() {
  const nativeNotifications = await getNativeNotificationsPlugin();
  if (nativeNotifications) {
    const permission = await nativeNotifications.requestPermissions();
    return permission.display;
  }

  if (typeof Notification === 'undefined') {
    return 'unsupported';
  }

  return Notification.requestPermission();
}

export async function enableExactReminders() {
  const nativeNotifications = await getNativeNotificationsPlugin();
  if (!nativeNotifications?.changeExactNotificationSetting) {
    return 'granted';
  }

  try {
    const permission = await nativeNotifications.changeExactNotificationSetting();
    return permission.exact_alarm;
  } catch {
    return 'prompt';
  }
}

export async function cancelReminder(id) {
  const timeoutId = reminderTimeouts.get(id);
  if (timeoutId) {
    clearTimeout(timeoutId);
    reminderTimeouts.delete(id);
  }

  const nativeNotifications = await getNativeNotificationsPlugin();
  if (nativeNotifications) {
    await nativeNotifications.cancel({
      notifications: [{ id: toNativeNotificationId(id) }],
    });
  }
}

export async function clearAllReminderTimers() {
  reminderTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
  reminderTimeouts.clear();
}

async function scheduleNativeReminder(todo) {
  const nativeNotifications = await getNativeNotificationsPlugin();
  if (!nativeNotifications) return;
  const notificationCopy = buildReminderPayload(todo);

  await nativeNotifications.cancel({
    notifications: [{ id: toNativeNotificationId(todo.id) }],
  });

  await nativeNotifications.schedule({
    notifications: [
      {
        id: toNativeNotificationId(todo.id),
        title: notificationCopy.title,
        body: notificationCopy.body,
        schedule: {
          at: new Date(todo.reminderAt),
          allowWhileIdle: true,
        },
        sound: undefined,
      },
    ],
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

  if (await isNativeNotificationsAvailable()) {
    await scheduleNativeReminder(todo);
    return;
  }

  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return;
  }

  scheduleWebReminder(todo, onTrigger);
}
