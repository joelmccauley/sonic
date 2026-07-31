import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { getOrganizationId } from './tenantContext';

/**
 * Models that carry an organizationId column and must be tenant-scoped.
 * Child tables (OrderItem, Modifier, etc.) are scoped through their parents.
 */
const TENANT_MODELS = new Set([
  'User',
  'Table',
  'MenuCategory',
  'MenuItem',
  'ModifierGroup',
  'Order',
  'Payment',
  'Discount',
  'Shift',
  'InventoryItem',
  'Customer',
  'AuditLog',
  'Printer',
  'Setting',
]);

const READ_FILTER_OPS = new Set([
  'findMany', 'findFirst', 'findFirstOrThrow', 'count', 'aggregate', 'groupBy', 'updateMany', 'deleteMany',
]);

const basePrisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

basePrisma.$on('error', (e) => logger.error('Prisma error', e));
basePrisma.$on('warn', (e) => logger.warn('Prisma warning', e));

/**
 * Tenant-scoping extension: transparently injects `organizationId` into
 * queries/creates for tenant models whenever a request-scoped tenant
 * context exists (set by the auth middleware). Queries executed outside a
 * tenant context (platform-level code: signup, webhooks, seeds) run unscoped.
 */
const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const orgId = getOrganizationId();
        if (orgId === undefined || !model || !TENANT_MODELS.has(model)) {
          return query(args);
        }

        const a: any = args ?? {};

        if (READ_FILTER_OPS.has(operation)) {
          a.where = { AND: [a.where ?? {}, { organizationId: orgId }] };
          return query(a);
        }

        if (operation === 'create') {
          a.data = { ...a.data, organizationId: orgId };
          return query(a);
        }

        if (operation === 'createMany') {
          if (Array.isArray(a.data)) a.data = a.data.map((d: any) => ({ ...d, organizationId: orgId }));
          else a.data = { ...a.data, organizationId: orgId };
          return query(a);
        }

        if (operation === 'upsert') {
          a.create = { ...a.create, organizationId: orgId };
          const result: any = await query(a);
          if (result && result.organizationId !== undefined && result.organizationId !== orgId) {
            throw Object.assign(new Error(`${model} not found`), { code: 'P2025' });
          }
          return result;
        }

        if (operation === 'findUnique' || operation === 'findUniqueOrThrow') {
          const result: any = await query(a);
          if (result && result.organizationId !== undefined && result.organizationId !== orgId) {
            if (operation === 'findUniqueOrThrow') {
              throw Object.assign(new Error(`${model} not found`), { code: 'P2025' });
            }
            return null;
          }
          return result;
        }

        if (operation === 'update' || operation === 'delete') {
          // Verify the target row belongs to the tenant before mutating.
          const existing: any = await (basePrisma as any)[
            model.charAt(0).toLowerCase() + model.slice(1)
          ].findFirst({ where: { AND: [a.where, { organizationId: orgId }] }, select: { id: true } });
          if (!existing) {
            throw Object.assign(new Error(`${model} not found`), { code: 'P2025' });
          }
          return query(a);
        }

        return query(a);
      },
    },
  },
});

export { prisma, basePrisma };
