import { TaskAppLaunchResolver } from '../taskAppLaunch';
import { CAPTURE_SOURCES } from '../tasks';
import { QuickCaptureInterpreter } from '../quickCapture';
import { TaskAssistantAgent } from './agent';
import { TASK_ASSISTANT_SOURCES } from './context';

function mapSourceToCaptureSource(sourceType) {
  if (sourceType === TASK_ASSISTANT_SOURCES.VOICE) return CAPTURE_SOURCES.VOICE;
  if (sourceType === TASK_ASSISTANT_SOURCES.SCREENSHOT) return CAPTURE_SOURCES.SCREENSHOT;
  if (sourceType === TASK_ASSISTANT_SOURCES.SHARE) return CAPTURE_SOURCES.SHARE;
  return CAPTURE_SOURCES.MANUAL;
}

export class VoiceCaptureAgent extends TaskAssistantAgent {
  canHandle(context) {
    return context?.sourceType === TASK_ASSISTANT_SOURCES.VOICE;
  }

  async execute(context) {
    context.setTextInput(context.transcript || context.rawInput);
    context.mergeResult({ captureMode: TASK_ASSISTANT_SOURCES.VOICE });
    return context;
  }
}

export class ScreenshotCaptureAgent extends TaskAssistantAgent {
  canHandle(context) {
    return context?.sourceType === TASK_ASSISTANT_SOURCES.SCREENSHOT;
  }

  async execute(context) {
    context.setTextInput(context.extractedText || context.rawInput);
    context.mergeResult({ captureMode: TASK_ASSISTANT_SOURCES.SCREENSHOT });
    return context;
  }
}

export class TextStructuringAgent extends TaskAssistantAgent {
  constructor({ interpreter = new QuickCaptureInterpreter() } = {}) {
    super();
    this.interpreter = interpreter;
  }

  canHandle(context) {
    return Boolean(context?.getPrimaryText?.());
  }

  async execute(context) {
    const text = context.getPrimaryText();
    const interpretation = this.interpreter.interpret(text);
    const title = interpretation.title || text.split('\n')[0]?.trim() || '';

    context.setInterpretation(interpretation);
    context.setDraft({
      title,
      notes: interpretation.notes || '',
      project: interpretation.project || '',
      area: interpretation.area || '',
      dueAt: interpretation.dueAt,
      dueAtPrecision: interpretation.dueAtPrecision,
      followUpAt: interpretation.followUpAt,
      followUpAtPrecision: interpretation.followUpAtPrecision,
      priority: interpretation.priority,
      status: interpretation.status,
      tags: interpretation.tags,
      effortMinutes: interpretation.effortMinutes || 20,
      source: mapSourceToCaptureSource(context.sourceType),
      capturedAt: context.metadata?.capturedAt || new Date().toISOString(),
      needsTriage: false,
      recurrence: interpretation.recurrence,
    });
    return context;
  }
}

export class AppLaunchAgent extends TaskAssistantAgent {
  constructor({ resolver = new TaskAppLaunchResolver() } = {}) {
    super();
    this.resolver = resolver;
  }

  canHandle(context) {
    return Boolean(context?.draft || context?.interpretation);
  }

  async execute(context) {
    context.setAppSuggestions(this.resolver.resolve(context.toTaskLike()));
    return context;
  }
}

export class FollowUpAgent extends TaskAssistantAgent {
  canHandle(context) {
    return Boolean(context?.draft || context?.interpretation);
  }

  async execute(context) {
    const draft = context.draft ?? {};
    const isFollowUp = Boolean(
      draft.followUpAt
      || ['waiting', 'blocked'].includes(`${draft.status ?? ''}`),
    );

    context.mergeResult({
      preferredView: isFollowUp ? 'follow-up' : (draft.dueAt ? 'today' : 'calendar'),
      followUpMode: isFollowUp,
    });
    return context;
  }
}

export class ReminderActionAgent extends TaskAssistantAgent {
  canHandle(context) {
    return Array.isArray(context?.appSuggestions);
  }

  async execute(context) {
    const [primaryAction] = context.appSuggestions;
    context.mergeResult({
      primarySuggestion: primaryAction ?? null,
      reminderAction: primaryAction?.id ? 'open-compatible-app' : 'open-task',
    });
    return context;
  }
}
