import { describe, expect, it } from 'vitest';
import { TodayBoardBuilder } from '../today';
import { TaskFactory } from '../tasks';

describe('TodayBoardBuilder', () => {
  it('splits tasks into the product lanes for today', () => {
    const factory = new TaskFactory();
    const tasks = [
      factory.create({ title: 'Ahora', dueAt: '2026-03-23T10:30:00.000Z' }),
      factory.create({ title: 'Rapida', effortMinutes: 10 }),
      factory.create({ title: 'Importante', priority: 'high' }),
      factory.create({ title: 'En espera', status: 'waiting' }),
      factory.create({ title: 'Vencida', dueAt: '2026-03-22T10:00:00.000Z' }),
    ];

    const board = new TodayBoardBuilder().build(tasks, {
      referenceDate: new Date('2026-03-23T10:00:00.000Z'),
    });

    expect(board.find(lane => lane.id === 'now')?.items).toHaveLength(1);
    expect(board.find(lane => lane.id === 'quickWins')?.items).toHaveLength(1);
    expect(board.find(lane => lane.id === 'important')?.items).toHaveLength(1);
    expect(board.find(lane => lane.id === 'waiting')?.items).toHaveLength(1);
    expect(board.find(lane => lane.id === 'overdue')?.items).toHaveLength(1);
  });
});
