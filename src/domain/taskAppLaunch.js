import { TaskExternalActionResolver } from './taskExternalActions';

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

export class SupportedMobileAppDescriptor {
  constructor({
    id,
    label,
    keywordPattern = null,
    actionIds = [],
    urlHosts = [],
    iosScheme = '',
    androidPackage = '',
    webFallbackUrl = '',
  } = {}) {
    this.id = `${id ?? ''}`.trim();
    this.label = `${label ?? ''}`.trim();
    this.keywordPattern = keywordPattern instanceof RegExp ? keywordPattern : null;
    this.actionIds = Array.isArray(actionIds) ? actionIds : [];
    this.urlHosts = Array.isArray(urlHosts) ? urlHosts : [];
    this.iosScheme = `${iosScheme ?? ''}`.trim();
    this.androidPackage = `${androidPackage ?? ''}`.trim();
    this.webFallbackUrl = `${webFallbackUrl ?? ''}`.trim();
  }

  matchesTask(task) {
    if (!this.keywordPattern) return false;
    return this.keywordPattern.test(buildTaskSearchText(task));
  }

  matchesAction(action) {
    if (!action) return false;

    if (this.actionIds.includes(action.id)) {
      return true;
    }

    const actionUrl = `${action.url ?? ''}`.toLowerCase();
    return this.urlHosts.some(host => actionUrl.includes(host));
  }

  getQueryTargets(platform) {
    if (platform === 'ios') {
      return this.iosScheme ? [`${this.iosScheme}://`] : [];
    }

    if (platform === 'android') {
      return [
        this.androidPackage || '',
        this.iosScheme ? `${this.iosScheme}://` : '',
      ].filter(Boolean);
    }

    return [];
  }

  getOpenTarget(platform) {
    if (platform === 'ios') {
      return this.iosScheme ? `${this.iosScheme}://` : '';
    }

    if (platform === 'android') {
      return this.androidPackage || (this.iosScheme ? `${this.iosScheme}://` : '');
    }

    return '';
  }

  hasNativeTargets() {
    return Boolean(this.iosScheme || this.androidPackage);
  }
}

export class TaskAppLaunchSuggestion {
  constructor({
    id,
    label,
    app = null,
    fallbackAction = null,
    webFallbackUrl = '',
  } = {}) {
    this.id = `${id ?? ''}`.trim();
    this.label = `${label ?? ''}`.trim();
    this.app = app instanceof SupportedMobileAppDescriptor ? app : null;
    this.fallbackAction = fallbackAction ?? null;
    this.webFallbackUrl = `${webFallbackUrl ?? ''}`.trim();
  }

  supportsNativeLaunch() {
    return Boolean(this.app?.hasNativeTargets());
  }
}

const DEFAULT_SUPPORTED_APPS = Object.freeze([
  new SupportedMobileAppDescriptor({
    id: 'whatsapp',
    label: 'WhatsApp',
    keywordPattern: /\b(whatsapp|wsp|wa)\b/i,
    actionIds: ['whatsapp'],
    iosScheme: 'whatsapp',
    androidPackage: 'com.whatsapp',
    webFallbackUrl: 'https://wa.me/',
  }),
  new SupportedMobileAppDescriptor({
    id: 'telegram',
    label: 'Telegram',
    keywordPattern: /\b(telegram|tg)\b/i,
    iosScheme: 'tg',
    androidPackage: 'org.telegram.messenger',
    webFallbackUrl: 'https://t.me/',
  }),
  new SupportedMobileAppDescriptor({
    id: 'slack',
    label: 'Slack',
    keywordPattern: /\bslack\b/i,
    iosScheme: 'slack',
    androidPackage: 'com.Slack',
    webFallbackUrl: 'https://app.slack.com/client',
  }),
  new SupportedMobileAppDescriptor({
    id: 'gmail',
    label: 'Gmail',
    keywordPattern: /\bgmail\b/i,
    iosScheme: 'googlegmail',
    androidPackage: 'com.google.android.gm',
    webFallbackUrl: 'https://mail.google.com/',
  }),
  new SupportedMobileAppDescriptor({
    id: 'outlook',
    label: 'Outlook',
    keywordPattern: /\boutlook\b/i,
    iosScheme: 'ms-outlook',
    androidPackage: 'com.microsoft.office.outlook',
    webFallbackUrl: 'https://outlook.office.com/mail/',
  }),
  new SupportedMobileAppDescriptor({
    id: 'teams',
    label: 'Teams',
    keywordPattern: /\b(microsoft teams|teams)\b/i,
    urlHosts: ['teams.microsoft.com'],
    iosScheme: 'msteams',
    androidPackage: 'com.microsoft.teams',
    webFallbackUrl: 'https://teams.microsoft.com/',
  }),
  new SupportedMobileAppDescriptor({
    id: 'zoom',
    label: 'Zoom',
    keywordPattern: /\bzoom\b/i,
    urlHosts: ['zoom.us'],
    iosScheme: 'zoomus',
    androidPackage: 'us.zoom.videomeetings',
    webFallbackUrl: 'https://zoom.us/',
  }),
]);

export class SupportedMobileAppCatalog {
  constructor(apps = DEFAULT_SUPPORTED_APPS) {
    this.apps = Array.isArray(apps) ? apps : [];
  }

  getAll() {
    return this.apps;
  }

  findByAction(action) {
    return this.apps.find(app => app.matchesAction(action)) ?? null;
  }

  findAllByTask(task) {
    return this.apps.filter(app => app.matchesTask(task));
  }
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
    const suggestions = [];
    const seenIds = new Set();

    for (const action of fallbackActions) {
      const app = this.appCatalog.findByAction(action);
      const suggestion = new TaskAppLaunchSuggestion({
        id: app ? `app-${app.id}` : `action-${action.id}`,
        label: app ? `Abrir ${app.label}` : action.label,
        app,
        fallbackAction: action,
        webFallbackUrl: app?.webFallbackUrl ?? '',
      });

      if (!seenIds.has(suggestion.id)) {
        suggestions.push(suggestion);
        seenIds.add(suggestion.id);
      }
    }

    for (const app of this.appCatalog.findAllByTask(task)) {
      const suggestion = new TaskAppLaunchSuggestion({
        id: `app-${app.id}`,
        label: `Abrir ${app.label}`,
        app,
        webFallbackUrl: app.webFallbackUrl,
      });

      if (!seenIds.has(suggestion.id)) {
        suggestions.push(suggestion);
        seenIds.add(suggestion.id);
      }
    }

    return suggestions.slice(0, 4);
  }

  resolveById(task = {}, suggestionId = '') {
    return this.resolve(task).find(suggestion => suggestion.id === suggestionId) ?? null;
  }

  resolvePrimary(task = {}) {
    return this.resolve(task)[0] ?? null;
  }
}
