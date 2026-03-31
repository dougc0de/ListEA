import { describe, expect, it, vi } from 'vitest';
vi.mock('../taskExternalApps', () => ({
  openTaskExternalAction: vi.fn(() => true),
}));

import { AppLaunchRuntime, TaskAppLaunchService } from '../taskAppLaunchService';
import { ResolvedAppLaunchAction, SupportedMobileAppDescriptor } from '../../domain/taskAppLaunch';

function createSuggestion({
  id = 'app-slack',
  label = 'Abrir Slack',
  target = 'home',
  fallbackAction = null,
  webFallbackUrl = 'https://app.slack.com/client',
} = {}) {
  return new ResolvedAppLaunchAction({
    id,
    label,
    target,
    fallbackAction,
    webFallbackUrl,
    matchSource: fallbackAction ? 'action' : 'task',
    app: new SupportedMobileAppDescriptor({
      id: 'slack',
      label: 'Slack',
      keywords: ['slack'],
      category: 'messaging',
      premium: true,
      targets: ['home'],
      platforms: {
        ios: {
          schemes: ['slack'],
          open: {
            home: 'slack://',
          },
        },
      },
      fallback: {
        url: 'https://app.slack.com/client',
      },
    }),
  });
}

describe('TaskAppLaunchService', () => {
  it('keeps task mention launches premium-only when there is no explicit fallback action', async () => {
    const suggestion = createSuggestion();
    const resolver = {
      resolve: vi.fn().mockReturnValue([suggestion]),
      resolvePrimary: vi.fn().mockReturnValue(suggestion),
      resolveById: vi.fn().mockReturnValue(null),
    };
    const gateway = {
      getRuntime: vi.fn().mockResolvedValue(new AppLaunchRuntime({ native: false, platform: 'web' })),
      canOpen: vi.fn(),
      open: vi.fn(),
    };

    const service = new TaskAppLaunchService({ resolver, gateway });
    const result = await service.open({ title: 'Revisar slack' }, { premiumEnabled: false });

    expect(result.completed).toBe(false);
    expect(result.mode).toBe('premium-only');
  });

  it('uses explicit fallback actions even when premium is disabled', async () => {
    const fallbackAction = {
      id: 'generic-link',
      label: 'Abrir enlace',
      url: 'https://app.slack.com/client/T1',
    };
    const suggestion = createSuggestion({ fallbackAction });
    const resolver = {
      resolve: vi.fn().mockReturnValue([suggestion]),
      resolvePrimary: vi.fn().mockReturnValue(suggestion),
      resolveById: vi.fn().mockReturnValue(null),
    };
    const gateway = {
      getRuntime: vi.fn().mockResolvedValue(new AppLaunchRuntime({ native: false, platform: 'web' })),
      canOpen: vi.fn(),
      open: vi.fn(),
    };

    const service = new TaskAppLaunchService({ resolver, gateway });
    const result = await service.open({ title: 'Abrir slack' }, { premiumEnabled: false });

    expect(result.completed).toBe(true);
    expect(result.mode).toBe('fallback');
  });
});
