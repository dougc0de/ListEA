import { TaskExternalActionResolver } from '../taskExternalActions';
import {
  LAUNCH_TARGETS,
  ResolvedAppLaunchAction,
  SupportedMobileAppCatalog,
} from './catalog';

function dedupeSuggestions(suggestions = []) {
  const seenKeys = new Set();
  return suggestions.filter(suggestion => {
    const key = suggestion.app ? `app:${suggestion.app.id}` : `action:${suggestion.id}`;
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });
}

function buildGenericActionSuggestion(action) {
  return new ResolvedAppLaunchAction({
    id: `action-${action.id}`,
    label: action.label,
    app: null,
    target: LAUNCH_TARGETS.WEB,
    fallbackAction: action,
    webFallbackUrl: action.url,
    matchSource: 'action',
  });
}

function buildAppSuggestionFromAction(app, action) {
  const target = app.resolveTargetForAction(action);
  return new ResolvedAppLaunchAction({
    id: `app-${app.id}`,
    label: app.buildLabel(target),
    app,
    target,
    fallbackAction: action,
    webFallbackUrl: action.url || app.getFallbackUrl(target),
    matchSource: 'action',
  });
}

function buildAppSuggestionFromTask(app) {
  const target = app.resolveTargetForTask();
  return new ResolvedAppLaunchAction({
    id: `app-${app.id}`,
    label: app.buildLabel(target),
    app,
    target,
    fallbackAction: null,
    webFallbackUrl: app.getFallbackUrl(target),
    matchSource: 'task',
  });
}

export class TaskAppLaunchResolver {
  constructor({
    appCatalog = new SupportedMobileAppCatalog(),
    actionResolver = new TaskExternalActionResolver(),
  } = {}) {
    this.appCatalog = appCatalog;
    this.actionResolver = actionResolver;
  }

  resolve(task = {}) {
    const fallbackActions = this.actionResolver.resolve(task);
    const actionMatchedApps = [];
    const genericActions = [];

    for (const action of fallbackActions) {
      const matchedApp = this.appCatalog.findByAction(action);
      if (matchedApp) {
        actionMatchedApps.push(buildAppSuggestionFromAction(matchedApp, action));
        continue;
      }

      genericActions.push(buildGenericActionSuggestion(action));
    }

    const taskMatchedApps = this.appCatalog.findAllByTask(task).map(app => buildAppSuggestionFromTask(app));

    return dedupeSuggestions([
      ...actionMatchedApps,
      ...taskMatchedApps,
      ...genericActions,
    ]).slice(0, 4);
  }

  resolveById(task = {}, suggestionId = '') {
    return this.resolve(task).find(suggestion => suggestion.id === suggestionId) ?? null;
  }

  resolvePrimary(task = {}) {
    return this.resolve(task)[0] ?? null;
  }
}
