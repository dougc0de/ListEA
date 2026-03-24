import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_TYPES,
  DASHBOARD_GRANULARITY,
  TaskActivityDashboard,
  TaskActivityLedger,
} from '../activity';
import { TaskFactory } from '../tasks';

describe('TaskActivityLedger', () => {
  it('records completion and deletion events in order', () => {
    const factory = new TaskFactory();
    const task = factory.create({ id: 'task-1', title: 'Preparar entrega' });
    const ledger = new TaskActivityLedger();

    ledger.recordCompleted(task, '2026-03-23T10:00:00.000Z');
    ledger.recordDeleted(task, '2026-03-24T11:00:00.000Z');

    expect(ledger.events).toHaveLength(2);
    expect(ledger.events[0].type).toBe(ACTIVITY_TYPES.COMPLETED);
    expect(ledger.events[1].type).toBe(ACTIVITY_TYPES.DELETED);
  });
});

describe('TaskActivityDashboard', () => {
  it('builds summary totals and daily buckets from local events', () => {
    const ledger = new TaskActivityLedger([
      {
        id: 'event-1',
        type: ACTIVITY_TYPES.COMPLETED,
        taskId: 'task-1',
        title: 'Cerrar propuesta',
        happenedAt: '2026-03-22T09:00:00.000Z',
      },
      {
        id: 'event-2',
        type: ACTIVITY_TYPES.DELETED,
        taskId: 'task-2',
        title: 'Eliminar tarea vieja',
        happenedAt: '2026-03-24T16:00:00.000Z',
      },
    ]);

    const dashboard = new TaskActivityDashboard().build(ledger, {
      referenceDate: new Date('2026-03-24T18:00:00.000Z'),
      days: 3,
    });

    expect(dashboard.summary.completed).toBe(1);
    expect(dashboard.summary.deleted).toBe(1);
    expect(dashboard.summary.handled).toBe(2);
    expect(dashboard.summary.completionRate).toBe(50);
    expect(dashboard.series).toHaveLength(3);
    expect(dashboard.series[0].completed).toBe(1);
    expect(dashboard.series[2].deleted).toBe(1);
  });

  it('groups buckets by week when requested', () => {
    const ledger = new TaskActivityLedger([
      {
        id: 'event-1',
        type: ACTIVITY_TYPES.COMPLETED,
        taskId: 'task-1',
        title: 'Cerrar propuesta',
        happenedAt: '2026-03-10T09:00:00.000Z',
      },
      {
        id: 'event-2',
        type: ACTIVITY_TYPES.DELETED,
        taskId: 'task-2',
        title: 'Depurar tarea',
        happenedAt: '2026-03-18T16:00:00.000Z',
      },
    ]);

    const dashboard = new TaskActivityDashboard().build(ledger, {
      referenceDate: new Date('2026-03-24T18:00:00.000Z'),
      granularity: DASHBOARD_GRANULARITY.WEEK,
      weeks: 3,
    });

    expect(dashboard.range.granularity).toBe(DASHBOARD_GRANULARITY.WEEK);
    expect(dashboard.series).toHaveLength(3);
    expect(dashboard.series.some(bucket => bucket.completed === 1)).toBe(true);
    expect(dashboard.series.some(bucket => bucket.deleted === 1)).toBe(true);
  });
});
