import { describe, expect, it } from 'vitest';
import {
  ENTITLEMENT_KEYS,
  LICENSE_TIERS,
  PURCHASE_MODELS,
  activateLocalProLicense,
  buildLicenseState,
  hasEntitlement,
} from '../license';

describe('license helpers', () => {
  it('defaults to a free local license state', () => {
    const license = buildLicenseState();

    expect(license.licenseTier).toBe(LICENSE_TIERS.FREE);
    expect(license.purchaseModel).toBe(PURCHASE_MODELS.NONE);
    expect(hasEntitlement(license, ENTITLEMENT_KEYS.PDF_EXPORT)).toBe(false);
  });

  it('migrates a legacy premium flag into pro entitlements', () => {
    const license = buildLicenseState({}, { migratedPremiumEnabled: true });

    expect(license.licenseTier).toBe(LICENSE_TIERS.PRO);
    expect(hasEntitlement(license, ENTITLEMENT_KEYS.PREMIUM_THEMES)).toBe(true);
    expect(hasEntitlement(license, ENTITLEMENT_KEYS.ADVANCED_DASHBOARD)).toBe(true);
  });

  it('activates pro locally with the expected entitlements', () => {
    const license = activateLocalProLicense(buildLicenseState(), {
      now: '2026-03-27T02:00:00.000Z',
    });

    expect(license.licenseTier).toBe(LICENSE_TIERS.PRO);
    expect(license.purchaseModel).toBe(PURCHASE_MODELS.ONE_TIME);
    expect(license.restoreAvailable).toBe(true);
    expect(hasEntitlement(license, ENTITLEMENT_KEYS.LOCAL_ENCRYPTED_BACKUP)).toBe(true);
    expect(hasEntitlement(license, ENTITLEMENT_KEYS.SMART_APP_LAUNCH)).toBe(true);
  });
});
