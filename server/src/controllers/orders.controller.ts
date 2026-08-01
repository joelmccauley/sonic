import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { OrderType, OrderStatus, ItemStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { generateOrderNumber } from '../utils/helpers';
import { emitOrderUpdate, emitKDSUpdate } from '../services/websocket.service';
import { auditService } from '../services/audit.service';
import { ORDER_TYPE_SETTING_KEYS, getEnabledOrderTypeMap } from '../config/orderTypes';

const ORDER_INCLUDE = {
  table: true,
  server: { select: { id: true, firstName: true, lastName: true } },
  customer: true,
  items: {
    include: {
      menuItem: { select: { id: true, name: true, categoryId: true } },
      modifiers: { include: { modifier: true } },
    },
    orderBy: { id: 'asc' as const },
  },
  payments: true,
  discounts: { include: { discount: true } },
};

export async function getOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, type, date, tableId, limit = '50', offset = '0' } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (tableId) where.tableId = parseInt(String(tableId));
    if (date) {
      const d = new Date(String(date));
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      where.createdAt = { gte: d, lt: next };
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: ORDER_INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: parseInt(String(limit)),
        skip: parseInt(String(offset)),
      }),
      prisma.order.count({ where }),
    ]);

    res.json({ orders, total, limit: parseInt(String(limit)), offset: parseInt(String(offset)) });
  } catch (err) {
    next(err);
  }
}

export async function getOpenOrders(_req: Request, res: Response, next: NextFunction) {
  try {
    const orders = await prisma.order.findMany({
      where: { status: { in: [OrderStatus.OPEN, OrderStatus.SENT_TO_KITCHEN, OrderStatus.IN_PROGRESS, OrderStatus.READY] } },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    res.json(orders);
  } catch (err) {
    next(err);
  }
}

export async function getKDSOrders(_req: Request, res: Response, next: NextFunction) {
  try {
    const orders = await prisma.order.findMany({
      where: {
        status: { in: [OrderStatus.SENT_TO_KITCHEN, OrderStatus.IN_PROGRESS] },
        items: { some: { status: { in: [ItemStatus.SENT, ItemStatus.IN_PROGRESS] } } },
      },
      include: {
        table: { select: { name: true, section: true } },
        server: { select: { firstName: true } },
        items: {
          where: { status: { in: [ItemStatus.SENT, ItemStatus.IN_PROGRESS] } },
          include: {
            menuItem: { select: { name: true, categoryId: true } },
            modifiers: { include: { modifier: { select: { name: true } } } },
          },
          orderBy: { course: 'asc' },
        },
      },
      orderBy: { updatedAt: 'asc' },
    });
    res.json(orders);
  } catch (err) {
    next(err);
  }
}

export async function getOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: parseInt(req.params.id) },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new AppError(404, 'Order not found');
    res.json(order);
  } catch (err) {
    next(err);
  }
}

export async function createOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = z.object({
      type: z.nativeEnum(OrderType).default(OrderType.DINE_IN),
      tableId: z.number().int().optional(),
      guestCount: z.number().int().positive().optional(),
      customerName: z.string().optional(),
      customerPhone: z.string().optional(),
      customerId: z.number().int().optional(),
      notes: z.string().optional(),
    });
    const data = schema.parse(req.body);
    const orderTypeSettings = await prisma.setting.findMany({
      where: { organizationId: req.user!.organizationId, key: { in: [...ORDER_TYPE_SETTING_KEYS] } },
      select: { key: true, value: true },
    });
    const orderTypeMap = getEnabledOrderTypeMap(Object.fromEntries(orderTypeSettings.map((setting) => [setting.key, setting.value])));
    if (!orderTypeMap[data.type]) throw new AppError(400, 'That order type is disabled');

    // Validate table availability
    if (data.tableId) {
      const table = await prisma.table.findUnique({ where: { id: data.tableId } });
      if (!table) throw new AppError(404, 'Table not found');
      if (table.status === 'OCCUPIED') throw new AppError(409, 'Table is already occupied');
    }

    const settings = await prisma.setting.findFirst({ where: { key: 'order_number_prefix' } });
    const prefix = settings?.value ?? 'ORD';
    const orderNumber = generateOrderNumber(prefix);

    const order = await prisma.order.create({
      data: {
        ...data,
        organizationId: req.user!.organizationId,
        orderNumber,
        serverId: req.user!.userId,
      },
      include: ORDER_INCLUDE,
    });

    // Mark table as occupied
    if (data.tableId) {
      await prisma.table.update({ where: { id: data.tableId }, data: { status: 'OCCUPIED' } });
    }

    await auditService.log(req.user!.userId, 'CREATE_ORDER', 'Order', String(order.id), { orderNumber, type: data.type });
    emitOrderUpdate(order);
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
}

export async function updateOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const schema = z.object({
      notes: z.string().optional(),
      guestCount: z.number().int().positive().optional(),
      customerName: z.string().optional(),
      customerPhone: z.string().optional(),
      customerId: z.number().int().optional(),
    });
    const data = schema.parse(req.body);
    const order = await prisma.order.update({ where: { id }, data, include: ORDER_INCLUDE });
    emitOrderUpdate(order);
    res.json(order);
  } catch (err) {
    next(err);
  }
}

export async function updateOrderStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const { status } = z.object({ status: z.nativeEnum(OrderStatus) }).parse(req.body);

    const order = await prisma.order.update({
      where: { id },
      data: { status, ...(status === 'PAID' ? { closedAt: new Date() } : {}) },
      include: ORDER_INCLUDE,
    });

    // Free up the table
    if ((status === OrderStatus.PAID || status === OrderStatus.VOIDED) && order.tableId) {
      const hasOtherOpenOrders = await prisma.order.count({
        where: { tableId: order.tableId, status: { in: [OrderStatus.OPEN, OrderStatus.SENT_TO_KITCHEN, OrderStatus.IN_PROGRESS, OrderStatus.READY] }, id: { not: id } },
      });
      if (!hasOtherOpenOrders) {
        await prisma.table.update({ where: { id: order.tableId }, data: { status: 'AVAILABLE' } });
      }
    }

    emitOrderUpdate(order);
    res.json(order);
  } catch (err) {
    next(err);
  }
}

export async function addOrderItem(req: Request, res: Response, next: NextFunction) {
  try {
    const orderId = parseInt(req.params.id);
    const schema = z.object({
      menuItemId: z.number().int(),
      quantity: z.number().int().positive().default(1),
      notes: z.string().optional(),
      course: z.number().int().default(1),
      modifiers: z.array(z.object({ modifierId: z.number().int(), price: z.number() })).default([]),
    });
    const data = schema.parse(req.body);

    const menuItem = await prisma.menuItem.findUnique({ where: { id: data.menuItemId } });
    if (!menuItem || !menuItem.isActive) throw new AppError(404, 'Menu item not found or unavailable');

    const orderItem = await prisma.orderItem.create({
      data: {
        orderId,
        menuItemId: data.menuItemId,
        quantity: data.quantity,
        unitPrice: menuItem.price,
        notes: data.notes,
        course: data.course,
        modifiers: {
          create: data.modifiers.map((m) => ({ modifierId: m.modifierId, price: m.price })),
        },
      },
      include: {
        menuItem: { select: { name: true, categoryId: true } },
        modifiers: { include: { modifier: true } },
      },
    });

    // Recalculate order totals
    await recalcOrder(orderId);

    const order = await prisma.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
    emitOrderUpdate(order!);
    res.status(201).json(orderItem);
  } catch (err) {
    next(err);
  }
}

export async function updateItemStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const orderId = parseInt(req.params.id);
    const itemId = parseInt(req.params.itemId);
    const { status } = z.object({ status: z.nativeEnum(ItemStatus) }).parse(req.body);

    await prisma.orderItem.update({ where: { id: itemId, orderId }, data: { status } });

    const order = await prisma.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
    emitOrderUpdate(order!);
    emitKDSUpdate(order!);
    res.json({ message: 'Item status updated' });
  } catch (err) {
    next(err);
  }
}

export async function updateOrderItem(req: Request, res: Response, next: NextFunction) {
  try {
    const orderId = parseInt(req.params.id);
    const itemId = parseInt(req.params.itemId);
    const schema = z.object({
      quantity: z.number().int().positive().optional(),
      notes: z.string().optional(),
      course: z.number().int().optional(),
    });
    const data = schema.parse(req.body);

    await prisma.orderItem.update({ where: { id: itemId, orderId }, data });
    await recalcOrder(orderId);

    const order = await prisma.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
    emitOrderUpdate(order!);
    res.json({ message: 'Item updated' });
  } catch (err) {
    next(err);
  }
}

export async function voidOrderItem(req: Request, res: Response, next: NextFunction) {
  try {
    const orderId = parseInt(req.params.id);
    const itemId = parseInt(req.params.itemId);
    const { reason } = z.object({ reason: z.string().optional() }).parse(req.body);

    await prisma.orderItem.update({
      where: { id: itemId, orderId },
      data: { status: ItemStatus.VOIDED, voidedAt: new Date(), voidReason: reason },
    });

    await recalcOrder(orderId);
    await auditService.log(req.user!.userId, 'VOID_ITEM', 'OrderItem', String(itemId), { reason });

    const order = await prisma.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
    emitOrderUpdate(order!);
    res.json({ message: 'Item voided' });
  } catch (err) {
    next(err);
  }
}

export async function sendToKitchen(req: Request, res: Response, next: NextFunction) {
  try {
    const orderId = parseInt(req.params.id);

    // Mark pending items as SENT
    await prisma.orderItem.updateMany({
      where: { orderId, status: ItemStatus.PENDING },
      data: { status: ItemStatus.SENT, sentAt: new Date() },
    });

    const order = await prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.SENT_TO_KITCHEN },
      include: ORDER_INCLUDE,
    });

    await auditService.log(req.user!.userId, 'SEND_TO_KITCHEN', 'Order', String(orderId));
    emitOrderUpdate(order);
    emitKDSUpdate(order);
    res.json(order);
  } catch (err) {
    next(err);
  }
}

export async function transferTable(req: Request, res: Response, next: NextFunction) {
  try {
    const orderId = parseInt(req.params.id);
    const { tableId } = z.object({ tableId: z.number().int() }).parse(req.body);

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError(404, 'Order not found');

    const newTable = await prisma.table.findUnique({ where: { id: tableId } });
    if (!newTable) throw new AppError(404, 'Table not found');

    // Free old table if no other orders
    if (order.tableId) {
      const otherOrders = await prisma.order.count({
        where: { tableId: order.tableId, status: { in: ['OPEN', 'SENT_TO_KITCHEN', 'IN_PROGRESS', 'READY'] }, id: { not: orderId } },
      });
      if (!otherOrders) {
        await prisma.table.update({ where: { id: order.tableId }, data: { status: 'AVAILABLE' } });
      }
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { tableId },
      include: ORDER_INCLUDE,
    });

    await prisma.table.update({ where: { id: tableId }, data: { status: 'OCCUPIED' } });
    await auditService.log(req.user!.userId, 'TRANSFER_TABLE', 'Order', String(orderId), { from: order.tableId, to: tableId });

    emitOrderUpdate(updated);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function splitCheck(req: Request, res: Response, next: NextFunction) {
  try {
    const orderId = parseInt(req.params.id);
    const { itemIds } = z.object({ itemIds: z.array(z.number().int()) }).parse(req.body);

    const originalOrder = await prisma.order.findUnique({ where: { id: orderId } });
    if (!originalOrder) throw new AppError(404, 'Order not found');

    const settings = await prisma.setting.findFirst({ where: { key: 'order_number_prefix' } });
    const prefix = settings?.value ?? 'ORD';

    // Create new split order
    const newOrder = await prisma.order.create({
      data: {
        organizationId: req.user!.organizationId,
        orderNumber: generateOrderNumber(prefix + 'S'),
        type: originalOrder.type,
        tableId: originalOrder.tableId,
        serverId: originalOrder.serverId,
        customerName: originalOrder.customerName,
        notes: `Split from #${originalOrder.orderNumber}`,
      },
    });

    // Move selected items to new order
    await prisma.orderItem.updateMany({
      where: { id: { in: itemIds }, orderId },
      data: { orderId: newOrder.id },
    });

    await recalcOrder(orderId);
    await recalcOrder(newOrder.id);

    const [original, split] = await Promise.all([
      prisma.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE }),
      prisma.order.findUnique({ where: { id: newOrder.id }, include: ORDER_INCLUDE }),
    ]);

    emitOrderUpdate(original!);
    res.json({ original, split });
  } catch (err) {
    next(err);
  }
}

export async function applyDiscount(req: Request, res: Response, next: NextFunction) {
  try {
    const orderId = parseInt(req.params.id);
    const { discountId, managerPin } = z.object({ discountId: z.number().int(), managerPin: z.string().optional() }).parse(req.body);

    const discount = await prisma.discount.findUnique({ where: { id: discountId } });
    if (!discount || !discount.isActive) throw new AppError(404, 'Discount not found or inactive');

    if (discount.requiresPin) {
      if (!managerPin) throw new AppError(403, 'Manager PIN required for this discount');
      // Validate against any manager/owner
      const managers = await prisma.user.findMany({ where: { role: { in: ['MANAGER', 'OWNER'] }, isActive: true } });
      const bcrypt = require('bcryptjs');
      const valid = await Promise.any(managers.map((m) => bcrypt.compare(managerPin, m.pin)));
      if (!valid) throw new AppError(403, 'Invalid manager PIN');
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError(404, 'Order not found');

    let discountAmount = 0;
    if (discount.type === 'PERCENTAGE') discountAmount = (Number(order.subtotal) * Number(discount.value)) / 100;
    else if (discount.type === 'FLAT') discountAmount = Math.min(Number(discount.value), Number(order.subtotal));
    else if (discount.type === 'COMP') discountAmount = Number(order.subtotal);

    await prisma.orderDiscount.create({ data: { orderId, discountId, amount: discountAmount } });
    await recalcOrder(orderId);

    const updated = await prisma.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
    await auditService.log(req.user!.userId, 'APPLY_DISCOUNT', 'Order', String(orderId), { discountId, amount: discountAmount });
    emitOrderUpdate(updated!);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function removeDiscount(req: Request, res: Response, next: NextFunction) {
  try {
    const orderId = parseInt(req.params.id);
    const discountId = parseInt(req.params.discountId);

    await prisma.orderDiscount.deleteMany({ where: { orderId, discountId } });
    await recalcOrder(orderId);

    const order = await prisma.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
    emitOrderUpdate(order!);
    res.json(order);
  } catch (err) {
    next(err);
  }
}

export async function voidOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const { reason } = z.object({ reason: z.string().optional() }).parse(req.body);

    const order = await prisma.order.update({
      where: { id },
      data: { status: OrderStatus.VOIDED, closedAt: new Date(), notes: reason },
      include: ORDER_INCLUDE,
    });

    // Free table
    if (order.tableId) {
      await prisma.table.update({ where: { id: order.tableId }, data: { status: 'AVAILABLE' } });
    }

    await auditService.log(req.user!.userId, 'VOID_ORDER', 'Order', String(id), { reason });
    emitOrderUpdate(order);
    res.json(order);
  } catch (err) {
    next(err);
  }
}

export async function getReceipt(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        ...ORDER_INCLUDE,
        table: true,
        server: { select: { firstName: true, lastName: true } },
      },
    });
    if (!order) throw new AppError(404, 'Order not found');

    const settings = await prisma.setting.findMany({
      where: { key: { in: ['restaurant_name', 'address', 'phone', 'receipt_footer'] } },
    });
    const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));

    res.json({ order, settings: settingsMap });
  } catch (err) {
    next(err);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function recalcOrder(orderId: number): Promise<void> {
  const items = await prisma.orderItem.findMany({
    where: { orderId, status: { not: ItemStatus.VOIDED } },
    include: { modifiers: true },
  });

  const subtotal = items.reduce((sum, item) => {
    const base = Number(item.unitPrice) * item.quantity;
    const mods = item.modifiers.reduce((ms, m) => ms + Number(m.price), 0);
    return sum + base + mods * item.quantity;
  }, 0);

  const discounts = await prisma.orderDiscount.findMany({ where: { orderId } });
  const discountAmount = discounts.reduce((s, d) => s + Number(d.amount), 0);

  const settings = await prisma.setting.findFirst({ where: { key: 'tax_rate' } });
  const taxRate = parseFloat(settings?.value ?? '0.0875');
  const taxableSubtotal = Math.max(0, subtotal - discountAmount);
  const taxAmount = taxableSubtotal * taxRate;

  const payments = await prisma.payment.findMany({ where: { orderId } });
  const tipAmount = payments.reduce((s, p) => s + Number(p.tip), 0);
  const total = taxableSubtotal + taxAmount + tipAmount;

  await prisma.order.update({
    where: { id: orderId },
    data: {
      subtotal,
      discountAmount,
      taxAmount: Math.round(taxAmount * 100) / 100,
      tipAmount,
      total: Math.round(total * 100) / 100,
    },
  });
}
