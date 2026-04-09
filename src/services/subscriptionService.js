import {
  BILLING_SOURCES,
  LICENSE_TIERS,
  PURCHASE_MODELS,
  SUBSCRIPTION_PRODUCT_IDS,
  SUBSCRIPTION_VERIFICATION_STATES,
  activateLocalProLicense,
  buildLicenseState,
  downgradeToFreeLicense,
} from '../domain/license';

export const LISTEA_PRO_MONTHLY_PLAN = Object.freeze({
  productId: SUBSCRIPTION_PRODUCT_IDS.PRO_MONTHLY,
  label: 'ListEA Pro mensual',
  priceLabel: '$2.99/mes',
  cadenceLabel: 'Mensual',
});

function addDays(value, days) {
  const nextDate = value instanceof Date ? new Date(value) : new Date(value);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

export class SubscriptionSnapshot {
  constructor({
    productId = LISTEA_PRO_MONTHLY_PLAN.productId,
    priceLabel = LISTEA_PRO_MONTHLY_PLAN.priceLabel,
    billingAvailable = false,
    canRestore = true,
  } = {}) {
    this.productId = productId;
    this.priceLabel = priceLabel;
    this.billingAvailable = Boolean(billingAvailable);
    this.canRestore = Boolean(canRestore);
  }
}

export class LocalSubscriptionProvider {
  async getCatalog() {
    return [new SubscriptionSnapshot()];
  }

  async purchaseMonthly(currentLicense = {}, { now = new Date().toISOString() } = {}) {
    const activationDate = new Date(now);
    const renewalDate = addDays(activationDate, 30).toISOString();
    return activateLocalProLicense(currentLicense, {
      now,
      purchaseModel: PURCHASE_MODELS.SUBSCRIPTION,
      billingSource: BILLING_SOURCES.LOCAL,
      productId: LISTEA_PRO_MONTHLY_PLAN.productId,
      verificationState: SUBSCRIPTION_VERIFICATION_STATES.CACHED,
      lastVerifiedAt: now,
      renewsAt: renewalDate,
      expiresAt: renewalDate,
      autoRenewing: true,
    });
  }

  async restore(currentLicense = {}, { now = new Date().toISOString() } = {}) {
    const normalized = buildLicenseState(currentLicense);
    if (normalized.licenseTier === LICENSE_TIERS.PRO || normalized.restoreAvailable) {
      return this.purchaseMonthly(normalized, { now });
    }

    return normalized;
  }

  async sync(currentLicense = {}, { now = new Date().toISOString() } = {}) {
    const normalized = buildLicenseState(currentLicense);
    if (normalized.licenseTier !== LICENSE_TIERS.PRO) {
      return normalized;
    }

    return buildLicenseState({
      ...normalized,
      verificationState: SUBSCRIPTION_VERIFICATION_STATES.CACHED,
      lastVerifiedAt: now,
    });
  }

  async downgrade(currentLicense = {}, { now = new Date().toISOString() } = {}) {
    return downgradeToFreeLicense(currentLicense, { now });
  }
}

export class SubscriptionService {
  constructor({
    provider = new LocalSubscriptionProvider(),
  } = {}) {
    this.provider = provider;
  }

  async getCatalog() {
    return this.provider.getCatalog();
  }

  async purchaseMonthly(currentLicense = {}, options = {}) {
    return this.provider.purchaseMonthly(currentLicense, options);
  }

  async restore(currentLicense = {}, options = {}) {
    return this.provider.restore(currentLicense, options);
  }

  async sync(currentLicense = {}, options = {}) {
    return this.provider.sync(currentLicense, options);
  }

  async downgrade(currentLicense = {}, options = {}) {
    return this.provider.downgrade(currentLicense, options);
  }
}
