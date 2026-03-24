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
});
