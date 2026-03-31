import { describe, expect, it } from 'vitest';
import { TaskAppLaunchResolver } from '../taskAppLaunch';

describe('TaskAppLaunchResolver', () => {
  it('maps a WhatsApp task mention to a home-first launch suggestion', () => {
    const resolver = new TaskAppLaunchResolver();
    const suggestions = resolver.resolve({
      title: 'Mandar mensaje por whatsapp',
      notes: 'Confirmar la reunion de manana',
      tags: [],
    });

    expect(suggestions[0].id).toBe('app-whatsapp');
    expect(suggestions[0].label).toBe('Abrir WhatsApp');
    expect(suggestions[0].app?.id).toBe('whatsapp');
    expect(suggestions[0].target).toBe('home');
    expect(suggestions[0].matchSource).toBe('task');
  });

  it('promotes supported meeting links into the matching compatible app', () => {
    const resolver = new TaskAppLaunchResolver();
    const suggestions = resolver.resolve({
      title: 'Entrar a reunion',
      notes: 'https://meet.google.com/abc-defg-hij',
      tags: [],
    });

    expect(suggestions[0].id).toBe('app-google-meet');
    expect(suggestions[0].target).toBe('meeting');
    expect(suggestions[0].fallbackAction?.url).toContain('meet.google.com');
  });

  it('returns a generic external action when there is no supported app match', () => {
    const resolver = new TaskAppLaunchResolver();
    const suggestions = resolver.resolve({
      title: 'Revisar documento',
      notes: 'Abrir https://example.com/propuesta',
      tags: [],
    });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].id).toBe('action-generic-link');
    expect(suggestions[0].app).toBe(null);
  });

  it('can resolve productivity apps by keyword even without an external url', () => {
    const resolver = new TaskAppLaunchResolver();
    const suggestions = resolver.resolve({
      title: 'Responder en slack',
      notes: 'Buscar el hilo del cliente',
      tags: [],
    });

    expect(suggestions[0].id).toBe('app-slack');
    expect(suggestions[0].webFallbackUrl).toContain('slack');
  });

  it('maps explicit phone actions into the phone utility without losing the fallback action', () => {
    const resolver = new TaskAppLaunchResolver();
    const suggestions = resolver.resolve({
      title: 'Llamar a Maria',
      notes: '+1 (312) 555-0199',
      tags: [],
    });

    expect(suggestions[0].id).toBe('app-phone');
    expect(suggestions[0].target).toBe('call');
    expect(suggestions[0].fallbackAction?.url).toContain('tel:');
  });
});
