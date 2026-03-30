export const AVATAR_TIMINGS = Object.freeze({
  NEVER: 'never',
  BEFORE_10: 'before-10',
  BEFORE_5: 'before-5',
  ON_TIME: 'on-time',
  AFTER_10: 'after-10',
});

export const AVATAR_SNIPPET_DURATIONS = Object.freeze({
  SHORT: 'short',
  MEDIUM: 'medium',
  LONG: 'long',
  STICKY: 'sticky',
});

const TIMING_OFFSETS = {
  [AVATAR_TIMINGS.NEVER]: null,
  [AVATAR_TIMINGS.BEFORE_10]: -10,
  [AVATAR_TIMINGS.BEFORE_5]: -5,
  [AVATAR_TIMINGS.ON_TIME]: 0,
  [AVATAR_TIMINGS.AFTER_10]: 10,
};

const SNIPPET_DURATION_MS = {
  [AVATAR_SNIPPET_DURATIONS.SHORT]: 6000,
  [AVATAR_SNIPPET_DURATIONS.MEDIUM]: 10000,
  [AVATAR_SNIPPET_DURATIONS.LONG]: 16000,
  [AVATAR_SNIPPET_DURATIONS.STICKY]: null,
};

function getTaskScheduleAnchor(task) {
  return task?.dueAt || task?.followUpAt || '';
}

export class AvatarPreferences {
  constructor(rawPreferences = {}) {
    const {
      enabled = true,
      timing,
      reminderTiming,
      importantOnly = false,
      snippetEnabled = true,
      snippetTiming,
      snippetDuration = AVATAR_SNIPPET_DURATIONS.MEDIUM,
    } = rawPreferences;
    const hasLegacyTiming = Object.prototype.hasOwnProperty.call(rawPreferences, 'timing');
    const fallbackTiming = this.normalizeTiming(hasLegacyTiming ? timing : AVATAR_TIMINGS.BEFORE_10);

    this.enabled = Boolean(enabled);
    this.reminderTiming = this.normalizeTiming(reminderTiming, fallbackTiming);
    this.timing = this.reminderTiming;
    this.importantOnly = Boolean(importantOnly);
    this.snippetEnabled = Boolean(snippetEnabled);
    this.snippetTiming = this.normalizeTiming(
      snippetTiming,
      hasLegacyTiming ? fallbackTiming : AVATAR_TIMINGS.ON_TIME,
    );
    this.snippetDuration = this.normalizeSnippetDuration(snippetDuration);
  }

  normalizeTiming(value, fallback = AVATAR_TIMINGS.BEFORE_10) {
    return Object.values(AVATAR_TIMINGS).includes(value) ? value : fallback;
  }

  normalizeSnippetDuration(value) {
    return Object.values(AVATAR_SNIPPET_DURATIONS).includes(value)
      ? value
      : AVATAR_SNIPPET_DURATIONS.MEDIUM;
  }

  getOffsetMinutes() {
    return this.getReminderOffsetMinutes();
  }

  getReminderOffsetMinutes() {
    return TIMING_OFFSETS[this.reminderTiming];
  }

  getSnippetOffsetMinutes() {
    return TIMING_OFFSETS[this.snippetTiming];
  }

  getSnippetDurationMs() {
    return SNIPPET_DURATION_MS[this.snippetDuration];
  }

  toJSON() {
    return {
      enabled: this.enabled,
      reminderTiming: this.reminderTiming,
      importantOnly: this.importantOnly,
      snippetEnabled: this.snippetEnabled,
      snippetTiming: this.snippetTiming,
      snippetDuration: this.snippetDuration,
    };
  }
}

export class AvatarCoach {
  buildSnapshot({ tasks, insights = [], preferences = new AvatarPreferences(), referenceDate = new Date() }) {
    if (!preferences.enabled) {
      return {
        visible: false,
        title: '',
        message: '',
        tone: 'calm',
      };
    }

    const activeTasks = tasks.filter(task => task.status !== 'completed');
    const overdueTask = activeTasks.find(task => task.dueAt && new Date(task.dueAt) < referenceDate);
    if (overdueTask) {
      return {
        visible: true,
        title: 'Toca rescatar una vencida',
        message: `${overdueTask.title} sigue pendiente. Podemos reagendarla o dividirla en pasos pequenos.`,
        tone: 'focus',
      };
    }

    const dueSoonTask = activeTasks.find(task => {
      if (!task.dueAt) return false;
      const dueMs = new Date(task.dueAt).getTime();
      const distance = dueMs - referenceDate.getTime();
      return distance >= 0 && distance <= 60 * 60 * 1000;
    });
    if (dueSoonTask) {
      return {
        visible: true,
        title: 'Hay una tarea por empezar',
        message: `${dueSoonTask.title} cae dentro de la siguiente hora. Vale la pena preparar el primer paso.`,
        tone: 'nudge',
      };
    }

    const taskMissingSteps = activeTasks.find(task => !task.hasSubtasks() && (task.priority === 'high' || task.impact === 'high'));
    if (taskMissingSteps) {
      return {
        visible: true,
        title: 'Una importante necesita contexto',
        message: `${taskMissingSteps.title} ganaria claridad si la dividimos en subtareas.`,
        tone: 'coach',
      };
    }

    if (insights.length) {
      return {
        visible: true,
        title: insights[0].title,
        message: insights[0].message,
        tone: 'summary',
      };
    }

    return {
      visible: true,
      title: 'Tu dia esta bajo control',
      message: 'ListEA encontro suficiente contexto. Puedes avanzar sin reorganizar todo otra vez.',
      tone: 'celebrate',
    };
  }

  getReminderAt(task, preferences = new AvatarPreferences()) {
    if (!this.isTaskSchedulable(task, preferences)) {
      return '';
    }

    const offsetMinutes = preferences.getReminderOffsetMinutes();
    if (offsetMinutes === null) {
      return '';
    }

    return this.applyOffset(getTaskScheduleAnchor(task), offsetMinutes);
  }

  getSnippetAt(task, preferences = new AvatarPreferences()) {
    if (!this.isTaskSchedulable(task, preferences) || !preferences.snippetEnabled) {
      return '';
    }

    const offsetMinutes = preferences.getSnippetOffsetMinutes();
    if (offsetMinutes === null) {
      return '';
    }

    return this.applyOffset(getTaskScheduleAnchor(task), offsetMinutes);
  }

  buildTaskSnippet(task, preferences = new AvatarPreferences(), referenceDate = new Date()) {
    if (!task) {
      return {
        visible: false,
        taskId: '',
        title: '',
        message: '',
        scheduledAt: '',
        tone: 'nudge',
      };
    }

    return {
      visible: true,
      taskId: task.id,
      title: 'Es momento de esta tarea',
      message: task.title,
      scheduledAt: this.getSnippetAt(task, preferences),
      tone: this.getSnippetTone(task, referenceDate),
    };
  }

  getDueSnippetTask(tasks, preferences = new AvatarPreferences(), referenceDate = new Date()) {
    return this.getSnippetQueue(tasks, preferences).find(
      candidate => !candidate.task.avatarSnippetShownAt && candidate.scheduledTime <= referenceDate.getTime(),
    )?.task ?? null;
  }

  getNextSnippetTask(tasks, preferences = new AvatarPreferences(), referenceDate = new Date()) {
    return this.getSnippetQueue(tasks, preferences).find(
      candidate => !candidate.task.avatarSnippetShownAt && candidate.scheduledTime > referenceDate.getTime(),
    ) ?? null;
  }

  getSnippetQueue(tasks, preferences = new AvatarPreferences()) {
    return tasks
      .filter(task => this.isTaskSchedulable(task, preferences))
      .map(task => ({
        task,
        scheduledAt: this.getSnippetAt(task, preferences),
      }))
      .filter(candidate => candidate.scheduledAt)
      .map(candidate => ({
        ...candidate,
        scheduledTime: new Date(candidate.scheduledAt).getTime(),
      }))
      .filter(candidate => !Number.isNaN(candidate.scheduledTime))
      .sort((left, right) => left.scheduledTime - right.scheduledTime);
  }

  isTaskSchedulable(task, preferences = new AvatarPreferences()) {
    if (!preferences.enabled || !getTaskScheduleAnchor(task) || task.status === 'completed') {
      return false;
    }

    if (preferences.importantOnly && task.priority !== 'high' && task.impact !== 'high') {
      return false;
    }

    return true;
  }

  applyOffset(dueAt, offsetMinutes) {
    const scheduledDate = new Date(dueAt);
    scheduledDate.setMinutes(scheduledDate.getMinutes() + offsetMinutes);
    return scheduledDate.toISOString();
  }

  getSnippetTone(task, referenceDate = new Date()) {
    const anchor = getTaskScheduleAnchor(task);
    if (!anchor) {
      return 'coach';
    }

    return new Date(anchor).getTime() < referenceDate.getTime() ? 'focus' : 'nudge';
  }
}
