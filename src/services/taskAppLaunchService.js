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
  } = {}) {
    this.resolver = resolver;
    this.gateway = gateway;
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

  async resolveNativeTarget(suggestion) {
    if (!suggestion?.app) return null;

    const runtime = await this.gateway.getRuntime();
    if (!runtime.native) return null;

    const queryTargets = suggestion.app.getQueryTargets(runtime.platform);
    for (const queryTarget of queryTargets) {
      if (await this.gateway.canOpen(queryTarget)) {
        const openTarget = suggestion.app.getOpenTarget(runtime.platform, suggestion.target);
        if (openTarget) {
          return {
            runtime,
            target: openTarget,
          };
        }
      }
    }

    return null;
  }

  async open(task = {}, { suggestionId = '', premiumEnabled = false } = {}) {
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

    if (request.premiumEnabled && suggestion.supportsNativeLaunch()) {
      const nativeTarget = await this.resolveNativeTarget(suggestion);
      if (nativeTarget) {
        const completed = await this.gateway.open(nativeTarget.target);
        return {
          completed,
          mode: completed ? 'native' : 'error',
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

    if (suggestion.webFallbackUrl && request.premiumEnabled) {
      const completed = openTaskExternalAction({ url: suggestion.webFallbackUrl });
      return {
        completed,
        mode: completed ? 'web' : 'error',
        suggestion,
      };
    }

    return {
      completed: false,
      mode: request.premiumEnabled ? 'none' : 'premium-only',
      suggestion,
    };
  }
}
