import { AvatarPreferences, AVATAR_SNIPPET_DURATIONS, AVATAR_TIMINGS } from './avatar';
import { TaskFactory } from './tasks';

export const DEFAULT_PREFERENCES = Object.freeze({
  notificationsEnabled: false,
  reminderPermission: 'default',
  exactAlarmPermission: 'prompt',
  avatar: new AvatarPreferences({
    enabled: true,
    reminderTiming: AVATAR_TIMINGS.BEFORE_10,
    importantOnly: false,
    snippetEnabled: true,
    snippetTiming: AVATAR_TIMINGS.ON_TIME,
    snippetDuration: AVATAR_SNIPPET_DURATIONS.MEDIUM,
  }),
});

export class LocalTaskRepository {
  constructor({
    storage,
    key = 'listea-local-state-v4',
    factory = new TaskFactory(),
  } = {}) {
    this.storage = storage;
    this.key = key;
    this.factory = factory;
  }

  load() {
    const raw = this.storage?.getItem?.(this.key);
    if (!raw) {
      return this.createBootstrapState();
    }

    try {
      const parsed = JSON.parse(raw);
      const tasks = Array.isArray(parsed.tasks)
        ? parsed.tasks.map((task, index) => this.factory.rehydrate(task, index)).filter(task => task.title)
        : [];

      return {
        tasks: tasks.length ? tasks : this.factory.createDemoTasks(),
        preferences: this.normalizePreferences(parsed.preferences),
      };
    } catch {
      return this.createBootstrapState();
    }
  }

  save({ tasks, preferences }) {
    this.storage?.setItem?.(this.key, JSON.stringify({
      tasks: tasks.map(task => task.toJSON()),
      preferences: this.serializePreferences(preferences),
    }));
  }

  createBootstrapState() {
    return {
      tasks: this.factory.createDemoTasks(),
      preferences: this.normalizePreferences(),
    };
  }

  normalizePreferences(rawPreferences = {}) {
    const avatar = new AvatarPreferences(rawPreferences.avatar);

    return {
      notificationsEnabled: Boolean(rawPreferences.notificationsEnabled),
      reminderPermission: rawPreferences.reminderPermission ?? DEFAULT_PREFERENCES.reminderPermission,
      exactAlarmPermission: rawPreferences.exactAlarmPermission ?? DEFAULT_PREFERENCES.exactAlarmPermission,
      avatar,
    };
  }

  serializePreferences(preferences = {}) {
    return {
      notificationsEnabled: Boolean(preferences.notificationsEnabled),
      reminderPermission: preferences.reminderPermission ?? DEFAULT_PREFERENCES.reminderPermission,
      exactAlarmPermission: preferences.exactAlarmPermission ?? DEFAULT_PREFERENCES.exactAlarmPermission,
      avatar: new AvatarPreferences(preferences.avatar),
    };
  }
}
