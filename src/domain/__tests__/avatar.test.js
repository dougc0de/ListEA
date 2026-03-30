import { describe, expect, it } from 'vitest';
import { AvatarCoach, AvatarPreferences, AVATAR_TIMINGS } from '../avatar';
import { TaskFactory } from '../tasks';

describe('AvatarCoach', () => {
  it('prioritizes overdue guidance over generic encouragement', () => {
    const factory = new TaskFactory();
    const tasks = [factory.create({ title: 'Entregar propuesta', dueAt: '2026-03-22T10:00:00.000Z' })];

    const snapshot = new AvatarCoach().buildSnapshot({
      tasks,
      preferences: new AvatarPreferences(),
      referenceDate: new Date('2026-03-23T10:00:00.000Z'),
    });

    expect(snapshot.visible).toBe(true);
    expect(snapshot.title).toContain('vencida');
  });

  it('computes reminder dates from avatar preferences', () => {
    const factory = new TaskFactory();
    const task = factory.create({ title: 'Llamada', dueAt: '2026-03-23T15:00:00.000Z', priority: 'high' });

    const reminderAt = new AvatarCoach().getReminderAt(task, new AvatarPreferences({
      enabled: true,
      timing: AVATAR_TIMINGS.BEFORE_10,
      importantOnly: true,
    }));

    expect(reminderAt).toBe('2026-03-23T14:50:00.000Z');
  });

  it('selects the next due task for the avatar snippet in UI', () => {
    const factory = new TaskFactory();
    const tasks = [
      factory.create({ title: 'Preparar reunion', dueAt: '2026-03-23T15:00:00.000Z' }),
      factory.create({ title: 'Enviar resumen', dueAt: '2026-03-23T17:00:00.000Z' }),
    ];

    const dueTask = new AvatarCoach().getDueSnippetTask(
      tasks,
      new AvatarPreferences({ snippetTiming: AVATAR_TIMINGS.ON_TIME }),
      new Date('2026-03-23T15:05:00.000Z'),
    );

    expect(dueTask?.title).toBe('Preparar reunion');
  });

  it('computes reminders from follow-up dates when no due date exists', () => {
    const factory = new TaskFactory();
    const task = factory.create({
      title: 'Seguimiento con proveedor',
      status: 'waiting',
      followUpAt: '2026-03-23T15:00:00.000Z',
    });

    const reminderAt = new AvatarCoach().getReminderAt(task, new AvatarPreferences({
      enabled: true,
      reminderTiming: AVATAR_TIMINGS.BEFORE_10,
    }));

    expect(reminderAt).toBe('2026-03-23T14:50:00.000Z');
  });
});
