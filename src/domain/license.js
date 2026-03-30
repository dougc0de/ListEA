export const LICENSE_TIERS = Object.freeze({
  FREE: 'free',
  PRO: 'pro',
});

export const PURCHASE_MODELS = Object.freeze({
  NONE: 'none',
  ONE_TIME: 'one_time',
  SUBSCRIPTION: 'subscription',
});

export const BILLING_SOURCES = Object.freeze({
  NONE: 'none',
  LOCAL: 'local',
  APP_STORE: 'app_store',
  PLAY_STORE: 'play_store',
});

export const ENTITLEMENT_KEYS = Object.freeze({
  ADVANCED_DASHBOARD: 'advancedDashboard',
  PDF_EXPORT: 'pdfExport',
  PREMIUM_INSIGHTS: 'premiumInsights',
  ADVANCED_REMINDERS: 'advancedReminders',
  AVATAR_PRO: 'avatarPro',
  PREMIUM_THEMES: 'premiumThemes',
  LOCAL_ENCRYPTED_BACKUP: 'localEncryptedBackup',
  SMART_APP_LAUNCH: 'smartAppLaunch',
});

export const FREE_ENTITLEMENTS = Object.freeze({
  [ENTITLEMENT_KEYS.ADVANCED_DASHBOARD]: false,
  [ENTITLEMENT_KEYS.PDF_EXPORT]: false,
  [ENTITLEMENT_KEYS.PREMIUM_INSIGHTS]: false,
  [ENTITLEMENT_KEYS.ADVANCED_REMINDERS]: false,
  [ENTITLEMENT_KEYS.AVATAR_PRO]: false,
  [ENTITLEMENT_KEYS.PREMIUM_THEMES]: false,
  [ENTITLEMENT_KEYS.LOCAL_ENCRYPTED_BACKUP]: false,
  [ENTITLEMENT_KEYS.SMART_APP_LAUNCH]: false,
});

export const PRO_ENTITLEMENTS = Object.freeze(
  Object.fromEntries(
    Object.keys(FREE_ENTITLEMENTS).map(key => [key, true]),
  ),
);

function normalizeLicenseTier(value) {
  return Object.values(LICENSE_TIERS).includes(value) ? value : LICENSE_TIERS.FREE;
}

function normalizePurchaseModel(value) {
  return Object.values(PURCHASE_MODELS).includes(value) ? value : PURCHASE_MODELS.NONE;
}

function normalizeBillingSource(value) {
  return Object.values(BILLING_SOURCES).includes(value) ? value : BILLING_SOURCES.NONE;
}

export function buildEntitlementsForTier(tier, overrides = {}) {
  const baseEntitlements = tier === LICENSE_TIERS.PRO ? PRO_ENTITLEMENTS : FREE_ENTITLEMENTS;

  return Object.keys(FREE_ENTITLEMENTS).reduce((result, key) => {
    result[key] = key in overrides ? Boolean(overrides[key]) : baseEntitlements[key];
    return result;
  }, {});
}

export function buildLicenseState(rawLicense = {}, options = {}) {
  const migratedPremiumEnabled = Boolean(options.migratedPremiumEnabled);
  const tier = normalizeLicenseTier(
    rawLicense.licenseTier
      ?? rawLicense.tier
      ?? (migratedPremiumEnabled ? LICENSE_TIERS.PRO : LICENSE_TIERS.FREE),
  );

  return {
    licenseTier: tier,
    purchaseModel: normalizePurchaseModel(
      rawLicense.purchaseModel
        ?? rawLicense.model
        ?? (tier === LICENSE_TIERS.PRO ? PURCHASE_MODELS.ONE_TIME : PURCHASE_MODELS.NONE),
    ),
    billingSource: normalizeBillingSource(rawLicense.billingSource ?? rawLicense.source),
    restoreAvailable: Boolean(rawLicense.restoreAvailable ?? (tier === LICENSE_TIERS.PRO)),
    lastPurchaseCheckAt: `${rawLicense.lastPurchaseCheckAt ?? ''}`.trim(),
    activatedAt: `${rawLicense.activatedAt ?? ''}`.trim(),
    entitlements: buildEntitlementsForTier(tier, rawLicense.entitlements),
  };
}

export function serializeLicenseState(license = {}) {
  return buildLicenseState(license);
}

export function hasEntitlement(license, entitlementKey) {
  return Boolean(buildLicenseState(license).entitlements[entitlementKey]);
}

export function activateLocalProLicense(license = {}, metadata = {}) {
  const now = metadata.now ?? new Date().toISOString();
  return buildLicenseState({
    ...license,
    licenseTier: LICENSE_TIERS.PRO,
    purchaseModel: metadata.purchaseModel ?? PURCHASE_MODELS.ONE_TIME,
    billingSource: metadata.billingSource ?? BILLING_SOURCES.LOCAL,
    restoreAvailable: true,
    lastPurchaseCheckAt: now,
    activatedAt: license?.activatedAt || now,
    entitlements: buildEntitlementsForTier(LICENSE_TIERS.PRO, metadata.entitlements),
  });
}

export function downgradeToFreeLicense(license = {}, metadata = {}) {
  return buildLicenseState({
    ...license,
    licenseTier: LICENSE_TIERS.FREE,
    purchaseModel: PURCHASE_MODELS.NONE,
    billingSource: BILLING_SOURCES.NONE,
    restoreAvailable: false,
    lastPurchaseCheckAt: metadata.now ?? new Date().toISOString(),
    activatedAt: '',
    entitlements: FREE_ENTITLEMENTS,
  });
}
