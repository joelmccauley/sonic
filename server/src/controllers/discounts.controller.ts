import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { DiscountType } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

const discountSchema = z.object({
  name: z.string().min(1),
  type: z.nativeEnum(DiscountType),
  value: z.number().positive(),
  code: z.string().optional(),
  requiresPin: z.boolean().default(false),
  minOrder: z.number().optional(),
  description: z.string().optional(),
});

export async function getDiscounts(_req: Request, res: Response, next: NextFunction) {
  try {
    const discounts = await prisma.discount.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    res.json(discounts);
  } catch (err) {
    next(err);
  }
}

export async function createDiscount(req: Request, res: Response, next: NextFunction) {
  try {
    const data = discountSchema.parse(req.body);
    const discount = await prisma.discount.create({ data: { ...data, organizationId: req.user!.organizationId } });
    res.status(201).json(discount);
  } catch (err) {
    next(err);
  }
}

export async function updateDiscount(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const data = discountSchema.partial().parse(req.body);
    const discount = await prisma.discount.update({ where: { id }, data });
    res.json(discount);
  } catch (err) {
    next(err);
  }
}

export async function toggleDiscount(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const current = await prisma.discount.findUnique({ where: { id }, select: { isActive: true } });
    if (!current) throw new AppError(404, 'Discount not found');
    const discount = await prisma.discount.update({ where: { id }, data: { isActive: !current.isActive } });
    res.json(discount);
  } catch (err) {
    next(err);
  }
}

export async function deleteDiscount(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    await prisma.discount.update({ where: { id }, data: { isActive: false } });
    res.json({ message: 'Discount disabled' });
  } catch (err) {
    next(err);
  }
}
