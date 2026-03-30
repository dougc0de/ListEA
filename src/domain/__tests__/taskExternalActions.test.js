import { describe, expect, it } from 'vitest';
import { TaskExternalActionResolver } from '../taskExternalActions';

describe('TaskExternalActionResolver', () => {
  it('builds meeting and calendar actions from a professional task', () => {
    const resolver = new TaskExternalActionResolver();
    const actions = resolver.resolve({
      title: 'Reunion con cliente',
      notes: 'Entrar por https://meet.google.com/abc-defg-hij y cerrar siguientes pasos',
      dueAt: '2026-03-31T15:00:00.000Z',
      effortMinutes: 45,
    });

    expect(actions.map(action => action.id)).toEqual(['meeting-link', 'calendar']);
    expect(actions[0].label).toBe('Abrir Meet');
    expect(actions[1].url).toContain('calendar.google.com');
  });

  it('creates WhatsApp and call actions only when there is enough context', () => {
    const resolver = new TaskExternalActionResolver();
    const actions = resolver.resolve({
      title: 'Llamar por whatsapp al cliente +1 (555) 123-4567',
      notes: 'Mandar mensaje antes de cerrar la reunion',
    });

    expect(actions.map(action => action.id)).toEqual(['whatsapp', 'call']);
    expect(actions[0].url).toContain('wa.me/15551234567');
    expect(actions[1].url).toBe('tel:+15551234567');
  });

  it('creates an email action from the detected address', () => {
    const resolver = new TaskExternalActionResolver();
    const actions = resolver.resolve({
      title: 'Enviar correo a maria@cliente.com',
      notes: 'Compartir resumen de la propuesta',
    });

    expect(actions).toHaveLength(1);
    expect(actions[0].id).toBe('email');
    expect(actions[0].url).toContain('mailto:maria@cliente.com');
  });

  it('does not expose external actions for generic tasks without actionable context', () => {
    const resolver = new TaskExternalActionResolver();
    const actions = resolver.resolve({
      title: 'Ir al banco',
      notes: 'Resolver deposito pendiente',
    });

    expect(actions).toEqual([]);
  });

  it('hides external actions for completed tasks', () => {
    const resolver = new TaskExternalActionResolver();
    const actions = resolver.resolve({
      title: 'Revisar enlace',
      notes: 'https://example.com/propuesta',
      completedAt: '2026-03-31T10:00:00.000Z',
    });

    expect(actions).toEqual([]);
  });

  it('falls back to a generic link action when the url is useful but not app-specific', () => {
    const resolver = new TaskExternalActionResolver();
    const actions = resolver.resolve({
      title: 'Revisar documento compartido',
      notes: 'Abrir https://example.com/propuesta-final',
    });

    expect(actions).toHaveLength(1);
    expect(actions[0].id).toBe('generic-link');
    expect(actions[0].label).toBe('Abrir enlace');
  });
});
