export const FEATURE_KEYS = Object.freeze({
  ADVANCED_REMINDERS: 'advanced-reminders',
  ADVANCED_VIEWS: 'advanced-views',
  TAGS: 'tags',
  SUBTASKS: 'subtasks',
  TEMPLATES: 'templates',
  BACKUP_EXPORT: 'backup-export',
  FOCUS_MODE: 'focus-mode',
  PREMIUM_THEMES: 'premium-themes',
  NO_ADS: 'no-ads',
  DAY_NIGHT_MODE: 'day-night-mode',
});

export class SubscriptionPlan {
  constructor({ id, name, features }) {
    this.id = id;
    this.name = name;
    this.features = new Set(features);
  }

  hasFeature(featureKey) {
    return this.features.has(featureKey);
  }
}

export class FreePlan extends SubscriptionPlan {
  constructor() {
    super({
      id: 'free',
      name: 'Gratis',
      features: [FEATURE_KEYS.DAY_NIGHT_MODE],
    });
  }
}

export class PremiumPlan extends SubscriptionPlan {
  constructor() {
    super({
      id: 'premium',
      name: 'Premium',
      features: [
        FEATURE_KEYS.ADVANCED_REMINDERS,
        FEATURE_KEYS.ADVANCED_VIEWS,
        FEATURE_KEYS.TAGS,
        FEATURE_KEYS.SUBTASKS,
        FEATURE_KEYS.TEMPLATES,
        FEATURE_KEYS.BACKUP_EXPORT,
        FEATURE_KEYS.FOCUS_MODE,
        FEATURE_KEYS.PREMIUM_THEMES,
        FEATURE_KEYS.NO_ADS,
        FEATURE_KEYS.DAY_NIGHT_MODE,
      ],
    });
  }
}

export class PlanRegistry {
  constructor(plans = [new FreePlan(), new PremiumPlan()]) {
    this.plans = new Map(plans.map(plan => [plan.id, plan]));
  }

  getPlan(planId) {
    return this.plans.get(planId) ?? this.plans.get('free');
  }

  getAllPlans() {
    return Array.from(this.plans.values());
  }
}

export class FeatureAccessController {
  constructor(planRegistry) {
    this.planRegistry = planRegistry;
  }

  canUse(planId, featureKey) {
    return this.planRegistry.getPlan(planId).hasFeature(featureKey);
  }
}
