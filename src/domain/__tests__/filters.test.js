import { describe, expect, it } from 'vitest';
import { FILTER_IDS, TaskFilterCatalog, TaskFilterService } from '../filters';
import { TaskFactory } from '../tasks';

describe('TaskFilterService', () => {
  it('returns the essential product filters from the PRD', () => {
    const catalog = new TaskFilterCatalog();
    expect(catalog.getPrimaryFilters().map(filter => filter.id)).toEqual([
      FILTER_IDS.TODAY,
      FILTER_IDS.THIS_WEEK,
      FILTER_IDS.OVERDUE,
      FILTER_IDS.NO_DATE,
      FILTER_IDS.BLOCKED,
      FILTER_IDS.WAITING,
      FILTER_IDS.QUICK,
      FILTER_IDS.HIGH_IMPACT,
    ]);
  });

  it('filters tasks by overdue and dynamic project context', () => {
    const factory = new TaskFactory();
    const tasks = [
      factory.create({ title: 'A', project: 'Clientes', dueAt: '2026-03-20T10:00:00.000Z' }),
      factory.create({ title: 'B', project: 'Interno' }),
    ];

    const service = new TaskFilterService();
    expect(service.apply(tasks, FILTER_IDS.OVERDUE, { referenceDate: new Date('2026-03-23T10:00:00.000Z') })).toHaveLength(1);
    expect(service.apply(tasks, 'project:Clientes')).toHaveLength(1);
  });
});
