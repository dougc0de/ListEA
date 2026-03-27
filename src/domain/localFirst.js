import { TaskActivityLedger } from './activity';
import { AvatarPreferences, AVATAR_SNIPPET_DURATIONS, AVATAR_TIMINGS } from './avatar';
import { TaskFactory } from './tasks';

export const DEFAULT_PREFERENCES = Object.freeze({
  premiumEnabled: false,
  notificationsEnabled: false,
  reminderPermission: 'default',
  exactAlarmPermission: 'prompt',
  themeMode: 'light',
  colorPalette: 'ocean',
  avatar: new AvatarPreferences({
    enabled: false,
    reminderTiming: AVATAR_TIMINGS.BEFORE_10,
    importantOnly: false,
    snippetEnabled: false,
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
      const hasPersistedTasks = Array.isArray(parsed.tasks);
      const tasks = Array.isArray(parsed.tasks)
        ? parsed.tasks.map((task, index) => this.factory.rehydrate(task, index)).filter(task => task.title)
        : [];

      return {
        tasks: hasPersistedTasks ? tasks : this.factory.createDemoTasks(),
        analytics: this.normalizeAnalytics(parsed.analytics),
        preferences: this.normalizePreferences(parsed.preferences),
      };
    } catch {
      return this.createBootstrapState();
    }
  }

  save({ tasks, analytics, preferences }) {
    this.storage?.setItem?.(this.key, JSON.stringify({
      tasks: tasks.map(task => task.toJSON()),
      analytics: this.serializeAnalytics(analytics),
      preferences: this.serializePreferences(preferences),
    }));
  }

  createBootstrapState() {
    return {
      tasks: this.factory.createDemoTasks(),
      analytics: this.normalizeAnalytics(),
      preferences: this.normalizePreferences(),
    };
  }

  normalizeAnalytics(rawAnalytics = []) {
    if (rawAnalytics instanceof TaskActivityLedger) {
      return rawAnalytics;
    }

    if (rawAnalytics && Array.isArray(rawAnalytics.events)) {
      return new TaskActivityLedger(rawAnalytics.events);
    }

    return new TaskActivityLedger(rawAnalytics);
  }

  normalizePreferences(rawPreferences = {}) {
    const avatar = new AvatarPreferences(rawPreferences.avatar);

    return {
      premiumEnabled: Boolean(rawPreferences.premiumEnabled),
      notificationsEnabled: Boolean(rawPreferences.notificationsEnabled),
      reminderPermission: rawPreferences.reminderPermission ?? DEFAULT_PREFERENCES.reminderPermission,
      exactAlarmPermission: rawPreferences.exactAlarmPermission ?? DEFAULT_PREFERENCES.exactAlarmPermission,
      themeMode: rawPreferences.themeMode ?? DEFAULT_PREFERENCES.themeMode,
      colorPalette: rawPreferences.colorPalette ?? DEFAULT_PREFERENCES.colorPalette,
      avatar,
    };
  }

  serializePreferences(preferences = {}) {
    return {
      premiumEnabled: Boolean(preferences.premiumEnabled),
      notificationsEnabled: Boolean(preferences.notificationsEnabled),
      reminderPermission: preferences.reminderPermission ?? DEFAULT_PREFERENCES.reminderPermission,
      exactAlarmPermission: preferences.exactAlarmPermission ?? DEFAULT_PREFERENCES.exactAlarmPermission,
      themeMode: preferences.themeMode ?? DEFAULT_PREFERENCES.themeMode,
      colorPalette: preferences.colorPalette ?? DEFAULT_PREFERENCES.colorPalette,
      avatar: new AvatarPreferences(preferences.avatar),
    };
  }

  serializeAnalytics(analytics = new TaskActivityLedger()) {
    return this.normalizeAnalytics(analytics).toJSON();
  }
}
