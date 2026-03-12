import { describe, expect, it } from 'vitest';
import { FEATURE_KEYS, FeatureAccessController, PlanRegistry } from '../plans';

describe('PlanRegistry', () => {
  it('returns feature access for free and premium plans', () => {
    const access = new FeatureAccessController(new PlanRegistry());

    expect(access.canUse('free', FEATURE_KEYS.DAY_NIGHT_MODE)).toBe(true);
    expect(access.canUse('free', FEATURE_KEYS.PREMIUM_THEMES)).toBe(false);
    expect(access.canUse('premium', FEATURE_KEYS.PREMIUM_THEMES)).toBe(true);
    expect(access.canUse('premium', FEATURE_KEYS.NO_ADS)).toBe(true);
  });
});
