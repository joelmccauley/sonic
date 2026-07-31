import { PlanTier } from '@prisma/client';

export interface PlanFeatures {
  /** Marketing name */
  name: string;
  /** Monthly price in USD */
  price: number;
  /** Stripe Price ID env-configured at runtime (optional in dev/mock mode) */
  stripePriceIdEnv: string;
  tagline: string;
  maxEmployees: number | null; // null = unlimited
  maxTables: number | null;
  features: {
    pos: boolean;
    floorPlan: boolean;
    menuManagement: boolean;
    basicReports: boolean;
    kds: boolean;
    inventory: boolean;
    discounts: boolean;
    customers: boolean;
    advancedReports: boolean;
    auditLog: boolean;
    multiPrinter: boolean;
    prioritySupport: boolean;
  };
}

export const PLANS: Record<PlanTier, PlanFeatures> = {
  STARTER: {
    name: 'Starter',
    price: 29,
    stripePriceIdEnv: 'STRIPE_PRICE_STARTER',
    tagline: 'Everything you need to start selling',
    maxEmployees: 5,
    maxTables: 15,
    features: {
      pos: true,
      floorPlan: true,
      menuManagement: true,
      basicReports: true,
      kds: false,
      inventory: false,
      discounts: false,
      customers: false,
      advancedReports: false,
      auditLog: false,
      multiPrinter: false,
      prioritySupport: false,
    },
  },
  PROFESSIONAL: {
    name: 'Professional',
    price: 59,
    stripePriceIdEnv: 'STRIPE_PRICE_PROFESSIONAL',
    tagline: 'For growing restaurants that need the full toolkit',
    maxEmployees: 15,
    maxTables: null,
    features: {
      pos: true,
      floorPlan: true,
      menuManagement: true,
      basicReports: true,
      kds: true,
      inventory: true,
      discounts: true,
      customers: true,
      advancedReports: false,
      auditLog: false,
      multiPrinter: true,
      prioritySupport: false,
    },
  },
  ENTERPRISE: {
    name: 'Enterprise',
    price: 99,
    stripePriceIdEnv: 'STRIPE_PRICE_ENTERPRISE',
    tagline: 'Maximum power, insight, and support',
    maxEmployees: null,
    maxTables: null,
    features: {
      pos: true,
      floorPlan: true,
      menuManagement: true,
      basicReports: true,
      kds: true,
      inventory: true,
      discounts: true,
      customers: true,
      advancedReports: true,
      auditLog: true,
      multiPrinter: true,
      prioritySupport: true,
    },
  },
};

export type FeatureKey = keyof PlanFeatures['features'];

export function planHasFeature(tier: PlanTier, feature: FeatureKey): boolean {
  return PLANS[tier].features[feature];
}

export const TRIAL_DAYS = 14;

/** Public shape sent to the marketing site */
export function getPublicPlans() {
  return (Object.keys(PLANS) as PlanTier[]).map((tier) => ({
    tier,
    name: PLANS[tier].name,
    price: PLANS[tier].price,
    tagline: PLANS[tier].tagline,
    maxEmployees: PLANS[tier].maxEmployees,
    maxTables: PLANS[tier].maxTables,
    features: PLANS[tier].features,
  }));
}
