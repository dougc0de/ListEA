import { describe, expect, it } from 'vitest';
import { ACTIVITY_TYPES } from '../activity';
import { LocalTaskRepository } from '../localFirst';
import { AVATAR_TIMINGS } from '../avatar';
import { LICENSE_TIERS } from '../license';

describe('LocalTaskRepository', () => {
  it('bootstraps an empty local state when storage is empty', () => {
    const storage = {
      getItem() {
        return null;
      },
      setItem() {},
    };

    const state = new LocalTaskRepository({ storage }).load();
    expect(state.tasks).toHaveLength(0);
    expect(state.analytics.events).toHaveLength(0);
    expect(state.preferences.license.licenseTier).toBe(LICENSE_TIERS.FREE);
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
    const task = repository.factory.create({
      title: 'Preparar release limpia',
    });
    state.tasks = [task];
    state.analytics.recordCompleted(task, '2026-03-24T10:00:00.000Z');
    repository.save(state);

    expect(saved).toContain('listea-local-state-v4');
    expect(saved).toContain('"tasks"');
    expect(saved).toContain('"analytics"');
    expect(saved).toContain(ACTIVITY_TYPES.COMPLETED);
    expect(saved).toContain('"license"');
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

  it('respects an intentionally empty persisted task list', () => {
    const storage = {
      getItem() {
        return JSON.stringify({
          tasks: [],
          analytics: [],
          preferences: {},
        });
      },
      setItem() {},
    };

    const state = new LocalTaskRepository({ storage }).load();

    expect(state.tasks).toHaveLength(0);
  });

  it('migrates legacy premium mode into a local pro license', () => {
    const storage = {
      getItem() {
        return JSON.stringify({
          tasks: [],
          analytics: [],
          preferences: {
            premiumEnabled: true,
          },
        });
      },
      setItem() {},
    };

    const state = new LocalTaskRepository({ storage }).load();

    expect(state.preferences.license.licenseTier).toBe(LICENSE_TIERS.PRO);
    expect(state.preferences.license.entitlements.premiumThemes).toBe(true);
    expect(state.preferences.license.entitlements.pdfExport).toBe(true);
  });

  it('rehydrates assistant personality preferences from local storage', () => {
    const storage = {
      getItem() {
        return JSON.stringify({
          tasks: [],
          analytics: [],
          preferences: {
            assistant: {
              assistantEnabled: true,
              reminderPersonality: 'warm',
            },
          },
        });
      },
      setItem() {},
    };

    const state = new LocalTaskRepository({ storage }).load();

    expect(state.preferences.assistant.assistantEnabled).toBe(true);
    expect(state.preferences.assistant.reminderPersonality).toBe('warm');
  });
});
