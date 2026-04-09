import { describe, expect, it } from 'vitest';
import { buildPeriodicPdfReportData } from '../dashboardReportPdf';

describe('buildPeriodicPdfReportData', () => {
  it('maps a periodic snapshot into an executive pdf payload', () => {
    const data = buildPeriodicPdfReportData({
      appName: 'ListEA',
      reportSnapshot: {
        title: 'Semana cerrada',
        period: 'week',
        range: {
          label: '30 mar - 5 abr',
          fileLabel: '2026-03-30_2026-04-05',
        },
        summary: {
          created: 4,
          completed: 2,
          openAtClose: 3,
          overdue: 1,
          noDate: 1,
          completionRate: 40,
        },
        signals: {
          atRisk: 1,
          stalled: 2,
          responses: 1,
          launches: 3,
        },
        patterns: {
          bestHourRange: '09:00 - 10:00',
          missedHourRange: '16:00 - 17:00',
          mostPostponedContext: 'Clientes',
          mainInsight: 'Cerraste el periodo con 1 vencida.',
          insights: ['Cerraste el periodo con 1 vencida.'],
        },
        lists: {
          completed: [{ id: 'done-1', title: 'Cerrar propuesta', tag: 'Clientes', meta: '1 abr, 09:20', detail: 'Cerrada dentro del periodo.' }],
          pending: [],
          overdue: [],
          noDate: [],
        },
      },
    });

    expect(data.reportTitle).toBe('Semana cerrada');
    expect(data.periodLabel).toBe('30 mar - 5 abr');
    expect(data.summaryCards).toHaveLength(6);
    expect(data.patternCards[0].value).toBe('09:00 - 10:00');
    expect(data.sections).toHaveLength(4);
    expect(data.sections[0].items[0].title).toBe('Cerrar propuesta');
    expect(data.sections[1].items[0].title).toBe('Sin datos suficientes');
  });
});
