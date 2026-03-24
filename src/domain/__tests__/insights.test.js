import { describe, expect, it } from 'vitest';
import { BacklogInsightAnalyzer, ExecutionAdvisor } from '../insights';
import { TaskFactory } from '../tasks';

describe('BacklogInsightAnalyzer', () => {
  it('detects stale tasks and duplicates in backlog', () => {
    const factory = new TaskFactory();
    const tasks = [
      factory.create({ title: 'Preparar demo', createdAt: '2026-03-01T10:00:00.000Z' }),
      factory.create({ title: 'Preparar demo' }),
      factory.create({ title: 'Sin fecha' }),
    ];

    const insights = new BacklogInsightAnalyzer().analyze(tasks, {
      referenceDate: new Date('2026-03-23T10:00:00.000Z'),
    });

    expect(insights.map(insight => insight.id)).toContain('stale');
    expect(insights.map(insight => insight.id)).toContain('duplicates');
  });
});

describe('ExecutionAdvisor', () => {
  it('suggests a next action that reduces friction', () => {
    const factory = new TaskFactory();
    const task = factory.create({ title: 'Preparar lanzamiento', priority: 'high' });
    const message = new ExecutionAdvisor().suggest(task);

    expect(message).toContain('Divide');
  });
});
