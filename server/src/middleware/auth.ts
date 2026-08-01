import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/database';
import { tenantStorage } from '../config/tenantContext';
import { planHasFeature, FeatureKey, PLANS } from '../config/plans';
import { Role, PlanTier, SubscriptionStatus } from '@prisma/client';

export interface JwtPayload {
  userId: number;
  username: string;
  role: Role;
  organizationId: number;
  shiftId?: number;
}

export interface PlatformJwtPayload {
  scope: 'platform_admin';
  email: string;
}

export interface CustomerJwtPayload {
  scope: 'customer_order';
  customerId: number;
  organizationId: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      platformAdmin?: PlatformJwtPayload;
      customer?: CustomerJwtPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    if (!payload.organizationId) {
      res.status(401).json({ error: 'Session outdated — please log in again' });
      return;
    }
    req.user = payload;
    // Establish tenant context for the rest of this request — all Prisma
    // queries downstream are automatically scoped to this organization.
    tenantStorage.run({ organizationId: payload.organizationId }, () => next());
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: Role[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    // Verify user is still active
    const user = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { isActive: true } });
    if (!user?.isActive) {
      res.status(403).json({ error: 'Account is disabled' });
      return;
    }

    next();
  };
}

export function authenticatePlatform(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as PlatformJwtPayload;
    if (payload.scope !== 'platform_admin' || !payload.email) {
      res.status(401).json({ error: 'Invalid platform session' });
      return;
    }
    req.platformAdmin = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function authenticateCustomer(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as CustomerJwtPayload;
    if (payload.scope !== 'customer_order' || !payload.customerId || !payload.organizationId) {
      res.status(401).json({ error: 'Invalid customer session' });
      return;
    }
    req.customer = payload;
    tenantStorage.run({ organizationId: payload.organizationId }, () => next());
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Shorthand role guards
export const requireManager = requireRole(Role.OWNER, Role.MANAGER);
export const requireOwner = requireRole(Role.OWNER);
export const requireKitchen = requireRole(Role.OWNER, Role.MANAGER, Role.KITCHEN, Role.SERVER, Role.BARTENDER, Role.CASHIER);

/**
 * Gate a route behind a subscription feature. Also blocks organizations whose
 * subscription is canceled or whose trial has expired.
 */
export function requireFeature(feature: FeatureKey) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const org = await prisma.organization.findUnique({
      where: { id: req.user.organizationId },
      select: { planTier: true, subscriptionStatus: true, trialEndsAt: true, isActive: true },
    });
    if (!org || !org.isActive) {
      res.status(403).json({ error: 'Organization is disabled' });
      return;
    }
    if (!isSubscriptionUsable(org.subscriptionStatus, org.trialEndsAt)) {
      res.status(402).json({ error: 'Subscription inactive — please update billing', code: 'SUBSCRIPTION_INACTIVE' });
      return;
    }
    if (!planHasFeature(org.planTier, feature)) {
      res.status(403).json({
        error: `This feature requires a higher plan (current: ${PLANS[org.planTier].name})`,
        code: 'PLAN_UPGRADE_REQUIRED',
        feature,
      });
      return;
    }
    next();
  };
}

export function isSubscriptionUsable(status: SubscriptionStatus, trialEndsAt: Date | null): boolean {
  if (status === SubscriptionStatus.ACTIVE || status === SubscriptionStatus.PAST_DUE) return true;
  if (status === SubscriptionStatus.TRIALING) {
    return !trialEndsAt || trialEndsAt.getTime() > Date.now();
  }
  return false;
}

export { PlanTier };
