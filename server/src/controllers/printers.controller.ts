import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrinterType } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { printService } from '../services/print.service';

const printerSchema = z.object({
  name: z.string().min(1),
  type: z.nativeEnum(PrinterType),
  ipAddress: z.string().ip().optional(),
  port: z.number().int().default(9100),
  interface: z.string().default('tcp'),
});

export async function getPrinters(_req: Request, res: Response, next: NextFunction) {
  try {
    const printers = await prisma.printer.findMany({ where: { isActive: true }, orderBy: { type: 'asc' } });
    res.json(printers);
  } catch (err) {
    next(err);
  }
}

export async function createPrinter(req: Request, res: Response, next: NextFunction) {
  try {
    const data = printerSchema.parse(req.body);
    const printer = await prisma.printer.create({ data: { ...data, organizationId: req.user!.organizationId } });
    res.status(201).json(printer);
  } catch (err) {
    next(err);
  }
}

export async function updatePrinter(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const data = printerSchema.partial().parse(req.body);
    const printer = await prisma.printer.update({ where: { id }, data });
    res.json(printer);
  } catch (err) {
    next(err);
  }
}

export async function deletePrinter(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    await prisma.printer.update({ where: { id }, data: { isActive: false } });
    res.json({ message: 'Printer removed' });
  } catch (err) {
    next(err);
  }
}

export async function testPrinter(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const printer = await prisma.printer.findUnique({ where: { id } });
    if (!printer) throw new AppError(404, 'Printer not found');
    if (!printer.ipAddress) throw new AppError(400, 'Printer has no IP address configured');

    await printService.testPrinter({ ...printer, ipAddress: printer.ipAddress });
    res.json({ message: 'Test print sent successfully' });
  } catch (err) {
    next(err);
  }
}

export async function setDefaultPrinter(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const printer = await prisma.printer.findUnique({ where: { id } });
    if (!printer) throw new AppError(404, 'Printer not found');

    // Unset other defaults of same type
    await prisma.printer.updateMany({ where: { type: printer.type, isDefault: true }, data: { isDefault: false } });
    const updated = await prisma.printer.update({ where: { id }, data: { isDefault: true } });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}
