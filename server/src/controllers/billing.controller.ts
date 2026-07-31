import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import Stripe from 'stripe';
import { PlanTier, SubscriptionStatus } from '@prisma/client';
import { basePrisma } from '../config/database';
import { env } from '../config/env';
import { PLANS, getPublicPlans } from '../config/plans';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;

const checkoutSchema = z.object({
  planTier: z.nativeEnum(PlanTier),
});

function priceIdFor(tier: PlanTier): string {
  const key = PLANS[tier].stripePriceIdEnv as keyof typeof env;
  return (env[key] as string) || '';
}

// ── Public: plan catalog for the marketing site ──────────────────────────────

export function getPlans(_req: Request, res: Response) {
  res.json({ plans: getPublicPlans(), stripeEnabled: Boolean(stripe) });
}

// ── Owner: current subscription state ────────────────────────────────────────

export async function getSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const org = await basePrisma.organization.findUnique({
      where: { id: req.user!.organizationId },
      select: {
        id: true, name: true, slug: true, planTier: true, subscriptionStatus: true,
        trialEndsAt: true, currentPeriodEnd: true, stripeCustomerId: true,
      },
    });
    if (!org) throw new AppError(404, 'Organization not found');
    res.json({
      ...org,
      stripeCustomerId: undefined,
      hasPaymentMethod: Boolean(org.stripeCustomerId),
      plan: PLANS[org.planTier],
      stripeEnabled: Boolean(stripe),
    });
  } catch (err) {
    next(err);
  }
}

// ── Owner: start checkout (subscribe or change plan) ─────────────────────────

export async function createCheckoutSession(req: Request, res: Response, next: NextFunction) {
  try {
    const { planTier } = checkoutSchema.parse(req.body);
    const orgId = req.user!.organizationId;
    const org = await basePrisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new AppError(404, 'Organization not found');

    // Dev/mock mode: no Stripe configured — activate the plan immediately.
    if (!stripe) {
      const updated = await basePrisma.organization.update({
        where: { id: orgId },
        data: {
          planTier,
          subscriptionStatus: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      logger.info(`[billing:mock] Org ${orgId} switched to ${planTier}`);
      res.json({ mock: true, organization: { planTier: updated.planTier, subscriptionStatus: updated.subscriptionStatus } });
      return;
    }

    // Ensure a Stripe customer exists
    let customerId = org.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: org.email,
        name: org.name,
        metadata: { organizationId: String(org.id) },
      });
      customerId = customer.id;
      await basePrisma.organization.update({ where: { id: org.id }, data: { stripeCustomerId: customerId } });
    }

    const priceId = priceIdFor(planTier);
    if (!priceId) throw new AppError(500, `Stripe price is not configured for the ${planTier} plan`);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${env.CLIENT_URL}/admin/billing?checkout=success`,
      cancel_url: `${env.CLIENT_URL}/admin/billing?checkout=canceled`,
      metadata: { organizationId: String(org.id), planTier },
      subscription_data: { metadata: { organizationId: String(org.id), planTier } },
    });

    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
}

// ── Owner: Stripe billing portal (manage cards, cancel, invoices) ────────────

export async function createPortalSession(req: Request, res: Response, next: NextFunction) {
  try {
    if (!stripe) throw new AppError(501, 'Billing portal requires Stripe to be configured');
    const org = await basePrisma.organization.findUnique({ where: { id: req.user!.organizationId } });
    if (!org?.stripeCustomerId) throw new AppError(400, 'No billing account yet — subscribe to a plan first');

    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${env.CLIENT_URL}/admin/billing`,
    });
    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
}

// ── Stripe webhook ────────────────────────────────────────────────────────────

function tierFromPriceId(priceId: string): PlanTier | null {
  for (const tier of Object.keys(PLANS) as PlanTier[]) {
    if (priceIdFor(tier) === priceId) return tier;
  }
  return null;
}

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case 'active':
      return SubscriptionStatus.ACTIVE;
    case 'trialing':
      return SubscriptionStatus.TRIALING;
    case 'past_due':
    case 'unpaid':
      return SubscriptionStatus.PAST_DUE;
    default:
      return SubscriptionStatus.CANCELED;
  }
}

export async function handleStripeWebhook(req: Request, res: Response) {
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    res.status(501).json({ error: 'Stripe webhooks not configured' });
    return;
  }

  let event: Stripe.Event;
  try {
    const signature = req.headers['stripe-signature'] as string;
    event = stripe.webhooks.constructEvent(req.body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.warn('Stripe webhook signature verification failed', err);
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const orgId = parseInt(sub.metadata?.organizationId ?? '', 10);
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

        const org = Number.isFinite(orgId)
          ? await basePrisma.organization.findUnique({ where: { id: orgId } })
          : await basePrisma.organization.findUnique({ where: { stripeCustomerId: customerId } });
        if (!org) {
          logger.warn(`Stripe webhook: no organization for customer ${customerId}`);
          break;
        }

        const priceId = sub.items.data[0]?.price?.id ?? '';
        const tier = tierFromPriceId(priceId) ?? org.planTier;
        const status = event.type === 'customer.subscription.deleted'
          ? SubscriptionStatus.CANCELED
          : mapStripeStatus(sub.status);

        const periodEnd = (sub as any).current_period_end as number | undefined;
        await basePrisma.organization.update({
          where: { id: org.id },
          data: {
            planTier: tier,
            subscriptionStatus: status,
            stripeSubscriptionId: event.type === 'customer.subscription.deleted' ? null : sub.id,
            currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
          },
        });
        logger.info(`Stripe webhook: org ${org.id} → ${tier}/${status}`);
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
        if (customerId) {
          await basePrisma.organization.updateMany({
            where: { stripeCustomerId: customerId },
            data: { subscriptionStatus: SubscriptionStatus.PAST_DUE },
          });
        }
        break;
      }
      default:
        break;
    }
    res.json({ received: true });
  } catch (err) {
    logger.error('Stripe webhook handling failed', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}
