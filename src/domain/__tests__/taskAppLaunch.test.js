import { describe, expect, it } from 'vitest';
import { TaskAppLaunchResolver } from '../taskAppLaunch';

describe('TaskAppLaunchResolver', () => {
  it('maps a WhatsApp task to a launch suggestion', () => {
    const resolver = new TaskAppLaunchResolver();
    const suggestions = resolver.resolve({
      title: 'Mandar mensaje por whatsapp',
      notes: 'Confirmar la reunion de manana',
      tags: [],
    });

    expect(suggestions[0].id).toBe('app-whatsapp');
    expect(suggestions[0].label).toBe('Abrir WhatsApp');
    expect(suggestions[0].app?.id).toBe('whatsapp');
  });

  it('keeps actionable external links available through app suggestions', () => {
    const resolver = new TaskAppLaunchResolver();
    const suggestions = resolver.resolve({
      title: 'Entrar a reunion',
      notes: 'https://zoom.us/j/123456789',
      tags: [],
    });

    expect(suggestions[0].id).toBe('app-zoom');
    expect(suggestions[0].fallbackAction?.url).toContain('zoom.us');
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
});
