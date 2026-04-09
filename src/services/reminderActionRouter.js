import { REMINDER_ACTION_IDS } from './reminders';

export class ReminderActionContext {
  constructor({
    actionId = REMINDER_ACTION_IDS.OPEN,
    taskId = '',
    preferredView = '',
    lane = '',
    reminderKind = '',
  } = {}) {
    this.actionId = `${actionId ?? ''}`.trim() || REMINDER_ACTION_IDS.OPEN;
    this.taskId = `${taskId ?? ''}`.trim();
    this.preferredView = `${preferredView ?? ''}`.trim();
    this.lane = `${lane ?? ''}`.trim();
    this.reminderKind = `${reminderKind ?? ''}`.trim();
  }
}

export class ReminderActionRouter {
  constructor({
    onComplete,
    onSnooze,
    onMoveTomorrow,
    onOpenTask,
    onOpenView,
  } = {}) {
    this.onComplete = onComplete ?? (() => {});
    this.onSnooze = onSnooze ?? (() => {});
    this.onMoveTomorrow = onMoveTomorrow ?? (() => {});
    this.onOpenTask = onOpenTask ?? (() => {});
    this.onOpenView = onOpenView ?? (() => {});
  }

  route(rawContext = {}) {
    const context = rawContext instanceof ReminderActionContext
      ? rawContext
      : new ReminderActionContext(rawContext);

    if (context.actionId === REMINDER_ACTION_IDS.COMPLETE && context.taskId) {
      this.onComplete(context);
      return;
    }

    if (context.actionId === REMINDER_ACTION_IDS.SNOOZE_10 && context.taskId) {
      this.onSnooze(context);
      return;
    }

    if (context.actionId === REMINDER_ACTION_IDS.MOVE_TOMORROW && context.taskId) {
      this.onMoveTomorrow(context);
      return;
    }

    if (context.taskId) {
      this.onOpenTask(context);
      return;
    }

    if (context.preferredView) {
      this.onOpenView(context);
    }
  }
}
