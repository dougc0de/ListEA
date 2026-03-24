export const AVATAR_TIMINGS = Object.freeze({
  NEVER: 'never',
  BEFORE_10: 'before-10',
  BEFORE_5: 'before-5',
  ON_TIME: 'on-time',
  AFTER_10: 'after-10',
});

const TIMING_OFFSETS = {
  [AVATAR_TIMINGS.NEVER]: null,
  [AVATAR_TIMINGS.BEFORE_10]: -10,
  [AVATAR_TIMINGS.BEFORE_5]: -5,
  [AVATAR_TIMINGS.ON_TIME]: 0,
  [AVATAR_TIMINGS.AFTER_10]: 10,
};

export class AvatarPreferences {
  constructor({
    enabled = true,
    timing = AVATAR_TIMINGS.BEFORE_10,
    importantOnly = false,
  } = {}) {
    this.enabled = Boolean(enabled);
    this.timing = Object.values(AVATAR_TIMINGS).includes(timing) ? timing : AVATAR_TIMINGS.BEFORE_10;
    this.importantOnly = Boolean(importantOnly);
  }

  getOffsetMinutes() {
    return TIMING_OFFSETS[this.timing];
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
    if (!preferences.enabled || preferences.timing === AVATAR_TIMINGS.NEVER || !task.dueAt) {
      return '';
    }

    if (preferences.importantOnly && task.priority !== 'high' && task.impact !== 'high') {
      return '';
    }

    const offsetMinutes = preferences.getOffsetMinutes();
    if (offsetMinutes === null) {
      return '';
    }

    const reminderDate = new Date(task.dueAt);
    reminderDate.setMinutes(reminderDate.getMinutes() + offsetMinutes);
    return reminderDate.toISOString();
  }
}
