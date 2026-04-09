import { describe, expect, it } from 'vitest';
import { TaskActivityLedger } from '../activity';
import { PeriodicReportService, REPORT_PERIODS } from '../periodicReports';
import { TaskFactory, TASK_STATUS } from '../tasks';

function toDateKey(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toHourRange(value) {
  const date = new Date(value);
  const hour = date.getHours();
  return `${`${hour}`.padStart(2, '0')}:00 - ${`${(hour + 1) % 24}`.padStart(2, '0')}:00`;
}

describe('PeriodicReportService', () => {
  it('resolves last closed natural periods', () => {
    const service = new PeriodicReportService();
    const referenceDate = new Date('2026-04-09T12:00:00.000Z');

    const weekWindow = service.resolveWindow(REPORT_PERIODS.WEEK, referenceDate);
    const biweeklyWindow = service.resolveWindow(REPORT_PERIODS.BIWEEKLY, referenceDate);
    const monthWindow = service.resolveWindow(REPORT_PERIODS.MONTH, referenceDate);

    expect(toDateKey(weekWindow.startDate)).toBe('2026-03-30');
    expect(toDateKey(weekWindow.endDate)).toBe('2026-04-05');
    expect(toDateKey(biweeklyWindow.startDate)).toBe('2026-03-16');
    expect(toDateKey(biweeklyWindow.endDate)).toBe('2026-03-31');
    expect(toDateKey(monthWindow.startDate)).toBe('2026-03-01');
    expect(toDateKey(monthWindow.endDate)).toBe('2026-03-31');
  });

  it('builds a closed weekly report with creation, completion and miss patterns', () => {
    const factory = new TaskFactory();
    const tasks = [
      factory.create({
        id: 'task-a',
        title: 'Cerrar propuesta',
        project: 'Clientes',
        createdAt: '2026-03-31T08:00:00.000Z',
        dueAt: '2026-04-01T09:00:00.000Z',
        dueAtPrecision: 'datetime',
        status: TASK_STATUS.COMPLETED,
        completedAt: '2026-04-01T09:20:00.000Z',
      }),
      factory.create({
        id: 'task-b',
        title: 'Mandar WhatsApp a cliente',
        project: 'Clientes',
        createdAt: '2026-03-29T10:00:00.000Z',
        followUpAt: '2026-04-02T16:00:00.000Z',
        followUpAtPrecision: 'datetime',
        status: TASK_STATUS.WAITING,
        postponedCount: 2,
      }),
      factory.create({
        id: 'task-c',
        title: 'Revisar propuesta tarde',
        project: 'Ventas',
        createdAt: '2026-04-03T09:00:00.000Z',
        dueAt: '2026-04-04T16:00:00.000Z',
        dueAtPrecision: 'datetime',
        status: TASK_STATUS.COMPLETED,
        completedAt: '2026-04-07T18:00:00.000Z',
        postponedCount: 1,
      }),
      factory.create({
        id: 'task-d',
        title: 'Idea sin fecha',
        project: 'General',
        createdAt: '2026-04-04T10:00:00.000Z',
      }),
      factory.create({
        id: 'task-e',
        title: 'Preparar deck comercial',
        project: 'Clientes',
        createdAt: '2026-04-05T11:00:00.000Z',
        dueAt: '2026-04-08T12:00:00.000Z',
        dueAtPrecision: 'datetime',
        postponedCount: 3,
      }),
    ];
    const analytics = new TaskActivityLedger();
    analytics.recordCompleted(tasks[0], '2026-04-01T09:20:00.000Z');
    analytics.recordLaunched(tasks[1], { app: { id: 'whatsapp' } }, '2026-04-03T11:00:00.000Z');

    const report = new PeriodicReportService().build(tasks, analytics, {
      period: REPORT_PERIODS.WEEK,
      referenceDate: new Date('2026-04-09T12:00:00.000Z'),
    });

    expect(report.summary.created).toBe(4);
    expect(report.summary.completed).toBe(1);
    expect(report.summary.openAtClose).toBe(4);
    expect(report.summary.overdue).toBe(2);
    expect(report.summary.noDate).toBe(1);
    expect(report.summary.completionRate).toBe(20);
    expect(report.patterns.bestHourRange).toBe(toHourRange('2026-04-01T09:20:00.000Z'));
    expect(report.patterns.missedHourRange).toBe(toHourRange('2026-04-02T16:00:00.000Z'));
    expect(report.patterns.mostPostponedContext).toBe('Clientes');
    expect(report.signals.launches).toBe(1);
    expect(report.signals.responses).toBeGreaterThanOrEqual(1);
    expect(report.lists.pending.some(item => item.title.includes('Revisar propuesta tarde'))).toBe(true);
  });

  it('returns a clear empty snapshot when there is no activity in the closed period', () => {
    const report = new PeriodicReportService().build([], new TaskActivityLedger(), {
      period: REPORT_PERIODS.MONTH,
      referenceDate: new Date('2026-04-09T12:00:00.000Z'),
    });

    expect(report.isEmpty).toBe(true);
    expect(report.summary.created).toBe(0);
    expect(report.summary.completed).toBe(0);
    expect(report.patterns.mainInsight).toContain('Todavia');
  });

  it('avoids presenting the same hour as both strongest and most vulnerable when there is no contrast', () => {
    const factory = new TaskFactory();
    const tasks = [
      factory.create({
        id: 'task-a',
        title: 'Llamar a cliente',
        createdAt: '2026-03-31T08:00:00.000Z',
        dueAt: '2026-04-01T09:00:00.000Z',
        dueAtPrecision: 'datetime',
        status: TASK_STATUS.COMPLETED,
        completedAt: '2026-04-01T09:10:00.000Z',
      }),
      factory.create({
        id: 'task-b',
        title: 'Seguimiento de propuesta',
        createdAt: '2026-04-01T08:00:00.000Z',
        followUpAt: '2026-04-03T09:00:00.000Z',
        followUpAtPrecision: 'datetime',
        status: TASK_STATUS.WAITING,
      }),
    ];
    const analytics = new TaskActivityLedger();
    analytics.recordCompleted(tasks[0], '2026-04-01T09:10:00.000Z');

    const report = new PeriodicReportService().build(tasks, analytics, {
      period: REPORT_PERIODS.WEEK,
      referenceDate: new Date('2026-04-09T12:00:00.000Z'),
    });

    expect(report.patterns.bestHourRange).toBe(toHourRange('2026-04-01T09:10:00.000Z'));
    expect(report.patterns.missedHourRange).toBe('Sin contraste suficiente');
  });
});
