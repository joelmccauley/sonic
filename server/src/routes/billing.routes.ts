import { Router } from 'express';
import {
  getPlans,
  getSubscription,
  createCheckoutSession,
  createPortalSession,
} from '../controllers/billing.controller';
import { authenticate, requireOwner } from '../middleware/auth';

export const billingRoutes = Router();

// Public — used by the marketing/pricing page
billingRoutes.get('/plans', getPlans);

// Owner-only subscription management
billingRoutes.get('/subscription', authenticate, requireOwner, getSubscription);
billingRoutes.post('/checkout', authenticate, requireOwner, createCheckoutSession);
billingRoutes.post('/portal', authenticate, requireOwner, createPortalSession);
