import { Capacitor } from '@capacitor/core';
import { AppLauncher } from '@capacitor/app-launcher';
import { AppLaunchIntentRequest, TaskAppLaunchResolver } from '../domain/taskAppLaunch';
import { openTaskExternalAction } from './taskExternalApps';

export class AppLaunchRuntime {
  constructor({ native = false, platform = 'web' } = {}) {
    this.native = Boolean(native);
    this.platform = `${platform ?? 'web'}`.trim() || 'web';
  }
}

export class BrowserPlatformDetector {
  constructor({ userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '' } = {}) {
    this.userAgent = `${userAgent ?? ''}`.trim();
  }

  resolve() {
    if (/android/i.test(this.userAgent)) {
      return 'android';
    }

    if (/(iphone|ipad|ipod)/i.test(this.userAgent)) {
      return 'ios';
    }

    return 'web';
  }
}

export class CapacitorAppLaunchGateway {
  async getRuntime() {
    return new AppLaunchRuntime({
      native: Capacitor.isNativePlatform(),
      platform: Capacitor.getPlatform(),
    });
  }

  async canOpen(target) {
    if (!target) return false;

    try {
      const result = await AppLauncher.canOpenUrl({ url: target });
      return Boolean(result?.value);
    } catch {
      return false;
    }
  }

  async open(target) {
    if (!target) return false;

    try {
      const result = await AppLauncher.openUrl({ url: target });
      return Boolean(result?.completed);
    } catch {
      return false;
    }
  }
}

export class TaskAppLaunchService {
  constructor({
    resolver = new TaskAppLaunchResolver(),
    gateway = new CapacitorAppLaunchGateway(),
    browserPlatformDetector = new BrowserPlatformDetector(),
  } = {}) {
    this.resolver = resolver;
    this.gateway = gateway;
    this.browserPlatformDetector = browserPlatformDetector;
  }

  resolve(task = {}) {
    return this.resolver.resolve(task);
  }

  resolveById(task = {}, suggestionId = '') {
    return this.resolver.resolveById(task, suggestionId);
  }

  resolvePrimary(task = {}) {
    return this.resolver.resolvePrimary(task);
  }

  async resolveNativeTarget(suggestion, runtime = null) {
    if (!suggestion?.app) return null;

    const resolvedRuntime = runtime ?? await this.gateway.getRuntime();
    if (!resolvedRuntime.native) return null;

    const queryTargets = suggestion.app.getQueryTargets(resolvedRuntime.platform);
    for (const queryTarget of queryTargets) {
      if (await this.gateway.canOpen(queryTarget)) {
        const openTarget = suggestion.app.getOpenTarget(resolvedRuntime.platform, suggestion.target);
        if (openTarget) {
          return {
            runtime: resolvedRuntime,
            target: openTarget,
          };
        }
      }
    }

    return null;
  }

  resolveBrowserTarget(suggestion) {
    if (!suggestion?.app) return null;

    const browserPlatform = this.browserPlatformDetector.resolve();
    if (browserPlatform === 'web') return null;

    const target = suggestion.app.getBrowserOpenTarget(
      browserPlatform,
      suggestion.target,
      suggestion.fallbackAction,
    );

    return target
      ? {
        platform: browserPlatform,
        target,
      }
      : null;
  }

  async open(task = {}, {
    suggestionId = '',
    premiumEnabled = false,
    userInitiated = false,
  } = {}) {
    const request = new AppLaunchIntentRequest({
      task,
      suggestionId,
      premiumEnabled,
    });
    const suggestion = request.suggestionId
      ? this.resolveById(request.task, request.suggestionId)
      : this.resolvePrimary(request.task);

    if (!suggestion) {
      return { completed: false, mode: 'none', suggestion: null };
    }

    const canAttemptDirectLaunch = suggestion.supportsNativeLaunch()
      && (request.premiumEnabled || userInitiated);

    if (canAttemptDirectLaunch) {
      const runtime = await this.gateway.getRuntime();
      const nativeTarget = runtime.native
        ? await this.resolveNativeTarget(suggestion, runtime)
        : null;
      if (nativeTarget) {
        const completed = await this.gateway.open(nativeTarget.target);
        return {
          completed,
          mode: completed ? 'native' : 'error',
          suggestion,
        };
      }

      const browserTarget = !runtime.native ? this.resolveBrowserTarget(suggestion) : null;
      if (browserTarget) {
        const completed = openTaskExternalAction(
          { url: browserTarget.target },
          {
            allowCustomScheme: true,
            fallbackUrl: suggestion.webFallbackUrl || suggestion.fallbackAction?.url || '',
          },
        );
        return {
          completed,
          mode: completed ? 'scheme' : 'error',
          suggestion,
        };
      }
    }

    if (suggestion.fallbackAction) {
      const completed = openTaskExternalAction(suggestion.fallbackAction);
      return {
        completed,
        mode: completed ? 'fallback' : 'error',
        suggestion,
      };
    }

    if (suggestion.webFallbackUrl && (request.premiumEnabled || userInitiated)) {
      const completed = openTaskExternalAction({ url: suggestion.webFallbackUrl });
      return {
        completed,
        mode: completed ? 'web' : 'error',
        suggestion,
      };
    }

    return {
      completed: false,
      mode: (request.premiumEnabled || userInitiated) ? 'none' : 'premium-only',
      suggestion,
    };
  }
}
