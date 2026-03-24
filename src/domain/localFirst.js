import { AvatarPreferences, AVATAR_TIMINGS } from './avatar';
import { TaskFactory } from './tasks';

export const DEFAULT_PREFERENCES = Object.freeze({
  notificationsEnabled: false,
  reminderPermission: 'default',
  avatar: new AvatarPreferences({
    enabled: true,
    timing: AVATAR_TIMINGS.BEFORE_10,
    importantOnly: false,
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
      avatar,
    };
  }

  serializePreferences(preferences = {}) {
    return {
      notificationsEnabled: Boolean(preferences.notificationsEnabled),
      reminderPermission: preferences.reminderPermission ?? DEFAULT_PREFERENCES.reminderPermission,
      avatar: new AvatarPreferences(preferences.avatar),
    };
  }
}
