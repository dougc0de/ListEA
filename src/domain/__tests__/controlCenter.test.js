import { describe, expect, it } from 'vitest';
import { TaskActivityLedger } from '../activity';
import { ProfessionalControlCenter } from '../controlCenter';
import { TaskFactory, TASK_STATUS } from '../tasks';

describe('ProfessionalControlCenter', () => {
  it('builds actionable queues for risk, responses and stale blocked tasks', () => {
    const factory = new TaskFactory();
    const tasks = [
      factory.create({
        title: 'Mandar mensaje por WhatsApp a Maria',
        project: 'Clientes',
        dueAt: '2026-04-08T14:00:00.000Z',
      }),
      factory.create({
        title: 'Seguimiento de propuesta',
        project: 'Clientes',
        status: TASK_STATUS.WAITING,
        followUpAt: '2026-04-05T10:00:00.000Z',
        updatedAt: '2026-04-04T10:00:00.000Z',
      }),
      factory.create({
        title: 'Bloqueo con proveedor',
        project: 'Operaciones',
        status: TASK_STATUS.BLOCKED,
        updatedAt: '2026-04-01T10:00:00.000Z',
      }),
      factory.create({
        title: 'Tarea cerrada',
        status: TASK_STATUS.COMPLETED,
        completedAt: '2026-04-07T10:00:00.000Z',
      }),
    ];

    const analytics = new TaskActivityLedger();
    analytics.recordLaunched(tasks[0], { app: { id: 'whatsapp' } }, '2026-04-08T11:30:00.000Z');
    analytics.recordLaunched(tasks[0], { app: { id: 'whatsapp' } }, '2026-04-08T12:30:00.000Z');

    const center = new ProfessionalControlCenter();
    const result = center.build(tasks, analytics, {
      referenceDate: new Date('2026-04-08T15:00:00.000Z'),
      rangeStart: '2026-04-01T00:00:00.000Z',
      rangeEnd: '2026-04-08T23:59:59.000Z',
      completionRate: 62,
    });

    expect(result.summary.atRisk).toBe(2);
    expect(result.summary.responses).toBe(1);
    expect(result.summary.staleBlocked).toBe(2);
    expect(result.summary.launches).toBe(2);
    expect(result.summary.completionRate).toBe(62);
    expect(result.riskItems[0].badge).toBe('Seguimiento');
    expect(result.responseItems[0].badge).toBe('WhatsApp');
    expect(result.blockedItems[0].badge).toBe('7d');
    expect(result.appUsage[0]).toMatchObject({
      title: 'WhatsApp',
      count: 2,
    });
  });

  it('builds a simple pulse snapshot from local tasks', () => {
    const factory = new TaskFactory();
    const tasks = [
      factory.create({ title: 'Hoy', dueAt: '2026-04-08T10:00:00.000Z' }),
      factory.create({ title: 'Semana', dueAt: '2026-04-10T10:00:00.000Z' }),
      factory.create({ title: 'Sin fecha' }),
      factory.create({ title: 'Esperando correo', status: TASK_STATUS.WAITING, followUpAt: '2026-04-08T18:00:00.000Z' }),
    ];

    const center = new ProfessionalControlCenter();
    const result = center.build(tasks, [], {
      referenceDate: new Date('2026-04-08T09:00:00.000Z'),
    });

    expect(result.pulse).toEqual([
      { id: 'today', label: 'Hoy', value: 2 },
      { id: 'this-week', label: 'Semana', value: 3 },
      { id: 'follow-up', label: 'Seguimiento', value: 1 },
      { id: 'no-date', label: 'Sin fecha', value: 1 },
    ]);
  });
});
