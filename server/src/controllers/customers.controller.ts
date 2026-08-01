import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';

export async function getCustomers(req: Request, res: Response, next: NextFunction) {
  try {
    const { limit = '50', offset = '0' } = req.query;
    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        take: parseInt(String(limit)),
        skip: parseInt(String(offset)),
      }),
      prisma.customer.count(),
    ]);
    res.json({ customers, total });
  } catch (err) {
    next(err);
  }
}

export async function searchCustomers(req: Request, res: Response, next: NextFunction) {
  try {
    const { q } = req.query;
    if (!q) { res.json([]); return; }

    const customers = await prisma.customer.findMany({
      where: {
        OR: [
          { firstName: { contains: String(q), mode: 'insensitive' } },
          { lastName: { contains: String(q), mode: 'insensitive' } },
          { phone: { contains: String(q) } },
          { email: { contains: String(q), mode: 'insensitive' } },
        ],
      },
      take: 20,
    });
    res.json(customers);
  } catch (err) {
    next(err);
  }
}

export async function getCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) { res.status(404).json({ error: 'Customer not found' }); return; }
    res.json(customer);
  } catch (err) {
    next(err);
  }
}

export async function createCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = z.object({
      firstName: z.string().min(1),
      lastName: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      emailOptIn: z.boolean().optional(),
      textOptIn: z.boolean().optional(),
      notes: z.string().optional(),
    });
    const data = schema.parse(req.body);
    const customer = await prisma.customer.create({ data: { ...data, organizationId: req.user!.organizationId } });
    res.status(201).json(customer);
  } catch (err) {
    next(err);
  }
}

export async function updateCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const schema = z.object({
      firstName: z.string().min(1).optional(),
      lastName: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      emailOptIn: z.boolean().optional(),
      textOptIn: z.boolean().optional(),
      notes: z.string().optional(),
    });
    const data = schema.parse(req.body);
    const customer = await prisma.customer.update({ where: { id }, data });
    res.json(customer);
  } catch (err) {
    next(err);
  }
}

export async function getCustomerOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const orders = await prisma.order.findMany({
      where: { customerId: id },
      include: { items: { include: { menuItem: { select: { name: true } } } }, payments: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json(orders);
  } catch (err) {
    next(err);
  }
}

export async function addLoyaltyPoints(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const { points } = z.object({ points: z.number().int() }).parse(req.body);
    const customer = await prisma.customer.update({ where: { id }, data: { points: { increment: points } } });
    res.json(customer);
  } catch (err) {
    next(err);
  }
}
