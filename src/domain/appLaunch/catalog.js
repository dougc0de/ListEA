import supportedApps from './supportedApps.json';

export const LAUNCH_TARGETS = Object.freeze({
  HOME: 'home',
  MEETING: 'meeting',
  COMPOSE: 'compose',
  CHAT: 'chat',
  CALL: 'call',
  SMS: 'sms',
  MAP: 'map',
  WEB: 'web',
});

const KNOWN_TARGETS = new Set(Object.values(LAUNCH_TARGETS));

function normalizeText(value) {
  return `${value ?? ''}`.trim();
}

function escapeForRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildKeywordPattern(keywords = []) {
  const normalizedKeywords = keywords
    .map(keyword => normalizeText(keyword).toLowerCase())
    .filter(Boolean)
    .map(escapeForRegex);

  if (!normalizedKeywords.length) return null;
  return new RegExp(`(?:^|\\b)(?:${normalizedKeywords.join('|')})(?:\\b|$)`, 'i');
}

function buildTaskSearchText(task = {}) {
  const tags = Array.isArray(task.tags) ? task.tags.join(' ') : `${task.tags ?? ''}`;
  return [
    `${task.title ?? ''}`,
    `${task.notes ?? ''}`,
    `${task.project ?? ''}`,
    `${task.area ?? ''}`,
    tags,
  ]
    .join('\n')
    .trim();
}

function normalizeSearchText(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeTarget(target) {
  return KNOWN_TARGETS.has(target) ? target : LAUNCH_TARGETS.HOME;
}

function normalizePlatformHint(platform = 'web') {
  return ['android', 'ios'].includes(`${platform ?? ''}`.trim()) ? `${platform}`.trim() : 'web';
}

function buildSchemeUrl(scheme = '') {
  const normalizedScheme = normalizeText(scheme);
  if (!normalizedScheme) return '';
  if (normalizedScheme.includes(':')) return normalizedScheme;
  if (['tel', 'sms', 'mailto'].includes(normalizedScheme)) {
    return `${normalizedScheme}:`;
  }
  return `${normalizedScheme}://`;
}

function getHostFromUrl(value = '') {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function buildUrlWithParams(baseUrl, params = {}) {
  const entries = Object.entries(params).filter(([, value]) => `${value ?? ''}`.trim());
  if (!entries.length) return baseUrl;
  const search = new URLSearchParams(entries);
  return `${baseUrl}?${search.toString()}`;
}

function buildTargetLabel(target, label) {
  const normalizedTarget = normalizeTarget(target);
  if (normalizedTarget === LAUNCH_TARGETS.MEETING) return `Entrar en ${label}`;
  if (normalizedTarget === LAUNCH_TARGETS.COMPOSE) return `Redactar en ${label}`;
  return `Abrir ${label}`;
}

export class AppLaunchIntentRequest {
  constructor({
    task = {},
    suggestionId = '',
    premiumEnabled = false,
  } = {}) {
    this.task = task ?? {};
    this.suggestionId = `${suggestionId ?? ''}`.trim();
    this.premiumEnabled = Boolean(premiumEnabled);
  }
}

export class SupportedMobileAppDescriptor {
  constructor(config = {}) {
    this.id = normalizeText(config.id);
    this.label = normalizeText(config.label);
    this.category = normalizeText(config.category);
    this.premium = Boolean(config.premium);
    this.keywords = Array.isArray(config.keywords) ? config.keywords.map(keyword => normalizeText(keyword)).filter(Boolean) : [];
    this.keywordPattern = buildKeywordPattern(this.keywords);
    this.actionIds = Array.isArray(config.actionIds) ? config.actionIds.map(actionId => normalizeText(actionId)) : [];
    this.urlHosts = Array.isArray(config.urlHosts) ? config.urlHosts.map(host => normalizeText(host).toLowerCase()).filter(Boolean) : [];
    this.targets = new Set(Array.isArray(config.targets) ? config.targets.map(target => normalizeTarget(target)) : [LAUNCH_TARGETS.HOME]);
    this.platforms = config.platforms && typeof config.platforms === 'object' ? config.platforms : {};
    this.fallback = config.fallback && typeof config.fallback === 'object' ? config.fallback : {};
  }

  matchesTask(task = {}) {
    return this.getTaskMatchIndex(task) !== -1;
  }

  getTaskMatchIndex(task = {}) {
    if (!this.keywords.length) return -1;

    const searchText = buildTaskSearchText(task);
    if (!searchText) return -1;

    const matchIndexes = this.keywords
      .map(keyword => searchText.search(new RegExp(`(?:^|\\b)${escapeForRegex(normalizeSearchText(keyword))}(?:\\b|$)`, 'i')))
      .filter(index => index >= 0);

    if (!matchIndexes.length) {
      return -1;
    }

    return Math.min(...matchIndexes);
  }

  matchesAction(action = {}) {
    if (!action) return false;

    const actionUrl = `${action.url ?? ''}`.toLowerCase();
    if (actionUrl && this.urlHosts.some(host => actionUrl.includes(host))) {
      return true;
    }

    return this.actionIds.includes(`${action.id ?? ''}`.trim());
  }

  matchesActionUrl(action = {}) {
    const actionUrl = `${action.url ?? ''}`.toLowerCase();
    return Boolean(actionUrl && this.urlHosts.some(host => actionUrl.includes(host)));
  }

  matchesActionId(action = {}) {
    return this.actionIds.includes(`${action.id ?? ''}`.trim());
  }

  supportsTarget(target = LAUNCH_TARGETS.HOME) {
    return this.targets.has(normalizeTarget(target));
  }

  buildLabel(target = LAUNCH_TARGETS.HOME) {
    return buildTargetLabel(target, this.label);
  }

  getQueryTargets(platform = 'web') {
    const platformConfig = this.platforms?.[platform] ?? {};
    const schemes = Array.isArray(platformConfig.schemes) ? platformConfig.schemes : [];
    const queryTargets = [];

    if (platform === 'android' && platformConfig.packageName) {
      queryTargets.push(platformConfig.packageName);
    }

    schemes.forEach(scheme => {
      const normalizedScheme = normalizeText(scheme);
      if (!normalizedScheme) return;
      queryTargets.push(normalizedScheme.includes('://') ? normalizedScheme : `${normalizedScheme}://`);
    });

    return queryTargets.filter(Boolean);
  }

  getOpenTarget(platform = 'web', target = LAUNCH_TARGETS.HOME) {
    const platformConfig = this.platforms?.[platform] ?? {};
    const openTargets = platformConfig.open && typeof platformConfig.open === 'object'
      ? platformConfig.open
      : {};
    const normalizedTarget = normalizeTarget(target);
    const explicitTarget = normalizeText(openTargets[normalizedTarget] ?? '');
    if (explicitTarget) return explicitTarget;

    const homeTarget = normalizeText(openTargets[LAUNCH_TARGETS.HOME] ?? '');
    if (homeTarget) return homeTarget;

    if (platform === 'android' && platformConfig.packageName) {
      return normalizeText(platformConfig.packageName);
    }

    const schemes = Array.isArray(platformConfig.schemes) ? platformConfig.schemes : [];
    const firstScheme = normalizeText(schemes[0] ?? '');
    return buildSchemeUrl(firstScheme);
  }

  getBrowserOpenTarget(platform = 'web', target = LAUNCH_TARGETS.HOME, fallbackAction = null) {
    const normalizedPlatform = normalizePlatformHint(platform);
    if (normalizedPlatform === 'web') return '';

    const platformConfig = this.platforms?.[normalizedPlatform] ?? {};
    const browserOpenTargets = platformConfig.browserOpen && typeof platformConfig.browserOpen === 'object'
      ? platformConfig.browserOpen
      : {};
    const normalizedTarget = normalizeTarget(target);
    const browserTarget = normalizeText(
      browserOpenTargets[normalizedTarget]
      ?? browserOpenTargets[LAUNCH_TARGETS.HOME]
      ?? '',
    );
    const openTarget = browserTarget || this.getOpenTarget(normalizedPlatform, normalizedTarget);
    const schemeCandidates = Array.isArray(platformConfig.schemes) ? platformConfig.schemes : [];
    const fallbackScheme = buildSchemeUrl(schemeCandidates[0] ?? '');
    const resolvedTarget = /^[a-z][a-z0-9+.-]*:/i.test(openTarget)
      ? openTarget
      : (fallbackScheme || '');

    if (!resolvedTarget) {
      return '';
    }

    const fallbackUrl = normalizeText(fallbackAction?.url ?? '');
    if (!fallbackUrl) {
      return resolvedTarget;
    }

    if (this.id === 'whatsapp') {
      try {
        const parsedFallbackUrl = new URL(fallbackUrl);
        const rawPhone = parsedFallbackUrl.pathname.replace(/\//g, '').trim();
        const text = parsedFallbackUrl.searchParams.get('text') ?? '';
        if (normalizeTarget(target) === LAUNCH_TARGETS.CHAT) {
          return buildUrlWithParams(resolvedTarget, {
            phone: rawPhone,
            text,
          });
        }
      } catch {
        return resolvedTarget;
      }
    }

    try {
      const parsedFallbackUrl = new URL(fallbackUrl);
      return parsedFallbackUrl.search
        ? `${resolvedTarget}${parsedFallbackUrl.search}`
        : resolvedTarget;
    } catch {
      return resolvedTarget;
    }
  }

  hasNativeTargets(target = LAUNCH_TARGETS.HOME) {
    return Boolean(this.getOpenTarget('ios', target) || this.getOpenTarget('android', target));
  }

  getFallbackUrl(target = LAUNCH_TARGETS.HOME) {
    const fallbackTargets = this.fallback.targets && typeof this.fallback.targets === 'object'
      ? this.fallback.targets
      : {};
    const normalizedTarget = normalizeTarget(target);
    return normalizeText(
      fallbackTargets[normalizedTarget]
      ?? this.fallback.url
      ?? this.platforms?.web?.open?.[normalizedTarget]
      ?? this.platforms?.web?.open?.[LAUNCH_TARGETS.HOME]
      ?? '',
    );
  }

  resolveTargetForAction(action = {}) {
    const actionId = `${action.id ?? ''}`.trim();
    const actionHost = getHostFromUrl(action.url);

    if (actionId === 'meeting-link') {
      return this.supportsTarget(LAUNCH_TARGETS.MEETING) ? LAUNCH_TARGETS.MEETING : LAUNCH_TARGETS.HOME;
    }

    if (actionId === 'whatsapp') {
      return this.supportsTarget(LAUNCH_TARGETS.CHAT) ? LAUNCH_TARGETS.CHAT : LAUNCH_TARGETS.HOME;
    }

    if (actionId === 'email' || actionId === 'calendar') {
      return this.supportsTarget(LAUNCH_TARGETS.COMPOSE) ? LAUNCH_TARGETS.COMPOSE : LAUNCH_TARGETS.HOME;
    }

    if (actionId === 'call') {
      return this.supportsTarget(LAUNCH_TARGETS.CALL) ? LAUNCH_TARGETS.CALL : LAUNCH_TARGETS.HOME;
    }

    if (actionId === 'sms') {
      return this.supportsTarget(LAUNCH_TARGETS.SMS) ? LAUNCH_TARGETS.SMS : LAUNCH_TARGETS.HOME;
    }

    if (actionId === 'generic-link') {
      if (actionHost && this.category === 'meeting' && this.supportsTarget(LAUNCH_TARGETS.MEETING)) {
        return LAUNCH_TARGETS.MEETING;
      }

      if (actionHost && this.category === 'maps' && this.supportsTarget(LAUNCH_TARGETS.MAP)) {
        return LAUNCH_TARGETS.MAP;
      }

      if (actionHost && this.category === 'calendar' && this.supportsTarget(LAUNCH_TARGETS.COMPOSE)) {
        return LAUNCH_TARGETS.COMPOSE;
      }
    }

    return LAUNCH_TARGETS.HOME;
  }

  resolveTargetForTask() {
    return LAUNCH_TARGETS.HOME;
  }
}

export class ResolvedAppLaunchAction {
  constructor({
    id,
    label,
    app = null,
    target = LAUNCH_TARGETS.HOME,
    fallbackAction = null,
    webFallbackUrl = '',
    matchSource = 'task',
  } = {}) {
    this.id = normalizeText(id);
    this.label = normalizeText(label);
    this.app = app instanceof SupportedMobileAppDescriptor ? app : null;
    this.target = normalizeTarget(target);
    this.fallbackAction = fallbackAction ?? null;
    this.webFallbackUrl = normalizeText(webFallbackUrl);
    this.matchSource = normalizeText(matchSource) || 'task';
  }

  supportsNativeLaunch() {
    return Boolean(this.app?.hasNativeTargets(this.target));
  }
}

export class SupportedMobileAppCatalog {
  constructor(apps = supportedApps) {
    this.apps = Array.isArray(apps)
      ? apps.map(app => (app instanceof SupportedMobileAppDescriptor ? app : new SupportedMobileAppDescriptor(app)))
      : [];
  }

  getAll() {
    return this.apps;
  }

  findByAction(action = {}) {
    return this.apps.find(app => app.matchesActionUrl(action))
      ?? this.apps.find(app => app.matchesActionId(action))
      ?? null;
  }

  findAllByTask(task = {}) {
    return this.apps
      .filter(app => app.matchesTask(task))
      .sort((left, right) => left.getTaskMatchIndex(task) - right.getTaskMatchIndex(task));
  }
}
