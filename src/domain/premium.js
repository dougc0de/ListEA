export class TemplateLibrary {
  constructor() {
    this.templates = [];
  }

  getAll() {
    return this.templates;
  }

  getById(templateId) {
    return this.templates.find(template => template.id === templateId);
  }
}

export class BackupService {
  buildSnapshot({ todos, settings }) {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        todos,
        settings,
      },
      null,
      2,
    );
  }

  download(filename, content) {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}

export class FocusSession {
  constructor() {
    this.startedAt = null;
    this.durationMinutes = 25;
  }

  start(durationMinutes) {
    this.startedAt = Date.now();
    this.durationMinutes = durationMinutes;
  }

  stop() {
    this.startedAt = null;
  }

  isRunning() {
    return this.startedAt !== null;
  }

  getRemainingMs(now = Date.now()) {
    if (!this.isRunning()) {
      return 0;
    }

    const endAt = this.startedAt + this.durationMinutes * 60 * 1000;
    return Math.max(0, endAt - now);
  }
}
