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
});
