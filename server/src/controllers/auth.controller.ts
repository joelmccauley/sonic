import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { OAuth2Client } from 'google-auth-library';
import { PlanTier, Role, SubscriptionStatus } from '@prisma/client';
import { prisma, basePrisma } from '../config/database';
import { env } from '../config/env';
import { TRIAL_DAYS } from '../config/plans';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const googleClient = env.GOOGLE_CLIENT_ID ? new OAuth2Client(env.GOOGLE_CLIENT_ID) : null;

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  storeCode: z.string().optional(),
});

const pinSchema = z.object({
  username: z.string().min(1),
  pin: z.string().length(4).regex(/^\d{4}$/),
  storeCode: z.string().optional(),
});

const signupSchema = z.object({
  restaurantName: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  phone: z.string().optional(),
  planTier: z.nativeEnum(PlanTier).default(PlanTier.STARTER),
});

const googleAuthSchema = z.object({
  credential: z.string().min(1),
  // Present only when completing a new signup via Google
  restaurantName: z.string().min(2).max(80).optional(),
  planTier: z.nativeEnum(PlanTier).optional(),
});

function signToken(payload: object): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);
}

function orgResponse(org: { id: number; name: string; slug: string; planTier: PlanTier; subscriptionStatus: SubscriptionStatus; trialEndsAt: Date | null }) {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    planTier: org.planTier,
    subscriptionStatus: org.subscriptionStatus,
    trialEndsAt: org.trialEndsAt,
  };
}

function userResponse(user: { id: number; username: string; firstName: string; lastName: string; role: Role }) {
  return { id: user.id, username: user.username, firstName: user.firstName, lastName: user.lastName, role: user.role };
}

async function findLoginUser(username: string, storeCode?: string) {
  // Public route — no tenant context, so queries here are unscoped by design.
  if (storeCode) {
    const org = await basePrisma.organization.findUnique({ where: { slug: storeCode.toLowerCase().trim() } });
    if (!org) throw new AppError(401, 'Invalid credentials');
    return basePrisma.user.findFirst({ where: { username, organizationId: org.id }, include: { organization: true } });
  }
  const matches = await basePrisma.user.findMany({ where: { username }, include: { organization: true }, take: 2 });
  if (matches.length > 1) {
    throw new AppError(409, 'This username exists in multiple stores — enter your store code');
  }
  if (matches.length === 1) return matches[0];
  // Fall back to email login
  return basePrisma.user.findFirst({ where: { email: username }, include: { organization: true } });
}

function assertOrgUsable(org: { isActive: boolean; subscriptionStatus: SubscriptionStatus; trialEndsAt: Date | null }) {
  if (!org.isActive) throw new AppError(403, 'This store account is disabled');
  if (org.subscriptionStatus === SubscriptionStatus.CANCELED) {
    throw new AppError(402, 'Subscription canceled — the store owner must reactivate billing');
  }
  if (
    org.subscriptionStatus === SubscriptionStatus.TRIALING &&
    org.trialEndsAt && org.trialEndsAt.getTime() < Date.now()
  ) {
    throw new AppError(402, 'Free trial expired — the store owner must choose a plan');
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { username, password, storeCode } = loginSchema.parse(req.body);

    const user = await findLoginUser(username, storeCode);
    if (!user || !user.isActive) throw new AppError(401, 'Invalid credentials');
    assertOrgUsable(user.organization);

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new AppError(401, 'Invalid credentials');

    const token = signToken({ userId: user.id, username: user.username, role: user.role, organizationId: user.organizationId });

    logger.info(`User logged in: ${user.username} (org ${user.organizationId})`);
    res.json({ token, user: userResponse(user), organization: orgResponse(user.organization) });
  } catch (err) {
    next(err);
  }
}

export async function loginPin(req: Request, res: Response, next: NextFunction) {
  try {
    const { username, pin, storeCode } = pinSchema.parse(req.body);

    const user = await findLoginUser(username, storeCode);
    if (!user || !user.isActive) throw new AppError(401, 'Invalid PIN');
    assertOrgUsable(user.organization);

    const valid = await bcrypt.compare(pin, user.pin);
    if (!valid) throw new AppError(401, 'Invalid PIN');

    const token = signToken({ userId: user.id, username: user.username, role: user.role, organizationId: user.organizationId });

    logger.info(`User PIN login: ${user.username} (org ${user.organizationId})`);
    res.json({ token, user: userResponse(user), organization: orgResponse(user.organization) });
  } catch (err) {
    next(err);
  }
}

// ── SaaS signup ──────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || 'store';
  let slug = base;
  for (let i = 2; ; i++) {
    const existing = await basePrisma.organization.findUnique({ where: { slug } });
    if (!existing) return slug;
    slug = `${base}-${i}`;
  }
}

const DEFAULT_SETTINGS: Array<{ key: string; value: string }> = [
  { key: 'tax_rate', value: '0.0875' },
  { key: 'tip_suggestions', value: '15,18,20,25' },
  { key: 'receipt_footer', value: 'Thank you for dining with us!' },
  { key: 'currency', value: 'USD' },
  { key: 'timezone', value: 'America/Chicago' },
  { key: 'allow_split_checks', value: 'true' },
  { key: 'require_table_guests', value: 'false' },
  { key: 'auto_print_receipt', value: 'true' },
  { key: 'kitchen_display_timeout', value: '300' },
  { key: 'order_number_prefix', value: 'ORD' },
  { key: 'loyalty_points_per_dollar', value: '10' },
  { key: 'loyalty_points_per_reward', value: '1000' },
];

interface NewOrgInput {
  restaurantName: string;
  email: string;
  phone?: string;
  planTier: PlanTier;
  owner: {
    firstName: string;
    lastName: string;
    email: string;
    passwordHash: string;
    googleId?: string;
    imageUrl?: string;
  };
}

async function createOrganizationWithOwner(input: NewOrgInput) {
  const slug = await uniqueSlug(input.restaurantName);
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const defaultPin = await bcrypt.hash('1234', 12);

  return basePrisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: input.restaurantName,
        slug,
        email: input.email,
        phone: input.phone,
        planTier: input.planTier,
        subscriptionStatus: SubscriptionStatus.TRIALING,
        trialEndsAt,
      },
    });

    const owner = await tx.user.create({
      data: {
        organizationId: org.id,
        username: 'admin',
        email: input.owner.email,
        googleId: input.owner.googleId,
        imageUrl: input.owner.imageUrl,
        pin: defaultPin,
        password: input.owner.passwordHash,
        firstName: input.owner.firstName,
        lastName: input.owner.lastName,
        role: Role.OWNER,
      },
    });

    await tx.setting.createMany({
      data: [
        { organizationId: org.id, key: 'restaurant_name', value: input.restaurantName },
        ...DEFAULT_SETTINGS.map((s) => ({ organizationId: org.id, ...s })),
      ],
    });

    return { org, owner };
  });
}

export async function signup(req: Request, res: Response, next: NextFunction) {
  try {
    const data = signupSchema.parse(req.body);

    const existing = await basePrisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new AppError(409, 'An account with this email already exists — try signing in');

    const passwordHash = await bcrypt.hash(data.password, 12);
    const { org, owner } = await createOrganizationWithOwner({
      restaurantName: data.restaurantName,
      email: data.email,
      phone: data.phone,
      planTier: data.planTier,
      owner: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        passwordHash,
      },
    });

    const token = signToken({ userId: owner.id, username: owner.username, role: owner.role, organizationId: org.id });
    logger.info(`New organization signed up: ${org.name} (${org.slug}) on ${org.planTier}`);
    res.status(201).json({ token, user: userResponse(owner), organization: orgResponse(org) });
  } catch (err) {
    next(err);
  }
}

// ── Google sign-in ───────────────────────────────────────────────────────────

export async function googleAuth(req: Request, res: Response, next: NextFunction) {
  try {
    if (!googleClient) throw new AppError(501, 'Google sign-in is not configured on this server');
    const { credential, restaurantName, planTier } = googleAuthSchema.parse(req.body);

    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.sub) throw new AppError(401, 'Google sign-in failed');
    if (payload.email_verified === false) throw new AppError(401, 'Google account email is not verified');

    // Existing user by googleId or email
    let user = await basePrisma.user.findFirst({
      where: { OR: [{ googleId: payload.sub }, { email: payload.email }] },
      include: { organization: true },
    });

    if (user) {
      if (!user.isActive) throw new AppError(403, 'Account is disabled');
      assertOrgUsable(user.organization);
      if (!user.googleId) {
        user = await basePrisma.user.update({
          where: { id: user.id },
          data: { googleId: payload.sub, imageUrl: user.imageUrl ?? payload.picture },
          include: { organization: true },
        });
      }
      const token = signToken({ userId: user!.id, username: user!.username, role: user!.role, organizationId: user!.organizationId });
      logger.info(`Google login: ${payload.email} (org ${user!.organizationId})`);
      res.json({ token, user: userResponse(user!), organization: orgResponse(user!.organization) });
      return;
    }

    // New user — needs a restaurant name to create an organization
    if (!restaurantName) {
      res.status(404).json({ error: 'No account found for this Google account', code: 'GOOGLE_SIGNUP_REQUIRED' });
      return;
    }

    const randomPassword = await bcrypt.hash(`google-oauth:${payload.sub}:${Date.now()}`, 12);
    const { org, owner } = await createOrganizationWithOwner({
      restaurantName,
      email: payload.email,
      planTier: planTier ?? PlanTier.STARTER,
      owner: {
        firstName: payload.given_name ?? 'Owner',
        lastName: payload.family_name ?? '',
        email: payload.email,
        passwordHash: randomPassword,
        googleId: payload.sub,
        imageUrl: payload.picture,
      },
    });

    const token = signToken({ userId: owner.id, username: owner.username, role: owner.role, organizationId: org.id });
    logger.info(`New organization via Google: ${org.name} (${org.slug})`);
    res.status(201).json({ token, user: userResponse(owner), organization: orgResponse(org) });
  } catch (err) {
    next(err);
  }
}

// ── Session helpers ──────────────────────────────────────────────────────────

export async function refreshToken(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user || !user.isActive) throw new AppError(401, 'Account unavailable');

    const token = signToken({ userId: user.id, username: user.username, role: user.role, organizationId: user.organizationId });
    res.json({ token });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, username: true, email: true, firstName: true, lastName: true, role: true, imageUrl: true, createdAt: true, organizationId: true },
    });
    if (!user) throw new AppError(404, 'User not found');
    const org = await basePrisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { id: true, name: true, slug: true, planTier: true, subscriptionStatus: true, trialEndsAt: true },
    });
    res.json({ ...user, organization: org ? orgResponse(org) : null });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const activeShift = await prisma.shift.findFirst({
      where: { userId: req.user!.userId, clockOut: null },
    });

    if (activeShift) {
      await prisma.shift.update({
        where: { id: activeShift.id },
        data: { clockOut: new Date() },
      });
    }

    // JWT is stateless; client discards token
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

// ── Public: look up a store by slug + return staff list for PIN login ────────

export async function getStoreInfo(req: Request, res: Response, next: NextFunction) {
  try {
    const slug = (req.params.slug ?? '').toLowerCase().trim();
    if (!slug) { res.status(400).json({ error: 'Store code required' }); return; }

    const org = await basePrisma.organization.findUnique({
      where: { slug },
      select: {
        id: true, name: true, slug: true, isActive: true,
        subscriptionStatus: true, trialEndsAt: true,
        settings: { where: { key: { in: ['logo_url', 'restaurant_name'] } }, select: { key: true, value: true } },
        users: {
          where: { isActive: true, role: { in: [Role.OWNER, Role.MANAGER, Role.CASHIER, Role.SERVER, Role.KITCHEN, Role.BARTENDER] } },
          select: { username: true, firstName: true, lastName: true, role: true, imageUrl: true },
          orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
        },
      },
    });

    if (!org || !org.isActive) {
      res.status(404).json({ error: 'Store not found' });
      return;
    }

    const settingsMap = Object.fromEntries(org.settings.map((s) => [s.key, s.value]));

    res.json({
      slug: org.slug,
      name: settingsMap['restaurant_name'] ?? org.name,
      logoUrl: settingsMap['logo_url'] ?? null,
      staff: org.users,
    });
  } catch (err) {
    next(err);
  }
}
