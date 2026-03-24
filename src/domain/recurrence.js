import { TaskFactory, TASK_STATUS } from './tasks';

function addInterval(baseDate, preset, interval) {
  const nextDate = new Date(baseDate);

  switch (preset) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + interval);
      return nextDate;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7 * interval);
      return nextDate;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + interval);
      return nextDate;
    case 'yearly':
      nextDate.setFullYear(nextDate.getFullYear() + interval);
      return nextDate;
    case 'every-x-days':
      nextDate.setDate(nextDate.getDate() + interval);
      return nextDate;
    case 'weekdays':
      do {
        nextDate.setDate(nextDate.getDate() + 1);
      } while ([0, 6].includes(nextDate.getDay()));
      return nextDate;
    case 'weekends':
      do {
        nextDate.setDate(nextDate.getDate() + 1);
      } while (![0, 6].includes(nextDate.getDay()));
      return nextDate;
    default:
      return null;
  }
}

export class RecurrenceEngine {
  constructor(factory = new TaskFactory()) {
    this.factory = factory;
  }

  createNextOccurrence(task, completedAt = new Date().toISOString()) {
    if (!task.recurrence?.isEnabled?.()) {
      return null;
    }

    const anchor = task.recurrence.mode === 'after-completion'
      ? new Date(completedAt)
      : new Date(task.dueAt || completedAt);

    if (Number.isNaN(anchor.getTime())) {
      return null;
    }

    const nextDueAt = addInterval(anchor, task.recurrence.preset, task.recurrence.interval);
    if (!nextDueAt) {
      return null;
    }

    return this.factory.create({
      title: task.title,
      notes: task.recurrence.resetNotes ? '' : task.notes,
      status: TASK_STATUS.ACTIVE,
      priority: task.priority,
      energy: task.energy,
      impact: task.impact,
      effortMinutes: task.effortMinutes,
      project: task.project,
      area: task.area,
      tags: task.tags,
      dueAt: nextDueAt,
      followUpAt: '',
      reminderSent: false,
      recurrence: task.recurrence.toJSON(),
      subtasks: task.subtasks.map(subtask => ({
        title: subtask.title,
        done: false,
      })),
    });
  }
}
