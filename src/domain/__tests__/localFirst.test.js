import { describe, expect, it } from 'vitest';
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
    repository.save(state);

    expect(saved).toContain('listea-local-state-v4');
    expect(saved).toContain('"tasks"');
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
});
