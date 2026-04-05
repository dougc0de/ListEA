function normalizeText(value) {
  return `${value ?? ''}`.trim();
}

function normalizeTags(tags = []) {
  if (Array.isArray(tags)) return tags.filter(Boolean);
  return `${tags ?? ''}`
    .split(',')
    .map(tag => normalizeText(tag))
    .filter(Boolean);
}

export const TASK_ASSISTANT_SOURCES = Object.freeze({
  TEXT: 'text',
  VOICE: 'voice',
  SCREENSHOT: 'screenshot',
  SHARE: 'share',
  REMINDER: 'reminder',
});

export class TaskAssistantContext {
  constructor({
    sourceType = TASK_ASSISTANT_SOURCES.TEXT,
    rawInput = '',
    transcript = '',
    extractedText = '',
    textInput = '',
    interpretation = null,
    draft = null,
    appSuggestions = [],
    permissions = {},
    capabilities = {},
    result = {},
    metadata = {},
  } = {}) {
    this.sourceType = sourceType;
    this.rawInput = normalizeText(rawInput);
    this.transcript = normalizeText(transcript);
    this.extractedText = normalizeText(extractedText);
    this.textInput = normalizeText(textInput) || this.transcript || this.extractedText || this.rawInput;
    this.interpretation = interpretation;
    this.draft = draft;
    this.appSuggestions = Array.isArray(appSuggestions) ? appSuggestions : [];
    this.permissions = permissions && typeof permissions === 'object' ? permissions : {};
    this.capabilities = capabilities && typeof capabilities === 'object' ? capabilities : {};
    this.result = result && typeof result === 'object' ? result : {};
    this.metadata = metadata && typeof metadata === 'object' ? metadata : {};
  }

  getPrimaryText() {
    return this.textInput || this.transcript || this.extractedText || this.rawInput;
  }

  setTextInput(nextValue = '') {
    this.textInput = normalizeText(nextValue);
    return this;
  }

  setInterpretation(nextInterpretation = null) {
    this.interpretation = nextInterpretation;
    return this;
  }

  setDraft(nextDraft = null) {
    this.draft = nextDraft;
    return this;
  }

  setAppSuggestions(nextSuggestions = []) {
    this.appSuggestions = Array.isArray(nextSuggestions) ? nextSuggestions : [];
    return this;
  }

  mergeResult(patch = {}) {
    this.result = {
      ...this.result,
      ...(patch && typeof patch === 'object' ? patch : {}),
    };
    return this;
  }

  toTaskLike() {
    const draft = this.draft ?? {};
    return {
      title: draft.title || this.interpretation?.title || this.getPrimaryText(),
      notes: draft.notes || this.interpretation?.notes || '',
      project: draft.project || this.interpretation?.project || '',
      area: draft.area || this.interpretation?.area || '',
      tags: normalizeTags(draft.tags || this.interpretation?.tags || []),
    };
  }
}
