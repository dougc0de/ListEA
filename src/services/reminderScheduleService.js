import { cancelReminder, scheduleReminder } from './reminders';

export class ReminderScheduleService {
  async cancelByIds(ids = []) {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    await Promise.all(uniqueIds.map(id => cancelReminder(id)));
  }

  async schedulePlans(plans = [], onTrigger) {
    const validPlans = plans.filter(plan => plan?.id && plan?.scheduledAt);
    for (const plan of validPlans) {
      await scheduleReminder(plan, onTrigger);
    }
  }
}
