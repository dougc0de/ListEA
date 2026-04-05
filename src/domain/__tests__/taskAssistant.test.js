import { describe, expect, it } from 'vitest';
import {
  AppLaunchAgent,
  FollowUpAgent,
  ReminderActionAgent,
  TASK_ASSISTANT_SOURCES,
  TaskAssistantOrchestrator,
  TextStructuringAgent,
  VoiceCaptureAgent,
} from '../taskAssistant';

describe('TaskAssistantOrchestrator', () => {
  it('turns a voice transcript into a structured draft plus app suggestions', async () => {
    const orchestrator = new TaskAssistantOrchestrator({
      agents: [
        new VoiceCaptureAgent(),
        new TextStructuringAgent(),
        new AppLaunchAgent(),
        new FollowUpAgent(),
        new ReminderActionAgent(),
      ],
    });

    const context = await orchestrator.run({
      sourceType: TASK_ASSISTANT_SOURCES.VOICE,
      transcript: 'Mandar mensaje por WhatsApp a Maria manana',
      metadata: {
        capturedAt: '2026-04-05T12:00:00.000Z',
      },
    });

    expect(context.draft.title).toContain('Mandar mensaje por WhatsApp');
    expect(context.draft.source).toBe('voice');
    expect(context.appSuggestions[0]?.id).toBe('app-whatsapp');
    expect(context.result.primarySuggestion?.id).toBe('app-whatsapp');
  });
});
