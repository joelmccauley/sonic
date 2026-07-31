import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

const inventoryWriteSchema = z.object({
  quantity: z.number(),
  unit: z.string().min(1).optional(),
  lowThreshold: z.number().nullable().optional(),
});

const customInventorySchema = inventoryWriteSchema.extend({
  name: z.string().min(2).max(120),
  sku: z.string().max(64).optional().nullable(),
});

function toInventoryRow(item: {
  id: number;
  menuItemId: number | null;
  customName: string | null;
  customSku: string | null;
  quantity: unknown;
  unit: string;
  lowThreshold: unknown;
  updatedAt: Date;
  menuItem?: {
    id: number;
    name: string;
    sku: string | null;
    isActive: boolean;
    trackInventory: boolean;
    category?: { name: string } | null;
  } | null;
}) {
  return {
    id: item.id,
    kind: item.menuItemId ? 'menu' : 'custom',
    menuItemId: item.menuItemId,
    name: item.menuItem?.name ?? item.customName ?? 'Untitled Inventory Item',
    sku: item.menuItem?.sku ?? item.customSku,
    category: item.menuItem?.category ? { name: item.menuItem.category.name } : null,
    quantity: item.quantity,
    unit: item.unit,
    lowThreshold: item.lowThreshold,
    updatedAt: item.updatedAt,
  };
}

function isTrackedInventory(item: {
  menuItemId: number | null;
  menuItem?: { isActive: boolean; trackInventory: boolean } | null;
}) {
  return item.menuItemId == null || (!!item.menuItem?.isActive && !!item.menuItem?.trackInventory);
}

export async function getInventory(_req: Request, res: Response, next: NextFunction) {
  try {
    const items = await prisma.inventoryItem.findMany({
      include: {
        menuItem: {
          include: { category: { select: { name: true } } },
        },
      },
      orderBy: [
        { customName: 'asc' },
        { menuItem: { name: 'asc' } },
      ],
    });
    res.json(items.filter(isTrackedInventory).map(toInventoryRow));
  } catch (err) {
    next(err);
  }
}

export async function getLowStock(_req: Request, res: Response, next: NextFunction) {
  try {
    const items = await prisma.inventoryItem.findMany({
      include: { menuItem: { include: { category: { select: { name: true } } } } },
      orderBy: [
        { customName: 'asc' },
        { menuItem: { name: 'asc' } },
      ],
    });

    const lowStock = items
      .filter(isTrackedInventory)
      .filter((i) => i.lowThreshold && Number(i.quantity) <= Number(i.lowThreshold));
    res.json(lowStock.map(toInventoryRow));
  } catch (err) {
    next(err);
  }
}

export async function updateInventory(req: Request, res: Response, next: NextFunction) {
  try {
    const menuItemId = parseInt(req.params.menuItemId);
    const data = inventoryWriteSchema.parse(req.body);

    const item = await prisma.inventoryItem.upsert({
      where: { menuItemId },
      update: data,
      create: { menuItemId, ...data, unit: data.unit ?? 'units', organizationId: req.user!.organizationId },
    });
    res.json(item);
  } catch (err) {
    next(err);
  }
}

export async function createCustomInventory(req: Request, res: Response, next: NextFunction) {
  try {
    const data = customInventorySchema.parse(req.body);
    const item = await prisma.inventoryItem.create({
      data: {
        organizationId: req.user!.organizationId,
        customName: data.name.trim(),
        customSku: data.sku?.trim() || null,
        quantity: data.quantity,
        unit: data.unit ?? 'units',
        lowThreshold: data.lowThreshold ?? null,
      },
      include: { menuItem: { include: { category: { select: { name: true } } } } },
    });
    res.status(201).json(toInventoryRow(item));
  } catch (err) {
    next(err);
  }
}

export async function updateInventoryItem(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const data = customInventorySchema.partial().parse(req.body);

    const existing = await prisma.inventoryItem.findUnique({
      where: { id },
      include: { menuItem: { include: { category: { select: { name: true } } } } },
    });
    if (!existing) throw new AppError(404, 'Inventory item not found');

    if (existing.menuItemId && (data.name !== undefined || data.sku !== undefined)) {
      throw new AppError(400, 'Menu-linked inventory names are managed from the menu item');
    }

    const item = await prisma.inventoryItem.update({
      where: { id },
      data: {
        customName: existing.menuItemId ? undefined : (data.name?.trim() ?? undefined),
        customSku: existing.menuItemId ? undefined : (data.sku === undefined ? undefined : data.sku?.trim() || null),
        quantity: data.quantity,
        unit: data.unit,
        lowThreshold: data.lowThreshold,
      },
      include: { menuItem: { include: { category: { select: { name: true } } } } },
    });

    res.json(toInventoryRow(item));
  } catch (err) {
    next(err);
  }
}

export async function adjustInventory(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = z.object({ menuItemId: z.number().int(), adjustment: z.number(), reason: z.string().optional() });
    const { menuItemId, adjustment } = schema.parse(req.body);

    const existing = await prisma.inventoryItem.findUnique({ where: { menuItemId } });
    if (!existing) throw new AppError(404, 'Inventory item not found');

    const item = await prisma.inventoryItem.update({
      where: { menuItemId },
      data: { quantity: { increment: adjustment } },
    });
    res.json(item);
  } catch (err) {
    next(err);
  }
}

export async function adjustInventoryItem(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const schema = z.object({ adjustment: z.number(), reason: z.string().optional() });
    const { adjustment } = schema.parse(req.body);

    const existing = await prisma.inventoryItem.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, 'Inventory item not found');

    const item = await prisma.inventoryItem.update({
      where: { id },
      data: { quantity: { increment: adjustment } },
      include: { menuItem: { include: { category: { select: { name: true } } } } },
    });
    res.json(toInventoryRow(item));
  } catch (err) {
    next(err);
  }
}

export async function deleteCustomInventory(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.inventoryItem.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, 'Inventory item not found');
    if (existing.menuItemId) throw new AppError(400, 'Menu-linked inventory must be removed from tracking on the menu item');

    await prisma.inventoryItem.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
