import { describe, expect, it } from 'vitest';
import {
  BacklogRescuePlanner,
  DailyRecoveryPlanner,
  ProductivityPatternAnalyzer,
  ReminderPersonalityCopywriter,
  TaskHealthAnalyzer,
  TASK_HEALTH_STATES,
} from '../operability';
import { TaskFactory, TASK_DATE_PRECISION, TASK_PRIORITY, TASK_STATUS } from '../tasks';

describe('TaskHealthAnalyzer', () => {
  it('marks repeatedly postponed tasks as stalled', () => {
    const factory = new TaskFactory();
    const task = factory.create({
      title: 'Preparar propuesta',
      postponedCount: 3,
      dueAt: '2026-04-08T15:00:00.000Z',
      dueAtPrecision: TASK_DATE_PRECISION.DATETIME,
    });

    const analyzer = new TaskHealthAnalyzer();
    const result = analyzer.analyze(task, {
      referenceDate: new Date('2026-04-07T10:00:00.000Z'),
    });

    expect(result.state).toBe(TASK_HEALTH_STATES.STALLED);
    expect(result.label).toBe('Estancada');
  });

  it('marks past due tasks as overdue', () => {
    const factory = new TaskFactory();
    const task = factory.create({
      title: 'Enviar contrato',
      dueAt: '2026-04-05T15:00:00.000Z',
      dueAtPrecision: TASK_DATE_PRECISION.DATETIME,
    });

    const analyzer = new TaskHealthAnalyzer();
    const result = analyzer.analyze(task, {
      referenceDate: new Date('2026-04-08T10:00:00.000Z'),
    });

    expect(result.state).toBe(TASK_HEALTH_STATES.OVERDUE);
  });
});

describe('DailyRecoveryPlanner', () => {
  it('activates recovery mode when the day is overloaded', () => {
    const factory = new TaskFactory();
    const tasks = [
      factory.create({
        title: 'Prioridad 1',
        dueAt: '2026-04-08T09:00:00.000Z',
        dueAtPrecision: TASK_DATE_PRECISION.DATETIME,
        priority: TASK_PRIORITY.HIGH,
        effortMinutes: 90,
      }),
      factory.create({
        title: 'Prioridad 2',
        dueAt: '2026-04-08T11:00:00.000Z',
        dueAtPrecision: TASK_DATE_PRECISION.DATETIME,
        priority: TASK_PRIORITY.HIGH,
        effortMinutes: 70,
      }),
      factory.create({
        title: 'Prioridad 3',
        dueAt: '2026-04-08T15:00:00.000Z',
        dueAtPrecision: TASK_DATE_PRECISION.DATETIME,
        priority: TASK_PRIORITY.HIGH,
        effortMinutes: 65,
      }),
      factory.create({
        title: 'Extra',
        dueAt: '2026-04-08T17:00:00.000Z',
        dueAtPrecision: TASK_DATE_PRECISION.DATETIME,
        effortMinutes: 45,
      }),
    ];

    const planner = new DailyRecoveryPlanner();
    const result = planner.build(tasks, {
      referenceDate: new Date('2026-04-08T08:00:00.000Z'),
    });

    expect(result.isRecoveryMode).toBe(true);
    expect(result.priorityTasks).toHaveLength(3);
  });
});

describe('BacklogRescuePlanner', () => {
  it('suggests splitting large tasks and replanning overdue ones', () => {
    const factory = new TaskFactory();
    const tasks = [
      factory.create({
        title: 'Preparar estrategia anual',
        effortMinutes: 120,
        priority: TASK_PRIORITY.HIGH,
      }),
      factory.create({
        title: 'Responder correo atrasado',
        dueAt: '2026-04-04T10:00:00.000Z',
        dueAtPrecision: TASK_DATE_PRECISION.DATETIME,
      }),
    ];

    const planner = new BacklogRescuePlanner();
    const result = planner.build(tasks, {
      referenceDate: new Date('2026-04-08T10:00:00.000Z'),
    });

    expect(result.items.some(item => item.actionId === 'split')).toBe(true);
    expect(result.items.some(item => item.actionId === 'replan')).toBe(true);
  });
});

describe('ProductivityPatternAnalyzer', () => {
  it('extracts local behavior patterns from task history', () => {
    const factory = new TaskFactory();
    const tasks = [
      factory.create({
        title: 'Quick 1',
        effortMinutes: 10,
        status: TASK_STATUS.COMPLETED,
        completedAt: '2026-04-07T09:15:00.000Z',
        dueAt: '2026-04-07T09:00:00.000Z',
        dueAtPrecision: TASK_DATE_PRECISION.DATETIME,
      }),
      factory.create({
        title: 'Quick 2',
        effortMinutes: 10,
        status: TASK_STATUS.COMPLETED,
        completedAt: '2026-04-07T10:20:00.000Z',
        dueAt: '2026-04-07T10:00:00.000Z',
        dueAtPrecision: TASK_DATE_PRECISION.DATETIME,
      }),
      factory.create({
        title: 'Quick 3',
        effortMinutes: 15,
        status: TASK_STATUS.COMPLETED,
        completedAt: '2026-04-08T11:10:00.000Z',
        dueAt: '2026-04-08T11:00:00.000Z',
        dueAtPrecision: TASK_DATE_PRECISION.DATETIME,
      }),
      factory.create({
        title: 'Admin 1',
        area: 'Administracion',
        postponedCount: 2,
      }),
      factory.create({
        title: 'Admin 2',
        area: 'Administracion',
        postponedCount: 2,
      }),
    ];

    const analyzer = new ProductivityPatternAnalyzer();
    const result = analyzer.analyze(tasks, [], {
      referenceDate: new Date('2026-04-08T12:00:00.000Z'),
    });

    expect(result.insights.length).toBeGreaterThan(0);
    expect(result.insights.some(insight => insight.id === 'morning')).toBe(true);
    expect(result.insights.some(insight => insight.id === 'postpone-context')).toBe(true);
  });
});

describe('ReminderPersonalityCopywriter', () => {
  it('changes reminder language according to the selected tone', () => {
    const factory = new TaskFactory();
    const task = factory.create({
      title: 'Llamar al cliente',
      project: 'Clientes',
      dueAt: '2026-04-08T15:00:00.000Z',
      dueAtPrecision: TASK_DATE_PRECISION.DATETIME,
    });

    const copywriter = new ReminderPersonalityCopywriter();
    const firmCopy = copywriter.buildTaskReminder(task, 'basic', 'firm');
    const warmCopy = copywriter.buildTaskReminder(task, 'basic', 'warm');

    expect(firmCopy.title).not.toBe(warmCopy.title);
    expect(firmCopy.summaryText).toBe('Clientes');
  });
});
