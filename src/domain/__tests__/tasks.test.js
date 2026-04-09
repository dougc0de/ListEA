import { describe, expect, it } from 'vitest';
import { TaskBoardBuilder, TaskFactory } from '../tasks';

describe('TaskFactory', () => {
  it('creates premium-capable tasks with tags and subtasks', () => {
    const factory = new TaskFactory();
    const task = factory.create({
      title: 'Plan launch',
      tags: 'work, launch',
      subtasks: ['QA', 'Publish'],
      priority: 'high',
    });

    expect(task.tags).toEqual(['work', 'launch']);
    expect(task.subtasks).toHaveLength(2);
    expect(task.priority).toBe('high');
  });
});

describe('TaskBoardBuilder', () => {
  it('groups tasks by priority', () => {
    const factory = new TaskFactory();
    const board = new TaskBoardBuilder().build([
      factory.create({ title: 'A', priority: 'high' }),
      factory.create({ title: 'B', priority: 'medium' }),
      factory.create({ title: 'C', priority: 'low' }),
    ]);

    expect(board.high).toHaveLength(1);
    expect(board.medium).toHaveLength(1);
    expect(board.low).toHaveLength(1);
  });
});
