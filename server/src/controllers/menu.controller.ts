import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

const categorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  sortOrder: z.number().int().default(0),
});

const itemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
  cost: z.number().positive().optional(),
  categoryId: z.number().int(),
  sku: z.string().optional(),
  isTaxable: z.boolean().default(true),
  taxRate: z.number().optional(),
  sortOrder: z.number().int().default(0),
  trackInventory: z.boolean().default(false),
  calories: z.number().int().optional(),
  allergens: z.string().optional(),
  isPopular: z.boolean().default(false),
  modifierGroupIds: z.array(z.number().int()).default([]),
});

const modGroupSchema = z.object({
  name: z.string().min(1),
  required: z.boolean().default(false),
  multiSelect: z.boolean().default(true),
  minSelect: z.number().int().default(0),
  maxSelect: z.number().int().optional(),
});

const modifierSchema = z.object({
  name: z.string().min(1),
  price: z.number().default(0),
  sortOrder: z.number().int().default(0),
});

// ── Categories ────────────────────────────────────────────────────────────────

export async function getCategories(_req: Request, res: Response, next: NextFunction) {
  try {
    const categories = await prisma.menuCategory.findMany({
      where: { isActive: true },
      include: { _count: { select: { items: true } } },
      orderBy: { sortOrder: 'asc' },
    });
    res.json(categories);
  } catch (err) {
    next(err);
  }
}

export async function createCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const data = categorySchema.parse(req.body);
    const category = await prisma.menuCategory.create({ data: { ...data, organizationId: req.user!.organizationId } });
    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
}

export async function updateCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const data = categorySchema.partial().parse(req.body);
    const category = await prisma.menuCategory.update({ where: { id }, data });
    res.json(category);
  } catch (err) {
    next(err);
  }
}

export async function deleteCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    await prisma.menuCategory.update({ where: { id }, data: { isActive: false } });
    res.json({ message: 'Category removed' });
  } catch (err) {
    next(err);
  }
}

// ── Menu Items ────────────────────────────────────────────────────────────────

export async function getMenuItems(req: Request, res: Response, next: NextFunction) {
  try {
    const { categoryId, available } = req.query;
    const items = await prisma.menuItem.findMany({
      where: {
        isActive: true,
        ...(categoryId ? { categoryId: parseInt(String(categoryId)) } : {}),
        ...(available === 'true' ? { isAvailable: true } : {}),
      },
      include: {
        category: true,
        modifierGroups: {
          include: { modifierGroup: { include: { items: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: [{ categoryId: 'asc' }, { sortOrder: 'asc' }],
    });
    res.json(items);
  } catch (err) {
    next(err);
  }
}

export async function getMenuItem(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const item = await prisma.menuItem.findUnique({
      where: { id },
      include: {
        category: true,
        modifierGroups: {
          include: { modifierGroup: { include: { items: true } } },
        },
        inventoryItems: true,
      },
    });
    if (!item) throw new AppError(404, 'Menu item not found');
    res.json(item);
  } catch (err) {
    next(err);
  }
}

export async function createMenuItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { modifierGroupIds, ...itemData } = itemSchema.parse(req.body);

    const item = await prisma.menuItem.create({
      data: {
        ...itemData,
        organizationId: req.user!.organizationId,
        modifierGroups: {
          create: modifierGroupIds.map((id, idx) => ({ modifierGroupId: id, sortOrder: idx })),
        },
      },
      include: {
        category: true,
        modifierGroups: { include: { modifierGroup: { include: { items: true } } } },
      },
    });
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
}

export async function updateMenuItem(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const { modifierGroupIds, ...itemData } = itemSchema.partial().parse(req.body);

    const item = await prisma.menuItem.update({
      where: { id },
      data: {
        ...itemData,
        ...(modifierGroupIds !== undefined
          ? {
              modifierGroups: {
                deleteMany: {},
                create: modifierGroupIds.map((mgId, idx) => ({ modifierGroupId: mgId, sortOrder: idx })),
              },
            }
          : {}),
      },
      include: { category: true, modifierGroups: { include: { modifierGroup: { include: { items: true } } } } },
    });
    res.json(item);
  } catch (err) {
    next(err);
  }
}

export async function toggleMenuItem(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const item = await prisma.menuItem.findUnique({ where: { id }, select: { isActive: true } });
    if (!item) throw new AppError(404, 'Item not found');
    const updated = await prisma.menuItem.update({ where: { id }, data: { isActive: !item.isActive } });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function setItemAvailability(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const { isAvailable } = z.object({ isAvailable: z.boolean() }).parse(req.body);
    const item = await prisma.menuItem.update({ where: { id }, data: { isAvailable } });
    res.json(item);
  } catch (err) {
    next(err);
  }
}

export async function deleteMenuItem(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    await prisma.menuItem.update({ where: { id }, data: { isActive: false } });
    res.json({ message: 'Item removed' });
  } catch (err) {
    next(err);
  }
}

// ── Modifier Groups ───────────────────────────────────────────────────────────

export async function getModifierGroups(_req: Request, res: Response, next: NextFunction) {
  try {
    const groups = await prisma.modifierGroup.findMany({
      include: { items: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } },
    });
    res.json(groups);
  } catch (err) {
    next(err);
  }
}

export async function createModifierGroup(req: Request, res: Response, next: NextFunction) {
  try {
    const data = modGroupSchema.parse(req.body);
    const group = await prisma.modifierGroup.create({ data: { ...data, organizationId: req.user!.organizationId }, include: { items: true } });
    res.status(201).json(group);
  } catch (err) {
    next(err);
  }
}

export async function updateModifierGroup(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const data = modGroupSchema.partial().parse(req.body);
    const group = await prisma.modifierGroup.update({ where: { id }, data, include: { items: true } });
    res.json(group);
  } catch (err) {
    next(err);
  }
}

export async function deleteModifierGroup(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    await prisma.modifierGroup.delete({ where: { id } });
    res.json({ message: 'Modifier group deleted' });
  } catch (err) {
    next(err);
  }
}

// ── Modifiers ─────────────────────────────────────────────────────────────────

export async function createModifier(req: Request, res: Response, next: NextFunction) {
  try {
    const groupId = parseInt(req.params.groupId);
    const data = modifierSchema.parse(req.body);
    const modifier = await prisma.modifier.create({ data: { ...data, groupId } });
    res.status(201).json(modifier);
  } catch (err) {
    next(err);
  }
}

export async function updateModifier(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const data = modifierSchema.partial().parse(req.body);
    const modifier = await prisma.modifier.update({ where: { id }, data });
    res.json(modifier);
  } catch (err) {
    next(err);
  }
}

export async function deleteModifier(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    await prisma.modifier.update({ where: { id }, data: { isActive: false } });
    res.json({ message: 'Modifier removed' });
  } catch (err) {
    next(err);
  }
}
