import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OrderStatus, OrderType, ItemStatus } from '@prisma/client';
import { basePrisma } from '../config/database';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import { generateOrderNumber, round2 } from '../utils/helpers';
import { emitKDSUpdate, emitOrderUpdate } from '../services/websocket.service';
import { ORDER_TYPE_SETTING_KEYS, getEnabledOrderTypeMap } from '../config/orderTypes';

const publicItemSchema = z.object({
  menuItemId: z.number().int(),
  quantity: z.number().int().positive().default(1),
  notes: z.string().optional(),
  course: z.number().int().default(1),
  modifiers: z.array(z.object({ modifierId: z.number().int() })).default([]),
});

const createPublicOrderSchema = z.object({
  type: z.nativeEnum(OrderType).default(OrderType.TO_GO),
  customerName: z.string().min(1),
  customerEmail: z.string().email().optional().or(z.literal('')),
  customerPassword: z.string().min(8).optional().or(z.literal('')),
  customerPhone: z.string().optional().or(z.literal('')),
  emailOptIn: z.boolean().default(true),
  textOptIn: z.boolean().default(true),
  notes: z.string().optional(),
  guestCount: z.number().int().positive().optional(),
  items: z.array(publicItemSchema).min(1),
});

const customerLoginSchema = z.object({
  orderNumber: z.string().min(1),
  identifier: z.string().min(1),
});

const customerPasswordLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

function signCustomerToken(payload: { customerId: number; organizationId: number }) {
  return jwt.sign({ ...payload, scope: 'customer_order' }, env.JWT_SECRET, { expiresIn: '30d' });
}

function assertStoreAvailable(store: { isActive: boolean; subscriptionStatus: OrderStatus | any; trialEndsAt: Date | null }) {
  if (!store.isActive) throw new AppError(404, 'Store not found');
  if (store.subscriptionStatus === 'CANCELED') {
    throw new AppError(402, 'This store is temporarily unavailable');
  }
  if (store.subscriptionStatus === 'TRIALING' && store.trialEndsAt && store.trialEndsAt.getTime() < Date.now()) {
    throw new AppError(402, 'This store trial has expired');
  }
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? name.trim(),
    lastName: parts.slice(1).join(' ') || null,
  };
}

async function getStoreSettingsMap(storeId: number) {
  const settings = await basePrisma.setting.findMany({
    where: { organizationId: storeId, key: { in: [...ORDER_TYPE_SETTING_KEYS, 'restaurant_name', 'logo_url', 'currency', 'timezone', 'receipt_footer', 'storefront_background_color', 'storefront_surface_color', 'storefront_surface_alt_color', 'storefront_primary_color', 'storefront_accent_color', 'storefront_border_color', 'storefront_muted_text_color', 'storefront_text_color'] } },
    select: { key: true, value: true },
  });
  return Object.fromEntries(settings.map((setting) => [setting.key, setting.value])) as Record<string, string>;
}

async function recalcOrderTotals(orderId: number): Promise<void> {
  const items = await basePrisma.orderItem.findMany({
    where: { orderId, status: { not: ItemStatus.VOIDED } },
    include: { modifiers: true },
  });

  const subtotal = items.reduce((sum, item) => {
    const base = Number(item.unitPrice) * item.quantity;
    const mods = item.modifiers.reduce((ms, m) => ms + Number(m.price), 0);
    return sum + base + mods * item.quantity;
  }, 0);

  const discounts = await basePrisma.orderDiscount.findMany({ where: { orderId } });
  const discountAmount = discounts.reduce((sum, discount) => sum + Number(discount.amount), 0);

  const settings = await basePrisma.setting.findFirst({ where: { key: 'tax_rate' } });
  const taxRate = parseFloat(settings?.value ?? '0.0875');
  const taxableSubtotal = Math.max(0, subtotal - discountAmount);
  const taxAmount = taxableSubtotal * taxRate;

  const payments = await basePrisma.payment.findMany({ where: { orderId } });
  const tipAmount = payments.reduce((sum, payment) => sum + Number(payment.tip), 0);
  const total = taxableSubtotal + taxAmount + tipAmount;

  await basePrisma.order.update({
    where: { id: orderId },
    data: {
      subtotal: round2(subtotal),
      discountAmount: round2(discountAmount),
      taxAmount: round2(taxAmount),
      tipAmount: round2(tipAmount),
      total: round2(total),
    },
  });
}

async function resolveStore(slug: string) {
  const org = await basePrisma.organization.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      phone: true,
      isActive: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      settings: {
        where: {
          key: {
            in: [
              'restaurant_name',
              'logo_url',
              'currency',
              'timezone',
              'receipt_footer',
              'storefront_background_color',
              'storefront_surface_color',
              'storefront_surface_alt_color',
              'storefront_primary_color',
              'storefront_accent_color',
              'storefront_border_color',
              'storefront_muted_text_color',
              'storefront_text_color',
              ...ORDER_TYPE_SETTING_KEYS,
            ],
          },
        },
        select: { key: true, value: true },
      },
    },
  });

  if (!org) {
    throw new AppError(404, 'Store not found');
  }

  assertStoreAvailable(org);

  return org;
}

export async function getStorefront(req: Request, res: Response, next: NextFunction) {
  try {
    const slug = (req.params.slug ?? '').toLowerCase().trim();
    if (!slug) throw new AppError(400, 'Store code required');

    const store = await resolveStore(slug);
    const settingsMap = Object.fromEntries(store.settings.map((setting) => [setting.key, setting.value]));
    const orderTypes = getEnabledOrderTypeMap(settingsMap);

    const [categories, items] = await Promise.all([
      basePrisma.menuCategory.findMany({
        where: { organizationId: store.id, isActive: true },
        include: { _count: { select: { items: true } } },
        orderBy: { sortOrder: 'asc' },
      }),
      basePrisma.menuItem.findMany({
        where: { organizationId: store.id, isActive: true, isAvailable: true },
        include: {
          category: true,
          modifierGroups: {
            include: {
              modifierGroup: {
                include: {
                  items: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
                },
              },
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: [{ categoryId: 'asc' }, { sortOrder: 'asc' }],
      }),
    ]);

    res.json({
      store: {
        id: store.id,
        name: settingsMap.restaurant_name ?? store.name,
        slug: store.slug,
        phone: store.phone,
        logoUrl: settingsMap.logo_url ?? null,
        currency: settingsMap.currency ?? 'USD',
        timezone: settingsMap.timezone ?? 'America/Chicago',
        receiptFooter: settingsMap.receipt_footer ?? '',
        orderTypes,
        storefrontTheme: {
          backgroundColor: settingsMap.storefront_background_color ?? '#05070d',
          surfaceColor: settingsMap.storefront_surface_color ?? '#111722',
          surfaceAltColor: settingsMap.storefront_surface_alt_color ?? '#0e1420',
          primaryColor: settingsMap.storefront_primary_color ?? '#7db4e8',
          accentColor: settingsMap.storefront_accent_color ?? '#1d5fae',
          borderColor: settingsMap.storefront_border_color ?? '#1f2a38',
          mutedTextColor: settingsMap.storefront_muted_text_color ?? '#9fb4cc',
          textColor: settingsMap.storefront_text_color ?? '#e8eef7',
        },
      },
      categories,
      items,
    });
  } catch (err) {
    next(err);
  }
}

export async function placeOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const slug = (req.params.slug ?? '').toLowerCase().trim();
    if (!slug) throw new AppError(400, 'Store code required');

    const store = await resolveStore(slug);
    const data = createPublicOrderSchema.parse(req.body);
    const settingsMap = await getStoreSettingsMap(store.id);
    const orderTypes = getEnabledOrderTypeMap(settingsMap);
    if (!orderTypes[data.type]) throw new AppError(400, 'That order type is disabled');
    const prefixSetting = await basePrisma.setting.findFirst({ where: { organizationId: store.id, key: 'order_number_prefix' } });
    const prefix = prefixSetting?.value ?? 'ORD';

    const menuItems = await basePrisma.menuItem.findMany({
      where: {
        organizationId: store.id,
        id: { in: data.items.map((item) => item.menuItemId) },
        isActive: true,
        isAvailable: true,
      },
      include: {
        modifierGroups: {
          include: {
            modifierGroup: {
              include: { items: { where: { isActive: true } } },
            },
          },
        },
      },
    });

    if (menuItems.length !== data.items.length) {
      throw new AppError(400, 'One or more menu items are unavailable');
    }

    const orderNumber = generateOrderNumber(prefix);
    const { firstName, lastName } = splitName(data.customerName);
    const cleanEmail = data.customerEmail?.trim() || null;
    const cleanPassword = data.customerPassword?.trim() || null;
    const cleanPhone = data.customerPhone?.trim() || null;

    if (cleanPassword && !cleanEmail) {
      throw new AppError(400, 'Email is required to create a password-based customer account');
    }

    const passwordHash = cleanPassword ? await bcrypt.hash(cleanPassword, 12) : null;

    const customerMatch = cleanEmail || cleanPhone
      ? await basePrisma.customer.findFirst({
          where: {
            organizationId: store.id,
            OR: [
              ...(cleanEmail ? [{ email: cleanEmail }] : []),
              ...(cleanPhone ? [{ phone: cleanPhone }] : []),
            ],
          },
        })
      : null;

    const created = await basePrisma.$transaction(async (tx) => {
      const customerData: any = {
        firstName,
        lastName,
        ...(cleanEmail ? { email: cleanEmail } : {}),
        ...(passwordHash ? { password: passwordHash } : {}),
        ...(cleanPhone ? { phone: cleanPhone } : {}),
        emailOptIn: data.emailOptIn,
        textOptIn: data.textOptIn,
      };

      const customer = customerMatch
        ? await tx.customer.update({
            where: { id: customerMatch.id },
            data: customerData,
          })
        : await tx.customer.create({
            data: {
              organizationId: store.id,
              ...customerData,
            },
          });

      const order = await tx.order.create({
        data: {
          organizationId: store.id,
          orderNumber,
          type: data.type,
          status: OrderStatus.SENT_TO_KITCHEN,
          customerId: customer.id,
          customerName: data.customerName,
          customerPhone: cleanPhone ?? undefined,
          guestCount: data.guestCount ?? 1,
          notes: data.notes,
        },
      });

      for (const item of data.items) {
        const menuItem = menuItems.find((current) => current.id === item.menuItemId);
        if (!menuItem) throw new AppError(400, 'One or more menu items are unavailable');

        const allowedModifierIds = new Set(
          menuItem.modifierGroups.flatMap((group) => group.modifierGroup.items.map((modifier) => modifier.id))
        );
        const selectedModifiers = item.modifiers.map((modifier) => {
          const allowed = menuItem.modifierGroups
            .flatMap((group) => group.modifierGroup.items)
            .find((candidate) => candidate.id === modifier.modifierId);
          if (!allowed || !allowedModifierIds.has(modifier.modifierId)) {
            throw new AppError(400, 'Invalid modifier selected for one of the items');
          }
          return { modifierId: allowed.id, price: Number(allowed.price) };
        });

        await tx.orderItem.create({
          data: {
            orderId: order.id,
            menuItemId: menuItem.id,
            quantity: item.quantity,
            unitPrice: menuItem.price,
            notes: item.notes,
            course: item.course,
            status: ItemStatus.SENT,
            sentAt: new Date(),
            modifiers: {
              create: selectedModifiers,
            },
          },
        });
      }

      return { order, customer };
    });

    await recalcOrderTotals(created.order.id);

    const [order, customerOrders] = await Promise.all([
      basePrisma.order.findUnique({
        where: { id: created.order.id },
        include: {
          items: { include: { menuItem: true, modifiers: { include: { modifier: true } } } },
          customer: true,
        },
      }),
      basePrisma.order.findMany({
        where: { organizationId: store.id, customerId: created.customer.id },
        include: {
          items: { include: { menuItem: { select: { name: true } }, modifiers: { include: { modifier: { select: { name: true } } } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const token = signCustomerToken({ customerId: created.customer.id, organizationId: store.id });

    if (order) {
      emitOrderUpdate(order);
      emitKDSUpdate(order);
    }

    res.status(201).json({
      order,
      customer: created.customer,
      token,
      recentOrders: customerOrders,
    });
  } catch (err) {
    next(err);
  }
}

export async function loginCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const slug = (req.params.slug ?? '').toLowerCase().trim();
    if (!slug) throw new AppError(400, 'Store code required');

    const store = await resolveStore(slug);
    const { orderNumber, identifier } = customerLoginSchema.parse(req.body);
    const normalized = identifier.trim();

    const order = await basePrisma.order.findFirst({
      where: {
        organizationId: store.id,
        orderNumber: orderNumber.trim(),
        OR: [
          { customerPhone: normalized },
          { customer: { email: normalized } },
          { customer: { phone: normalized } },
        ],
      },
      include: { customer: true },
    });

    if (!order || !order.customer) {
      throw new AppError(404, 'Order not found for that customer');
    }

    const token = signCustomerToken({ customerId: order.customer.id, organizationId: store.id });
    const recentOrders = await basePrisma.order.findMany({
      where: { organizationId: store.id, customerId: order.customer.id },
      include: {
        items: { include: { menuItem: { select: { name: true } }, modifiers: { include: { modifier: { select: { name: true } } } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    res.json({
      token,
      customer: order.customer,
      recentOrders,
    });
  } catch (err) {
    next(err);
  }
}

export async function loginCustomerWithPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const slug = (req.params.slug ?? '').toLowerCase().trim();
    if (!slug) throw new AppError(400, 'Store code required');

    const store = await resolveStore(slug);
    const { email, password } = customerPasswordLoginSchema.parse(req.body);

    const customer = await (basePrisma.customer as any).findFirst({
      where: {
        organizationId: store.id,
        email: email.trim().toLowerCase(),
      },
    });

    if (!customer?.password) throw new AppError(401, 'Invalid email or password');

    const valid = await bcrypt.compare(password, customer.password);
    if (!valid) throw new AppError(401, 'Invalid email or password');

    const token = signCustomerToken({ customerId: customer.id, organizationId: store.id });
    const recentOrders = await basePrisma.order.findMany({
      where: { organizationId: store.id, customerId: customer.id },
      include: {
        items: { include: { menuItem: { select: { name: true } }, modifiers: { include: { modifier: { select: { name: true } } } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    res.json({ token, customer, recentOrders });
  } catch (err) {
    next(err);
  }
}

export async function getCustomerAccount(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.customer) throw new AppError(401, 'Authentication required');

    const customer = await basePrisma.customer.findUnique({
      where: { id: req.customer.customerId },
    });
    if (!customer) throw new AppError(404, 'Customer not found');

    const orders = await basePrisma.order.findMany({
      where: { organizationId: req.customer.organizationId, customerId: customer.id },
      include: {
        items: { include: { menuItem: { select: { name: true } }, modifiers: { include: { modifier: { select: { name: true } } } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    res.json({ customer, orders });
  } catch (err) {
    next(err);
  }
}
