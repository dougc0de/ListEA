import { describe, expect, it } from 'vitest';
import { ProfessionalReviewAnalyzer } from '../review';
import { TaskFactory } from '../tasks';

describe('ProfessionalReviewAnalyzer', () => {
  it('highlights no-date tasks, overdue follow-ups and duplicates', () => {
    const factory = new TaskFactory();
    const review = new ProfessionalReviewAnalyzer().analyze([
      factory.create({ title: 'Preparar propuesta' }),
      factory.create({
        title: 'Seguimiento con cliente',
        status: 'waiting',
        followUpAt: '2026-03-22T09:00:00.000Z',
      }),
      factory.create({ title: 'Preparar propuesta' }),
    ], {
      referenceDate: new Date('2026-03-23T10:00:00.000Z'),
    });

    expect(review.map(item => item.id)).toEqual(['no-date', 'overdue-follow-up', 'duplicates']);
    expect(review[0].targetView).toBe('today');
    expect(review[1].targetView).toBe('follow-up');
  });
});
