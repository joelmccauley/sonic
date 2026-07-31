import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { TableShape, TableStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { emitTableUpdate } from '../services/websocket.service';

const tableSchema = z.object({
  name: z.string().min(1),
  capacity: z.number().int().positive(),
  section: z.string().optional(),
  posX: z.number().default(0),
  posY: z.number().default(0),
  width: z.number().default(120),
  height: z.number().default(80),
  shape: z.nativeEnum(TableShape).default(TableShape.RECTANGLE),
});

export async function getAllTables(req: Request, res: Response, next: NextFunction) {
  try {
    const { section, status } = req.query;
    const tables = await prisma.table.findMany({
      where: {
        isActive: true,
        ...(section ? { section: String(section) } : {}),
        ...(status ? { status: status as TableStatus } : {}),
      },
      include: {
        orders: {
          where: { status: { in: ['OPEN', 'SENT_TO_KITCHEN', 'IN_PROGRESS', 'READY'] } },
          select: { id: true, status: true, guestCount: true, createdAt: true, orderNumber: true, total: true },
          take: 1,
        },
      },
      orderBy: [{ section: 'asc' }, { name: 'asc' }],
    });
    res.json(tables);
  } catch (err) {
    next(err);
  }
}

export async function getSections(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await prisma.table.findMany({
      where: { isActive: true },
      select: { section: true },
      distinct: ['section'],
    });
    res.json(result.map((r) => r.section).filter(Boolean));
  } catch (err) {
    next(err);
  }
}

export async function getTable(req: Request, res: Response, next: NextFunction) {
  try {
    const table = await prisma.table.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        orders: {
          where: { status: { in: ['OPEN', 'SENT_TO_KITCHEN', 'IN_PROGRESS', 'READY'] } },
        },
      },
    });
    if (!table) throw new AppError(404, 'Table not found');
    res.json(table);
  } catch (err) {
    next(err);
  }
}

export async function createTable(req: Request, res: Response, next: NextFunction) {
  try {
    const data = tableSchema.parse(req.body);
    const table = await prisma.table.create({ data: { ...data, organizationId: req.user!.organizationId } });
    emitTableUpdate(table);
    res.status(201).json(table);
  } catch (err) {
    next(err);
  }
}

export async function updateTable(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const data = tableSchema.partial().parse(req.body);
    const table = await prisma.table.update({ where: { id }, data });
    emitTableUpdate(table);
    res.json(table);
  } catch (err) {
    next(err);
  }
}

export async function updateTableStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const { status } = z.object({ status: z.nativeEnum(TableStatus) }).parse(req.body);
    const table = await prisma.table.update({ where: { id }, data: { status } });
    emitTableUpdate(table);
    res.json(table);
  } catch (err) {
    next(err);
  }
}

export async function deleteTable(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    // Soft delete
    await prisma.table.update({ where: { id }, data: { isActive: false } });
    res.json({ message: 'Table removed' });
  } catch (err) {
    next(err);
  }
}
