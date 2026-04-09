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

export const SUBSCRIPTION_PRODUCT_IDS = Object.freeze({
  PRO_MONTHLY: 'listea_pro_monthly',
});

export const SUBSCRIPTION_VERIFICATION_STATES = Object.freeze({
  UNKNOWN: 'unknown',
  CACHED: 'cached',
  VERIFIED: 'verified',
});

export const ENTITLEMENT_KEYS = Object.freeze({
  ADVANCED_DASHBOARD: 'advancedDashboard',
  PREMIUM_CALENDAR: 'premiumCalendar',
  PDF_EXPORT: 'pdfExport',
  PREMIUM_INSIGHTS: 'premiumInsights',
  ADVANCED_REMINDERS: 'advancedReminders',
  MOBILE_ASSISTANT: 'mobileAssistant',
  WEEKLY_BRIEFING: 'weeklyBriefing',
  AVATAR_PRO: 'avatarPro',
  PREMIUM_THEMES: 'premiumThemes',
  LOCAL_ENCRYPTED_BACKUP: 'localEncryptedBackup',
  SMART_APP_LAUNCH: 'smartAppLaunch',
  SCREENSHOT_CAPTURE: 'screenshotCapture',
  VOICE_CAPTURE: 'voiceCapture',
});

export const FREE_ENTITLEMENTS = Object.freeze({
  [ENTITLEMENT_KEYS.ADVANCED_DASHBOARD]: false,
  [ENTITLEMENT_KEYS.PREMIUM_CALENDAR]: false,
  [ENTITLEMENT_KEYS.PDF_EXPORT]: false,
  [ENTITLEMENT_KEYS.PREMIUM_INSIGHTS]: false,
  [ENTITLEMENT_KEYS.ADVANCED_REMINDERS]: false,
  [ENTITLEMENT_KEYS.MOBILE_ASSISTANT]: false,
  [ENTITLEMENT_KEYS.WEEKLY_BRIEFING]: false,
  [ENTITLEMENT_KEYS.AVATAR_PRO]: false,
  [ENTITLEMENT_KEYS.PREMIUM_THEMES]: false,
  [ENTITLEMENT_KEYS.LOCAL_ENCRYPTED_BACKUP]: false,
  [ENTITLEMENT_KEYS.SMART_APP_LAUNCH]: false,
  [ENTITLEMENT_KEYS.SCREENSHOT_CAPTURE]: false,
  [ENTITLEMENT_KEYS.VOICE_CAPTURE]: false,
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

function normalizeVerificationState(value) {
  return Object.values(SUBSCRIPTION_VERIFICATION_STATES).includes(value)
    ? value
    : SUBSCRIPTION_VERIFICATION_STATES.UNKNOWN;
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
        ?? (tier === LICENSE_TIERS.PRO ? PURCHASE_MODELS.SUBSCRIPTION : PURCHASE_MODELS.NONE),
    ),
    billingSource: normalizeBillingSource(rawLicense.billingSource ?? rawLicense.source),
    restoreAvailable: Boolean(rawLicense.restoreAvailable ?? (tier === LICENSE_TIERS.PRO)),
    productId: `${rawLicense.productId ?? ''}`.trim()
      || (tier === LICENSE_TIERS.PRO ? SUBSCRIPTION_PRODUCT_IDS.PRO_MONTHLY : ''),
    platform: `${rawLicense.platform ?? ''}`.trim(),
    verificationState: normalizeVerificationState(rawLicense.verificationState),
    lastPurchaseCheckAt: `${rawLicense.lastPurchaseCheckAt ?? ''}`.trim(),
    lastVerifiedAt: `${rawLicense.lastVerifiedAt ?? ''}`.trim(),
    activatedAt: `${rawLicense.activatedAt ?? ''}`.trim(),
    renewsAt: `${rawLicense.renewsAt ?? ''}`.trim(),
    expiresAt: `${rawLicense.expiresAt ?? ''}`.trim(),
    autoRenewing: Boolean(rawLicense.autoRenewing ?? (tier === LICENSE_TIERS.PRO)),
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
    purchaseModel: metadata.purchaseModel ?? PURCHASE_MODELS.SUBSCRIPTION,
    billingSource: metadata.billingSource ?? BILLING_SOURCES.LOCAL,
    productId: metadata.productId ?? SUBSCRIPTION_PRODUCT_IDS.PRO_MONTHLY,
    platform: metadata.platform ?? '',
    verificationState: metadata.verificationState ?? SUBSCRIPTION_VERIFICATION_STATES.CACHED,
    restoreAvailable: true,
    lastPurchaseCheckAt: now,
    lastVerifiedAt: metadata.lastVerifiedAt ?? now,
    activatedAt: license?.activatedAt || now,
    renewsAt: metadata.renewsAt ?? '',
    expiresAt: metadata.expiresAt ?? '',
    autoRenewing: metadata.autoRenewing ?? true,
    entitlements: buildEntitlementsForTier(LICENSE_TIERS.PRO, metadata.entitlements),
  });
}

export function downgradeToFreeLicense(license = {}, metadata = {}) {
  return buildLicenseState({
    ...license,
    licenseTier: LICENSE_TIERS.FREE,
    purchaseModel: PURCHASE_MODELS.NONE,
    billingSource: BILLING_SOURCES.NONE,
    productId: '',
    platform: '',
    verificationState: SUBSCRIPTION_VERIFICATION_STATES.UNKNOWN,
    restoreAvailable: false,
    lastPurchaseCheckAt: metadata.now ?? new Date().toISOString(),
    lastVerifiedAt: '',
    activatedAt: '',
    renewsAt: '',
    expiresAt: '',
    autoRenewing: false,
    entitlements: FREE_ENTITLEMENTS,
  });
}
