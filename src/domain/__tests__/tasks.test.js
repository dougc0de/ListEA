import { describe, expect, it } from 'vitest';
import {
  TASK_PRIORITY,
  TASK_STATUS,
  TaskContextPresenter,
  TaskFactory,
  toDateTimeInputValue,
} from '../tasks';

describe('TaskFactory', () => {
  it('creates rich tasks with normalized context fields', () => {
    const factory = new TaskFactory({
      clock: () => new Date('2026-03-23T10:00:00.000Z'),
      idProvider: () => 'task-1',
    });

    const task = factory.create({
      title: ' Preparar propuesta ',
      tags: 'trabajo, urgente',
      subtasks: ['Definir alcance', 'Enviar'],
      priority: TASK_PRIORITY.HIGH,
      status: TASK_STATUS.BLOCKED,
      project: 'Clientes',
      area: 'Trabajo',
      effortMinutes: 33,
    });

    expect(task.id).toBe('task-1');
    expect(task.title).toBe('Preparar propuesta');
    expect(task.tags).toEqual(['trabajo', 'urgente']);
    expect(task.subtasks).toHaveLength(2);
    expect(task.priority).toBe(TASK_PRIORITY.HIGH);
    expect(task.status).toBe(TASK_STATUS.BLOCKED);
    expect(task.project).toBe('Clientes');
    expect(task.effortMinutes).toBe(33);
    expect(task.source).toBe('manual');
    expect(task.needsTriage).toBe(false);
  });
});

describe('TaskContextPresenter', () => {
  it('builds visible context for subtasks', () => {
    const factory = new TaskFactory();
    const task = factory.create({
      title: 'Preparar onboarding',
      project: 'Producto',
      area: 'Trabajo',
      priority: 'high',
      dueAt: '2026-03-24T16:30:00.000Z',
      subtasks: ['Escribir pasos'],
    });

    const presenter = new TaskContextPresenter();
    const subtask = presenter.buildSubtaskContext(task, task.subtasks[0]);

    expect(subtask.context).toContain('Producto');
    expect(subtask.context).toContain('Alta prioridad');
  });

  it('resets the avatar snippet state when the due date changes', () => {
    const factory = new TaskFactory();
    const task = factory.create({
      title: 'Preparar onboarding',
      dueAt: '2026-03-24T16:30:00.000Z',
      avatarSnippetShownAt: '2026-03-24T16:20:00.000Z',
    });

    task.applyPatch({
      dueAt: '2026-03-24T18:00:00.000Z',
    });

    expect(task.avatarSnippetShownAt).toBe('');
  });

  it('formats ISO datetimes for datetime-local inputs without shifting the local wall-clock text', () => {
    expect(toDateTimeInputValue('2026-03-24T18:30:00.000Z')).toMatch(/^2026-03-24T\d{2}:30$/);
  });
});
