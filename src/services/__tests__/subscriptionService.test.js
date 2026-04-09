import { describe, expect, it } from 'vitest';
import { LICENSE_TIERS, PURCHASE_MODELS, SUBSCRIPTION_PRODUCT_IDS } from '../../domain/license';
import { SubscriptionService } from '../subscriptionService';

describe('SubscriptionService', () => {
  it('activates a monthly local snapshot for Pro', async () => {
    const service = new SubscriptionService();
    const result = await service.purchaseMonthly({}, {
      now: '2026-04-08T15:00:00.000Z',
    });

    expect(result.licenseTier).toBe(LICENSE_TIERS.PRO);
    expect(result.purchaseModel).toBe(PURCHASE_MODELS.SUBSCRIPTION);
    expect(result.productId).toBe(SUBSCRIPTION_PRODUCT_IDS.PRO_MONTHLY);
    expect(result.autoRenewing).toBe(true);
  });

  it('restores a cached Pro subscription when restore is available', async () => {
    const service = new SubscriptionService();
    const result = await service.restore({
      licenseTier: 'free',
      restoreAvailable: true,
    }, {
      now: '2026-04-08T15:00:00.000Z',
    });

    expect(result.licenseTier).toBe(LICENSE_TIERS.PRO);
    expect(result.restoreAvailable).toBe(true);
  });
});
