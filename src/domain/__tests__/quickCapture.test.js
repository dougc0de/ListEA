import { describe, expect, it } from 'vitest';
import { QuickCaptureInterpreter } from '../quickCapture';
import { toDateInputValue, toTimeInputValue } from '../tasks';

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
    expect(result.dueAtPrecision).toBe('datetime');
  });

  it('detects recurrences and effort hints', () => {
    const interpreter = new QuickCaptureInterpreter();
    const result = interpreter.interpret('Revisar indicadores cada 3 dias 15m');

    expect(result.recurrence.preset).toBe('every-x-days');
    expect(result.recurrence.interval).toBe(3);
    expect(result.effortMinutes).toBe(15);
  });

  it('detects professional follow-ups and client context', () => {
    const interpreter = new QuickCaptureInterpreter();
    const result = interpreter.interpret(
      'seguimiento manana 9am cliente:Mario #ventas',
      new Date('2026-03-23T08:00:00.000Z'),
    );

    expect(result.status).toBe('waiting');
    expect(result.project).toBe('Mario');
    expect(new Date(result.followUpAt).getDate()).toBe(24);
    expect(new Date(result.followUpAt).getHours()).toBe(9);
    expect(result.followUpAtPrecision).toBe('datetime');
    expect(result.dueAt).toBe('');
  });

  it('keeps date-only captures without inventing a morning time', () => {
    const interpreter = new QuickCaptureInterpreter();
    const result = interpreter.interpret(
      'Llamar al cliente manana',
      new Date('2026-03-23T08:00:00.000Z'),
    );

    expect(result.dueAtPrecision).toBe('date');
    expect(toDateInputValue(result.dueAt)).toBe('2026-03-24');
    expect(toTimeInputValue(result.dueAt)).toBe('23:59');
  });

  it('extracts notes from multiline captures and keeps the action title focused', () => {
    const interpreter = new QuickCaptureInterpreter();
    const result = interpreter.interpret(
      'Mandar mensaje por WhatsApp a Maria mañana\nConfirmar presupuesto y siguiente paso',
      new Date('2026-03-23T08:00:00.000Z'),
    );

    expect(result.title).toBe('Mandar mensaje por WhatsApp a Maria');
    expect(result.notes).toBe('Confirmar presupuesto y siguiente paso');
    expect(result.dueAtPrecision).toBe('date');
  });

  it('uses chrono for explicit calendar dates that are harder to parse by hand', () => {
    const interpreter = new QuickCaptureInterpreter();
    const result = interpreter.interpret(
      'Enviar propuesta el 25/04 3pm +Clientes',
      new Date('2026-03-23T08:00:00.000Z'),
    );

    expect(result.project).toBe('Clientes');
    expect(result.dueAtPrecision).toBe('datetime');
    expect(toDateInputValue(result.dueAt)).toBe('2026-04-25');
  });
});
