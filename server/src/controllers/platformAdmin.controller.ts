import { Request, Response, NextFunction } from 'express';
import { PlanTier, SubscriptionStatus } from '@prisma/client';
import { z } from 'zod';
import { basePrisma } from '../config/database';
import { PLANS } from '../config/plans';

export async function getPlatformOverview(_req: Request, res: Response, next: NextFunction) {
  try {
    const now = new Date();
    const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      organizations,
      usersCount,
      paidOrderAgg30,
      lastOrderByOrg,
      orders30Count,
    ] = await Promise.all([
      basePrisma.organization.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          email: true,
          phone: true,
          planTier: true,
          subscriptionStatus: true,
          trialEndsAt: true,
          currentPeriodEnd: true,
          isActive: true,
          createdAt: true,
          _count: { select: { users: true } },
        },
      }),
      basePrisma.user.count(),
      basePrisma.order.groupBy({
        by: ['organizationId'],
        where: { status: 'PAID', createdAt: { gte: last30, lte: now } },
        _sum: { total: true },
        _count: { id: true },
      }),
      basePrisma.order.groupBy({
        by: ['organizationId'],
        _max: { createdAt: true },
      }),
      basePrisma.order.count({ where: { status: 'PAID', createdAt: { gte: last30, lte: now } } }),
    ]);

    const paidMap = new Map<number, { sales30d: number; orders30d: number }>();
    for (const row of paidOrderAgg30) {
      paidMap.set(row.organizationId, {
        sales30d: Number(row._sum.total ?? 0),
        orders30d: row._count.id,
      });
    }

    const lastOrderMap = new Map<number, Date | null>();
    for (const row of lastOrderByOrg) {
      lastOrderMap.set(row.organizationId, row._max.createdAt ?? null);
    }

    const organizationsWithMetrics = organizations.map((org) => {
      const paid = paidMap.get(org.id);
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        email: org.email,
        phone: org.phone,
        planTier: org.planTier,
        subscriptionStatus: org.subscriptionStatus,
        trialEndsAt: org.trialEndsAt,
        currentPeriodEnd: org.currentPeriodEnd,
        isActive: org.isActive,
        createdAt: org.createdAt,
        usersCount: org._count.users,
        orders30d: paid?.orders30d ?? 0,
        sales30d: paid?.sales30d ?? 0,
        mrr: org.isActive ? PLANS[org.planTier].price : 0,
        lastOrderAt: lastOrderMap.get(org.id) ?? null,
      };
    });

    const summary = {
      totalOrganizations: organizationsWithMetrics.length,
      activeOrganizations: organizationsWithMetrics.filter((o) => o.isActive).length,
      trialingOrganizations: organizationsWithMetrics.filter((o) => o.subscriptionStatus === SubscriptionStatus.TRIALING).length,
      pastDueOrganizations: organizationsWithMetrics.filter((o) => o.subscriptionStatus === SubscriptionStatus.PAST_DUE).length,
      canceledOrganizations: organizationsWithMetrics.filter((o) => o.subscriptionStatus === SubscriptionStatus.CANCELED).length,
      newOrganizations30d: organizationsWithMetrics.filter((o) => o.createdAt >= last30).length,
      totalUsers: usersCount,
      totalOrders30d: orders30Count,
      totalSales30d: organizationsWithMetrics.reduce((sum, o) => sum + o.sales30d, 0),
      monthlyRecurringRevenue: organizationsWithMetrics.reduce((sum, o) => sum + o.mrr, 0),
      planCounts: {
        STARTER: organizationsWithMetrics.filter((o) => o.planTier === PlanTier.STARTER).length,
        PROFESSIONAL: organizationsWithMetrics.filter((o) => o.planTier === PlanTier.PROFESSIONAL).length,
        ENTERPRISE: organizationsWithMetrics.filter((o) => o.planTier === PlanTier.ENTERPRISE).length,
      },
    };

    res.json({ summary, organizations: organizationsWithMetrics });
  } catch (err) {
    next(err);
  }
}

const updateOrgSchema = z.object({
  isActive: z.boolean().optional(),
  planTier: z.nativeEnum(PlanTier).optional(),
  subscriptionStatus: z.nativeEnum(SubscriptionStatus).optional(),
});

export async function updateOrganizationAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: 'Invalid organization id' });
      return;
    }

    const data = updateOrgSchema.parse(req.body);

    const updated = await basePrisma.organization.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        planTier: true,
        subscriptionStatus: true,
        isActive: true,
        updatedAt: true,
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}
