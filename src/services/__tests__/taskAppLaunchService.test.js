import { describe, expect, it, vi } from 'vitest';
vi.mock('../taskExternalApps', () => ({
  openTaskExternalAction: vi.fn(() => true),
}));

import { AppLaunchRuntime, TaskAppLaunchService } from '../taskAppLaunchService';
import { ResolvedAppLaunchAction, SupportedMobileAppDescriptor } from '../../domain/taskAppLaunch';
import { openTaskExternalAction } from '../taskExternalApps';

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
  it('opens the exact suggestion requested instead of falling back to the primary app', async () => {
    const linkedInSuggestion = new ResolvedAppLaunchAction({
      id: 'app-linkedin',
      label: 'Abrir LinkedIn',
      target: 'home',
      webFallbackUrl: 'https://www.linkedin.com/',
      matchSource: 'task',
      app: new SupportedMobileAppDescriptor({
        id: 'linkedin',
        label: 'LinkedIn',
        keywords: ['linkedin'],
        category: 'social',
        premium: true,
        targets: ['home'],
        platforms: {
          android: {
            packageName: 'com.linkedin.android',
            schemes: ['linkedin'],
            browserOpen: {
              home: 'linkedin://feed',
            },
            open: {
              home: 'com.linkedin.android',
            },
          },
        },
        fallback: {
          url: 'https://www.linkedin.com/',
        },
      }),
    });
    const instagramSuggestion = new ResolvedAppLaunchAction({
      id: 'app-instagram',
      label: 'Abrir Instagram',
      target: 'home',
      webFallbackUrl: 'https://www.instagram.com/',
      matchSource: 'task',
      app: new SupportedMobileAppDescriptor({
        id: 'instagram',
        label: 'Instagram',
        keywords: ['instagram'],
        category: 'social',
        premium: true,
        targets: ['home'],
        platforms: {
          android: {
            packageName: 'com.instagram.android',
            schemes: ['instagram'],
            browserOpen: {
              home: 'instagram://app',
            },
            open: {
              home: 'com.instagram.android',
            },
          },
        },
        fallback: {
          url: 'https://www.instagram.com/',
        },
      }),
    });
    const resolver = {
      resolve: vi.fn().mockReturnValue([linkedInSuggestion, instagramSuggestion]),
      resolvePrimary: vi.fn().mockReturnValue(linkedInSuggestion),
      resolveById: vi.fn((task, suggestionId) => (
        suggestionId === 'app-instagram' ? instagramSuggestion : linkedInSuggestion
      )),
    };
    const gateway = {
      getRuntime: vi.fn().mockResolvedValue(new AppLaunchRuntime({ native: false, platform: 'web' })),
      canOpen: vi.fn(),
      open: vi.fn(),
    };
    const browserPlatformDetector = {
      resolve: vi.fn().mockReturnValue('android'),
    };

    const service = new TaskAppLaunchService({ resolver, gateway, browserPlatformDetector });
    const result = await service.open(
      { title: 'Revisar LinkedIn y luego Instagram' },
      { suggestionId: 'app-instagram', premiumEnabled: true, userInitiated: true },
    );

    expect(result.completed).toBe(true);
    expect(result.suggestion.id).toBe('app-instagram');
    expect(openTaskExternalAction).toHaveBeenCalledWith(
      { url: 'instagram://app' },
      { allowCustomScheme: true, fallbackUrl: 'https://www.instagram.com/' },
    );
  });

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

  it('prefers a mobile browser scheme launch before the web fallback when premium is enabled', async () => {
    const fallbackAction = {
      id: 'whatsapp',
      label: 'WhatsApp',
      url: 'https://wa.me/?text=hola',
    };
    const suggestion = new ResolvedAppLaunchAction({
      id: 'app-whatsapp',
      label: 'Abrir WhatsApp',
      target: 'chat',
      fallbackAction,
      webFallbackUrl: 'https://wa.me/?text=hola',
      matchSource: 'action',
      app: new SupportedMobileAppDescriptor({
        id: 'whatsapp',
        label: 'WhatsApp',
        keywords: ['whatsapp'],
        category: 'messaging',
        premium: true,
        targets: ['home', 'chat'],
        platforms: {
          ios: {
            schemes: ['whatsapp'],
            browserOpen: {
              home: 'whatsapp://',
              chat: 'whatsapp://send',
            },
            open: {
              home: 'whatsapp://',
              chat: 'whatsapp://send',
            },
          },
          android: {
            packageName: 'com.whatsapp',
            schemes: ['whatsapp'],
            browserOpen: {
              home: 'whatsapp://',
              chat: 'whatsapp://send',
            },
            open: {
              home: 'com.whatsapp',
              chat: 'whatsapp://send',
            },
          },
        },
        fallback: {
          url: 'https://wa.me/',
        },
      }),
    });
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
    const browserPlatformDetector = {
      resolve: vi.fn().mockReturnValue('android'),
    };

    const service = new TaskAppLaunchService({ resolver, gateway, browserPlatformDetector });
    const result = await service.open({ title: 'Mandar mensaje por WhatsApp' }, { premiumEnabled: true });

    expect(result.completed).toBe(true);
    expect(result.mode).toBe('scheme');
    expect(openTaskExternalAction).toHaveBeenCalledWith(
      { url: 'whatsapp://send?text=hola' },
      { allowCustomScheme: true, fallbackUrl: 'https://wa.me/?text=hola' },
    );
  });

  it('allows a user-initiated task mention launch to try the app directly even on free', async () => {
    const suggestion = new ResolvedAppLaunchAction({
      id: 'app-instagram',
      label: 'Abrir Instagram',
      target: 'home',
      fallbackAction: null,
      webFallbackUrl: 'https://www.instagram.com/',
      matchSource: 'task',
      app: new SupportedMobileAppDescriptor({
        id: 'instagram',
        label: 'Instagram',
        keywords: ['instagram'],
        category: 'social',
        premium: true,
        targets: ['home'],
        platforms: {
          android: {
            packageName: 'com.instagram.android',
            schemes: ['instagram'],
            browserOpen: {
              home: 'instagram://app',
            },
            open: {
              home: 'com.instagram.android',
            },
          },
        },
        fallback: {
          url: 'https://www.instagram.com/',
        },
      }),
    });
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
    const browserPlatformDetector = {
      resolve: vi.fn().mockReturnValue('android'),
    };

    const service = new TaskAppLaunchService({ resolver, gateway, browserPlatformDetector });
    const result = await service.open(
      { title: 'Revisar Instagram' },
      { premiumEnabled: false, userInitiated: true },
    );

    expect(result.completed).toBe(true);
    expect(result.mode).toBe('scheme');
    expect(openTaskExternalAction).toHaveBeenCalledWith(
      { url: 'instagram://app' },
      { allowCustomScheme: true, fallbackUrl: 'https://www.instagram.com/' },
    );
  });

  it('uses the native runtime target for Android when a specific suggestion is requested', async () => {
    const resolver = {
      resolve: vi.fn(),
      resolvePrimary: vi.fn(),
      resolveById: vi.fn().mockReturnValue(new ResolvedAppLaunchAction({
        id: 'app-whatsapp',
        label: 'Abrir WhatsApp',
        target: 'chat',
        webFallbackUrl: 'https://wa.me/',
        matchSource: 'task',
        app: new SupportedMobileAppDescriptor({
          id: 'whatsapp',
          label: 'WhatsApp',
          keywords: ['whatsapp'],
          category: 'messaging',
          premium: true,
          targets: ['home', 'chat'],
          platforms: {
            android: {
              packageName: 'com.whatsapp',
              schemes: ['whatsapp'],
              open: {
                home: 'com.whatsapp',
                chat: 'whatsapp://send',
              },
            },
          },
          fallback: {
            url: 'https://wa.me/',
          },
        }),
      })),
    };
    const gateway = {
      getRuntime: vi.fn().mockResolvedValue(new AppLaunchRuntime({ native: true, platform: 'android' })),
      canOpen: vi.fn().mockResolvedValue(true),
      open: vi.fn().mockResolvedValue(true),
    };

    const service = new TaskAppLaunchService({ resolver, gateway });
    const result = await service.open(
      { title: 'Mandar mensaje por WhatsApp' },
      { suggestionId: 'app-whatsapp', premiumEnabled: true, userInitiated: true },
    );

    expect(result.completed).toBe(true);
    expect(result.mode).toBe('native');
    expect(gateway.canOpen).toHaveBeenCalledWith('com.whatsapp');
    expect(gateway.open).toHaveBeenCalledWith('whatsapp://send');
  });
});
