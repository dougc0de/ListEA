import { describe, expect, it } from 'vitest';
import {
  TASK_DATE_PRECISION,
  TASK_PRIORITY,
  TASK_STATUS,
  TaskContextPresenter,
  TaskFactory,
  buildTaskDateTime,
  toDateInputValue,
  toDateTimeInputValue,
  toTimeInputValue,
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

  it('accepts screenshot as a first-class capture source', () => {
    const factory = new TaskFactory();
    const task = factory.create({
      title: 'Convertida desde screenshot',
      source: 'screenshot',
    });

    expect(task.source).toBe('screenshot');
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

  it('builds date-only task datetimes without forcing an explicit hour in the UI', () => {
    const result = buildTaskDateTime('2026-03-24', '', false);

    expect(result.precision).toBe(TASK_DATE_PRECISION.DATE);
    expect(toDateInputValue(result.value)).toBe('2026-03-24');
    expect(toTimeInputValue(result.value)).toBe('23:59');
  });

  it('formats date-only context without showing time', () => {
    const presenter = new TaskContextPresenter();
    const formatted = presenter.formatDate('2026-03-24T23:59:00.000Z', TASK_DATE_PRECISION.DATE, 'es-MX');

    expect(formatted).toContain('24');
    expect(formatted).not.toMatch(/\d{1,2}:\d{2}/);
  });
});
