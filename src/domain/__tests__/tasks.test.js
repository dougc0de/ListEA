import { describe, expect, it } from 'vitest';
import {
  TASK_PRIORITY,
  TASK_STATUS,
  TaskContextPresenter,
  TaskFactory,
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
});
