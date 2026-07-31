import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

export async function clockIn(req: Request, res: Response, next: NextFunction) {
  try {
    const { cashDrawer } = z.object({ cashDrawer: z.number().optional() }).parse(req.body);

    // Check already clocked in
    const active = await prisma.shift.findFirst({
      where: { userId: req.user!.userId, clockOut: null },
    });
    if (active) throw new AppError(409, 'Already clocked in');

    const shift = await prisma.shift.create({
      data: { userId: req.user!.userId, cashDrawer, organizationId: req.user!.organizationId },
      include: { user: { select: { firstName: true, lastName: true, role: true } } },
    });
    res.status(201).json(shift);
  } catch (err) {
    next(err);
  }
}

export async function clockOut(req: Request, res: Response, next: NextFunction) {
  try {
    const { closingCash, notes } = z.object({ closingCash: z.number().optional(), notes: z.string().optional() }).parse(req.body);

    const active = await prisma.shift.findFirst({ where: { userId: req.user!.userId, clockOut: null } });
    if (!active) throw new AppError(404, 'No active shift found');

    const shift = await prisma.shift.update({
      where: { id: active.id },
      data: { clockOut: new Date(), closingCash, notes },
    });
    res.json(shift);
  } catch (err) {
    next(err);
  }
}

export async function getActiveShift(req: Request, res: Response, next: NextFunction) {
  try {
    const shift = await prisma.shift.findFirst({
      where: { userId: req.user!.userId, clockOut: null },
      include: { user: { select: { firstName: true, lastName: true, role: true } } },
    });
    res.json(shift);
  } catch (err) {
    next(err);
  }
}

export async function getShifts(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, startDate, endDate } = req.query;
    const where: any = {};
    if (userId) where.userId = parseInt(String(userId));
    if (startDate || endDate) {
      where.clockIn = {};
      if (startDate) where.clockIn.gte = new Date(String(startDate));
      if (endDate) {
        const end = new Date(String(endDate));
        end.setDate(end.getDate() + 1);
        where.clockIn.lt = end;
      }
    }

    const shifts = await prisma.shift.findMany({
      where,
      include: { user: { select: { firstName: true, lastName: true, role: true } } },
      orderBy: { clockIn: 'desc' },
      take: 200,
    });
    res.json({ shifts });
  } catch (err) {
    next(err);
  }
}

export async function getShift(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const shift = await prisma.shift.findUnique({
      where: { id },
      include: { user: { select: { firstName: true, lastName: true, role: true } } },
    });
    if (!shift) throw new AppError(404, 'Shift not found');
    res.json(shift);
  } catch (err) {
    next(err);
  }
}

// Manager: force clock-out any active shift / edit notes
export async function updateShift(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const { closingCash, notes, clockOut } = z.object({
      closingCash: z.number().optional(),
      notes: z.string().optional(),
      clockOut: z.string().optional(),
    }).parse(req.body);

    const shift = await prisma.shift.update({
      where: { id },
      data: {
        ...(closingCash !== undefined && { closingCash }),
        ...(notes !== undefined && { notes }),
        ...(clockOut !== undefined && { clockOut: new Date(clockOut) }),
      },
      include: { user: { select: { firstName: true, lastName: true, role: true } } },
    });
    res.json(shift);
  } catch (err) {
    next(err);
  }
}
