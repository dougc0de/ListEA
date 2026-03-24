import { describe, expect, it } from 'vitest';
import { ACTIVITY_TYPES } from '../activity';
import { LocalTaskRepository } from '../localFirst';
import { AVATAR_TIMINGS } from '../avatar';

describe('LocalTaskRepository', () => {
  it('bootstraps demo data when storage is empty', () => {
    const storage = {
      getItem() {
        return null;
      },
      setItem() {},
    };

    const state = new LocalTaskRepository({ storage }).load();
    expect(state.tasks.length).toBeGreaterThan(0);
    expect(state.tasks.some(task => task.recurrence?.isEnabled?.())).toBe(true);
    expect(state.tasks.some(task => task.isCompleted())).toBe(true);
    expect(state.preferences.avatar.enabled).toBe(true);
  });

  it('persists serialized tasks and preferences', () => {
    let saved = '';
    const storage = {
      getItem() {
        return null;
      },
      setItem(key, value) {
        saved = `${key}:${value}`;
      },
    };

    const repository = new LocalTaskRepository({ storage });
    const state = repository.createBootstrapState();
    state.analytics.recordCompleted(state.tasks[0], '2026-03-24T10:00:00.000Z');
    repository.save(state);

    expect(saved).toContain('listea-local-state-v4');
    expect(saved).toContain('"tasks"');
    expect(saved).toContain('"analytics"');
    expect(saved).toContain(ACTIVITY_TYPES.COMPLETED);
  });

  it('migrates legacy avatar timing into both reminder and snippet settings', () => {
    const storage = {
      getItem() {
        return JSON.stringify({
          tasks: [],
          preferences: {
            avatar: {
              enabled: true,
              timing: AVATAR_TIMINGS.AFTER_10,
            },
          },
        });
      },
      setItem() {},
    };

    const state = new LocalTaskRepository({ storage }).load();

    expect(state.preferences.avatar.reminderTiming).toBe(AVATAR_TIMINGS.AFTER_10);
    expect(state.preferences.avatar.snippetTiming).toBe(AVATAR_TIMINGS.AFTER_10);
  });

  it('rehydrates analytics as a task activity ledger', () => {
    const storage = {
      getItem() {
        return JSON.stringify({
          tasks: [],
          analytics: [
            {
              id: 'event-1',
              type: ACTIVITY_TYPES.DELETED,
              taskId: 'task-1',
              title: 'Limpiar backlog',
              happenedAt: '2026-03-24T08:00:00.000Z',
            },
          ],
          preferences: {},
        });
      },
      setItem() {},
    };

    const state = new LocalTaskRepository({ storage }).load();

    expect(state.analytics.events).toHaveLength(1);
    expect(state.analytics.events[0].type).toBe(ACTIVITY_TYPES.DELETED);
    expect(state.analytics.events[0].title).toBe('Limpiar backlog');
  });
});
