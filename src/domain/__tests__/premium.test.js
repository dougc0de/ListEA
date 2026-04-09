import { describe, expect, it } from 'vitest';
import { BackupService, FocusSession, TemplateLibrary } from '../premium';

describe('TemplateLibrary', () => {
  it('starts empty when no default templates are desired', () => {
    const library = new TemplateLibrary();

    expect(library.getAll()).toEqual([]);
    expect(library.getById('deep-work')).toBeUndefined();
  });
});

describe('BackupService', () => {
  it('builds a serializable snapshot', () => {
    const content = new BackupService().buildSnapshot({
      todos: [{ id: 1, title: 'Task' }],
      settings: { planId: 'premium' },
    });

    expect(content).toContain('"planId": "premium"');
    expect(content).toContain('"title": "Task"');
  });
});

describe('FocusSession', () => {
  it('tracks remaining time', () => {
    const session = new FocusSession();
    session.start(1);

    expect(session.isRunning()).toBe(true);
    expect(session.getRemainingMs(session.startedAt + 1000)).toBeGreaterThan(0);

    session.stop();
    expect(session.isRunning()).toBe(false);
  });
});
