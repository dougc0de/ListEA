import { describe, expect, it } from 'vitest';
import { QuickCaptureInterpreter } from '../quickCapture';

describe('QuickCaptureInterpreter', () => {
  it('extracts date, tags and priority from natural language', () => {
    const interpreter = new QuickCaptureInterpreter();
    const result = interpreter.interpret(
      'Llamar al cliente manana 10am #ventas urgente +Clientes',
      new Date('2026-03-23T08:00:00.000Z'),
    );

    expect(result.title).toBe('Llamar al cliente');
    expect(result.tags).toEqual(['ventas']);
    expect(result.project).toBe('Clientes');
    expect(result.priority).toBe('high');
    expect(new Date(result.dueAt).getDate()).toBe(24);
    expect(new Date(result.dueAt).getHours()).toBe(10);
  });

  it('detects recurrences and effort hints', () => {
    const interpreter = new QuickCaptureInterpreter();
    const result = interpreter.interpret('Revisar indicadores cada 3 dias 15m');

    expect(result.recurrence.preset).toBe('every-x-days');
    expect(result.recurrence.interval).toBe(3);
    expect(result.effortMinutes).toBe(15);
  });
});
