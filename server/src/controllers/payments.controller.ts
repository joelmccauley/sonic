import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PaymentMethod, OrderStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { auditService } from '../services/audit.service';
import { printService } from '../services/print.service';
import { emitOrderUpdate } from '../services/websocket.service';

const paymentSchema = z.object({
  method: z.nativeEnum(PaymentMethod),
  amount: z.number().positive(),
  tip: z.number().min(0).default(0),
  cashTendered: z.number().optional(),
  reference: z.string().optional(),
  last4: z.string().length(4).optional(),
});

export async function processPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const orderId = parseInt(req.params.orderId);
    const data = paymentSchema.parse(req.body);

    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { payments: true, items: true, discounts: true } });
    if (!order) throw new AppError(404, 'Order not found');
    if (order.status === OrderStatus.PAID) throw new AppError(409, 'Order already paid');
    if (order.status === OrderStatus.VOIDED) throw new AppError(409, 'Order is voided');

    const changeGiven =
      data.method === PaymentMethod.CASH && data.cashTendered
        ? Math.max(0, data.cashTendered - data.amount)
        : undefined;

    const payment = await prisma.payment.create({
      data: {
        organizationId: req.user!.organizationId,
        orderId,
        method: data.method,
        amount: data.amount,
        tip: data.tip,
        cashTendered: data.cashTendered,
        changeGiven,
        reference: data.reference,
        last4: data.last4,
        processedById: req.user!.userId,
      },
    });

    // Update tip amount on order and check if fully paid
    const totalPaid = [...order.payments, payment].reduce((s, p) => s + Number(p.amount), 0);
    const isPaid = totalPaid >= Number(order.total);

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        tipAmount: { increment: data.tip },
        total: { increment: data.tip },
        ...(isPaid ? { status: OrderStatus.PAID, closedAt: new Date() } : {}),
      },
      include: {
        table: true,
        server: { select: { firstName: true, lastName: true } },
        items: { include: { menuItem: true, modifiers: { include: { modifier: true } } } },
        payments: true,
        discounts: { include: { discount: true } },
        customer: true,
      },
    });

    // Free the table if order is paid
    if (isPaid && updatedOrder.tableId) {
      const otherOpen = await prisma.order.count({
        where: { tableId: updatedOrder.tableId, status: { in: ['OPEN', 'SENT_TO_KITCHEN', 'IN_PROGRESS', 'READY'] } },
      });
      if (!otherOpen) {
        await prisma.table.update({ where: { id: updatedOrder.tableId }, data: { status: 'AVAILABLE' } });
      }
    }

    await auditService.log(req.user!.userId, 'PROCESS_PAYMENT', 'Payment', String(payment.id), { method: data.method, amount: data.amount });
    emitOrderUpdate(updatedOrder);

    res.status(201).json({ payment, order: updatedOrder, change: changeGiven });
  } catch (err) {
    next(err);
  }
}

export async function processRefund(req: Request, res: Response, next: NextFunction) {
  try {
    const orderId = parseInt(req.params.orderId);
    const paymentId = parseInt(req.params.paymentId);
    const { amount, reason } = z.object({ amount: z.number().positive(), reason: z.string().optional() }).parse(req.body);

    const payment = await prisma.payment.findFirst({ where: { id: paymentId, orderId } });
    if (!payment) throw new AppError(404, 'Payment not found');
    if (payment.isRefunded) throw new AppError(409, 'Payment already refunded');
    if (amount > Number(payment.amount)) throw new AppError(400, 'Refund exceeds payment amount');

    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: { isRefunded: true, refundedAt: new Date(), refundAmount: amount },
    });

    await prisma.order.update({ where: { id: orderId }, data: { status: OrderStatus.REFUNDED } });
    await auditService.log(req.user!.userId, 'PROCESS_REFUND', 'Payment', String(paymentId), { amount, reason });

    res.json(updatedPayment);
  } catch (err) {
    next(err);
  }
}

export async function getOrderPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const orderId = parseInt(req.params.orderId);
    const payments = await prisma.payment.findMany({
      where: { orderId },
      include: { processedBy: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json(payments);
  } catch (err) {
    next(err);
  }
}

export async function printReceipt(req: Request, res: Response, next: NextFunction) {
  try {
    const orderId = parseInt(req.params.orderId);
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        table: true,
        server: { select: { firstName: true, lastName: true } },
        items: {
          where: { status: { not: 'VOIDED' } },
          include: { menuItem: true, modifiers: { include: { modifier: true } } },
        },
        payments: true,
        discounts: { include: { discount: true } },
      },
    });
    if (!order) throw new AppError(404, 'Order not found');

    const settings = await prisma.setting.findMany();
    const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));

    await printService.printReceipt(order as any, settingsMap);
    res.json({ message: 'Receipt sent to printer' });
  } catch (err) {
    next(err);
  }
}
