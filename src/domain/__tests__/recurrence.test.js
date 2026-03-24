import { describe, expect, it } from 'vitest';
import { RecurrenceEngine } from '../recurrence';
import { TaskFactory } from '../tasks';

describe('RecurrenceEngine', () => {
  it('creates the next fixed occurrence without carrying transient notes', () => {
    const factory = new TaskFactory({
      clock: () => new Date('2026-03-23T10:00:00.000Z'),
      idProvider: prefix => `${prefix}-fixed`,
    });

    const task = factory.create({
      title: 'Seguimiento semanal',
      notes: 'No arrastrar esta nota',
      dueAt: '2026-03-24T15:00:00.000Z',
      recurrence: {
        preset: 'weekly',
        mode: 'fixed',
        resetNotes: true,
      },
      subtasks: ['Revisar correo'],
    });

    const nextTask = new RecurrenceEngine(factory).createNextOccurrence(task, '2026-03-24T17:00:00.000Z');

    expect(nextTask.dueAt).toBe('2026-03-31T15:00:00.000Z');
    expect(nextTask.notes).toBe('');
    expect(nextTask.subtasks[0].done).toBe(false);
  });

  it('supports after-completion recurrences', () => {
    const factory = new TaskFactory();
    const task = factory.create({
      title: 'Recordar seguimiento',
      recurrence: {
        preset: 'daily',
        mode: 'after-completion',
      },
    });

    const nextTask = new RecurrenceEngine(factory).createNextOccurrence(task, '2026-03-23T12:00:00.000Z');
    expect(nextTask.dueAt).toBe('2026-03-24T12:00:00.000Z');
  });

  it('returns null when a fixed recurring task has no valid anchor date', () => {
    const factory = new TaskFactory();
    const task = factory.create({
      title: 'Serie rota',
      dueAt: '2026-03-23T12:00:00.000Z',
      recurrence: {
        preset: 'weekly',
        mode: 'fixed',
        anchorAt: '',
      },
    });

    const nextTask = new RecurrenceEngine(factory).createNextOccurrence(task, '2026-03-23T12:00:00.000Z');

    expect(nextTask).toBeNull();
  });

  it('removes the generated sibling occurrence when reopening a recurring task', () => {
    const factory = new TaskFactory({
      clock: () => new Date('2026-03-23T10:00:00.000Z'),
    });
    const engine = new RecurrenceEngine(factory);
    const seriesId = 'series-demo';
    const completedTask = factory.create({
      id: 'task-completed',
      title: 'Regar plantas',
      dueAt: '2026-03-16T18:00:00.000Z',
      completedAt: '2026-03-22T18:10:00.000Z',
      status: 'completed',
      recurrence: {
        preset: 'weekly',
        seriesId,
      },
    });
    const nextOccurrence = factory.create({
      id: 'task-next',
      title: 'Regar plantas',
      dueAt: '2026-03-23T18:00:00.000Z',
      recurrence: {
        preset: 'weekly',
        seriesId,
      },
    });

    completedTask.reopen('2026-03-23T10:00:00.000Z');

    const tasks = engine.reconcileReopenedTask([completedTask, nextOccurrence], completedTask);

    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe('task-completed');
  });
});
