import { describe, expect, it } from 'vitest';
import { AvatarPreferences, AVATAR_TIMINGS } from '../avatar';
import {
  AssistantBriefService,
  MobileAssistantPreferences,
  OperationalReportService,
  ReminderPolicyEngine,
  REMINDER_LANES,
} from '../mobileAssistant';
import { PRO_ENTITLEMENTS } from '../license';
import { TaskActivityLedger } from '../activity';
import { TaskFactory, TASK_IMPACT, TASK_PRIORITY, TASK_STATUS } from '../tasks';

describe('ReminderPolicyEngine', () => {
  it('builds basic, prep and risk plans for a premium task with time', () => {
    const factory = new TaskFactory();
    const task = factory.create({
      title: 'Enviar propuesta',
      project: 'Clientes',
      dueAt: '2026-04-08T15:00:00.000Z',
      dueAtPrecision: 'datetime',
      priority: TASK_PRIORITY.HIGH,
      impact: TASK_IMPACT.HIGH,
    });

    const engine = new ReminderPolicyEngine();
    const plans = engine.buildTaskPlans([task], {
      referenceDate: new Date('2026-04-08T10:00:00.000Z'),
      avatarPreferences: new AvatarPreferences({
        enabled: true,
        reminderTiming: AVATAR_TIMINGS.ON_TIME,
      }),
      assistantPreferences: new MobileAssistantPreferences({
        assistantEnabled: true,
        preReminderOffset: 15,
      }),
      entitlements: PRO_ENTITLEMENTS,
    });

    expect(plans.map(plan => plan.lane)).toEqual([
      REMINDER_LANES.PREP,
      REMINDER_LANES.BASIC,
      REMINDER_LANES.RISK,
    ]);
    expect(plans[0].taskId).toBe(task.id);
  });

  it('skips prep reminders for free users and still keeps the basic lane', () => {
    const factory = new TaskFactory();
    const task = factory.create({
      title: 'Llamar al cliente',
      dueAt: '2026-04-08T15:00:00.000Z',
      dueAtPrecision: 'datetime',
    });

    const engine = new ReminderPolicyEngine();
    const plans = engine.buildTaskPlans([task], {
      referenceDate: new Date('2026-04-08T10:00:00.000Z'),
      avatarPreferences: new AvatarPreferences({
        enabled: true,
        reminderTiming: AVATAR_TIMINGS.ON_TIME,
      }),
      assistantPreferences: new MobileAssistantPreferences({
        assistantEnabled: true,
        preReminderOffset: 15,
      }),
      entitlements: {},
    });

    expect(plans).toHaveLength(1);
    expect(plans[0].lane).toBe(REMINDER_LANES.BASIC);
  });
});

describe('AssistantBriefService', () => {
  it('builds a weekly brief plan and report from local data', () => {
    const factory = new TaskFactory();
    const tasks = [
      factory.create({
        title: 'Mandar WhatsApp a Maria',
        dueAt: '2026-04-08T11:00:00.000Z',
        dueAtPrecision: 'datetime',
      }),
      factory.create({
        title: 'Seguimiento de propuesta',
        status: TASK_STATUS.WAITING,
        followUpAt: '2026-04-06T10:00:00.000Z',
      }),
    ];
    const analytics = new TaskActivityLedger();
    analytics.recordLaunched(tasks[0], { app: { id: 'whatsapp' } }, '2026-04-08T08:00:00.000Z');

    const service = new AssistantBriefService({
      reportService: new OperationalReportService(),
    });
    const result = service.buildWeeklyBrief(tasks, analytics, {
      referenceDate: new Date('2026-04-08T09:00:00.000Z'),
      assistantPreferences: new MobileAssistantPreferences({
        assistantEnabled: true,
        weeklyBriefDay: 1,
        weeklyBriefTime: '08:00',
      }),
      entitlements: PRO_ENTITLEMENTS,
    });

    expect(result.report.summary.responses).toBeGreaterThanOrEqual(1);
    expect(result.plan.lane).toBe(REMINDER_LANES.BRIEFING);
    expect(result.plan.extra.preferredView).toBe('dashboard');
  });
});
