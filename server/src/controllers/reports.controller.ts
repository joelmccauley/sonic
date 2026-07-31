import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseRange(req: Request) {
  const start = req.query.startDate ? new Date(String(req.query.startDate)) : new Date();
  const end = req.query.endDate ? new Date(String(req.query.endDate)) : new Date();
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  const dayCount = Math.max(1, Math.ceil((end.getTime() - start.getTime() + 1) / MS_PER_DAY));
  return { start, end, dayCount };
}

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function weekdayLabel(date: Date) {
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

function fullName(user?: { firstName?: string | null; lastName?: string | null } | null) {
  if (!user) return 'Unassigned';
  const first = user.firstName ?? '';
  const last = user.lastName ?? '';
  return `${first} ${last}`.trim() || 'Unassigned';
}

function overlapHours(startA: Date, endA: Date, startB: Date, endB: Date) {
  const start = Math.max(startA.getTime(), startB.getTime());
  const end = Math.min(endA.getTime(), endB.getTime());
  return end > start ? (end - start) / (1000 * 60 * 60) : 0;
}

function avg(total: number, count: number) {
  return count ? total / count : 0;
}

function sumBy<T>(items: T[], fn: (item: T) => number) {
  return items.reduce((sum, item) => sum + fn(item), 0);
}

function servicePeriodFor(date: Date) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) return 'Breakfast';
  if (hour >= 11 && hour < 15) return 'Lunch';
  if (hour >= 15 && hour < 18) return 'Happy Hour';
  if (hour >= 18 && hour < 22) return 'Dinner';
  return 'Late Night';
}

export async function salesReport(req: Request, res: Response, next: NextFunction) {
  try {
    const { start, end } = parseRange(req);

    const orders = await prisma.order.findMany({
      where: { status: 'PAID', createdAt: { gte: start, lte: end } },
      include: { payments: true },
    });

    const summary = {
      totalOrders: orders.length,
      totalSales: orders.reduce((s, o) => s + Number(o.total), 0),
      totalTax: orders.reduce((s, o) => s + Number(o.taxAmount), 0),
      totalTips: orders.reduce((s, o) => s + Number(o.tipAmount), 0),
      totalDiscounts: orders.reduce((s, o) => s + Number(o.discountAmount), 0),
      avgOrderValue: orders.length ? orders.reduce((s, o) => s + Number(o.total), 0) / orders.length : 0,
      byPaymentMethod: {} as Record<string, number>,
    };

    for (const order of orders) {
      for (const payment of order.payments) {
        summary.byPaymentMethod[payment.method] = (summary.byPaymentMethod[payment.method] ?? 0) + Number(payment.amount);
      }
    }

    res.json({ summary, start, end });
  } catch (err) {
    next(err);
  }
}

export async function hourlySales(req: Request, res: Response, next: NextFunction) {
  try {
    const date = req.query.date ? new Date(String(req.query.date)) : new Date();
    const start = startOfDay(date);
    const end = endOfDay(date);

    const orders = await prisma.order.findMany({
      where: { status: 'PAID', createdAt: { gte: start, lte: end } },
      select: { total: true, createdAt: true },
    });

    const hourly: Record<number, { count: number; total: number }> = {};
    for (let h = 0; h < 24; h++) hourly[h] = { count: 0, total: 0 };

    for (const o of orders) {
      const h = new Date(o.createdAt).getHours();
      hourly[h].count++;
      hourly[h].total += Number(o.total);
    }

    res.json(Object.entries(hourly).map(([hour, data]) => ({ hour: parseInt(hour, 10), ...data })));
  } catch (err) {
    next(err);
  }
}

export async function itemsReport(req: Request, res: Response, next: NextFunction) {
  try {
    const { start, end } = parseRange(req);

    const items = await prisma.orderItem.groupBy({
      by: ['menuItemId'],
      where: {
        status: { not: 'VOIDED' },
        order: { status: 'PAID', createdAt: { gte: start, lte: end } },
      },
      _sum: { quantity: true },
      _count: { id: true },
      orderBy: { _sum: { quantity: 'desc' } },
    });

    const itemIds = items.map((i) => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, name: true, price: true, category: { select: { name: true } } },
    });

    const menuItemMap = Object.fromEntries(menuItems.map((m) => [m.id, m]));
    const result = items.map((i) => ({
      ...menuItemMap[i.menuItemId],
      totalQuantity: i._sum.quantity,
      totalOrders: i._count.id,
      totalRevenue: (i._sum.quantity ?? 0) * Number(menuItemMap[i.menuItemId]?.price ?? 0),
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function employeesReport(req: Request, res: Response, next: NextFunction) {
  try {
    const { start, end } = parseRange(req);

    const orders = await prisma.order.groupBy({
      by: ['serverId'],
      where: { status: 'PAID', createdAt: { gte: start, lte: end } },
      _sum: { total: true, tipAmount: true },
      _count: { id: true },
    });

    const serverIds = orders.map((o) => o.serverId).filter(Boolean) as number[];
    const servers = await prisma.user.findMany({
      where: { id: { in: serverIds } },
      select: { id: true, firstName: true, lastName: true, role: true },
    });
    const serverMap = Object.fromEntries(servers.map((s) => [s.id, s]));

    res.json(
      orders.map((o) => ({
        server: o.serverId ? serverMap[o.serverId] : null,
        totalOrders: o._count.id,
        totalSales: o._sum.total,
        totalTips: o._sum.tipAmount,
      }))
    );
  } catch (err) {
    next(err);
  }
}

export async function paymentsReport(req: Request, res: Response, next: NextFunction) {
  try {
    const { start, end } = parseRange(req);

    const payments = await prisma.payment.groupBy({
      by: ['method'],
      where: { createdAt: { gte: start, lte: end }, isRefunded: false },
      _sum: { amount: true, tip: true },
      _count: { id: true },
    });

    res.json(payments);
  } catch (err) {
    next(err);
  }
}

export async function discountsReport(req: Request, res: Response, next: NextFunction) {
  try {
    const { start, end } = parseRange(req);

    const discounts = await prisma.orderDiscount.groupBy({
      by: ['discountId'],
      where: { order: { createdAt: { gte: start, lte: end } } },
      _sum: { amount: true },
      _count: { id: true },
    });

    const discountIds = discounts.map((d) => d.discountId);
    const discountInfo = await prisma.discount.findMany({ where: { id: { in: discountIds } } });
    const discountMap = Object.fromEntries(discountInfo.map((d) => [d.id, d]));

    res.json(discounts.map((d) => ({ discount: discountMap[d.discountId], totalAmount: d._sum.amount, count: d._count.id })));
  } catch (err) {
    next(err);
  }
}

export async function getDailySummary(_req: Request, res: Response, next: NextFunction) {
  try {
    const today = startOfDay(new Date());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [paidOrders, openOrders, voidedOrders, payments] = await Promise.all([
      prisma.order.aggregate({ where: { status: 'PAID', createdAt: { gte: today, lt: tomorrow } }, _sum: { total: true, taxAmount: true, tipAmount: true, discountAmount: true }, _count: { id: true } }),
      prisma.order.count({ where: { status: { in: ['OPEN', 'SENT_TO_KITCHEN', 'IN_PROGRESS', 'READY'] } } }),
      prisma.order.count({ where: { status: 'VOIDED', createdAt: { gte: today, lt: tomorrow } } }),
      prisma.payment.groupBy({ by: ['method'], where: { createdAt: { gte: today, lt: tomorrow } }, _sum: { amount: true }, _count: { id: true } }),
    ]);

    res.json({
      totalSales: paidOrders._sum.total ?? 0,
      totalTax: paidOrders._sum.taxAmount ?? 0,
      totalTips: paidOrders._sum.tipAmount ?? 0,
      totalDiscounts: paidOrders._sum.discountAmount ?? 0,
      paidOrders: paidOrders._count.id,
      openOrders,
      voidedOrders,
      paymentBreakdown: payments,
    });
  } catch (err) {
    next(err);
  }
}

export async function analyticsDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const { start, end, dayCount } = parseRange(req);
    const relevantActions = ['VOID_ITEM', 'VOID_ORDER', 'PROCESS_REFUND', 'APPLY_DISCOUNT'];

    const [orders, orderItems, shifts, inventory, auditLogs] = await Promise.all([
      prisma.order.findMany({
        where: { createdAt: { gte: start, lte: end } },
        include: {
          server: { select: { id: true, firstName: true, lastName: true, role: true } },
          table: { select: { id: true, name: true } },
          customer: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
          discounts: { include: { discount: true } },
          payments: { include: { processedBy: { select: { id: true, firstName: true, lastName: true, role: true } } } },
          items: { select: { id: true, sentAt: true, voidedAt: true, voidReason: true, unitPrice: true, quantity: true, menuItemId: true } },
        },
      }),
      prisma.orderItem.findMany({
        where: { order: { createdAt: { gte: start, lte: end } } },
        include: {
          order: {
            select: {
              id: true,
              status: true,
              type: true,
              createdAt: true,
              closedAt: true,
              serverId: true,
              guestCount: true,
              total: true,
              table: { select: { id: true, name: true } },
              server: { select: { id: true, firstName: true, lastName: true, role: true } },
            },
          },
          menuItem: {
            select: {
              id: true,
              name: true,
              sku: true,
              price: true,
              cost: true,
              category: { select: { name: true } },
            },
          },
          modifiers: { include: { modifier: { select: { id: true, name: true } } } },
        },
      }),
      prisma.shift.findMany({
        where: {
          clockIn: { lte: end },
          OR: [{ clockOut: null }, { clockOut: { gte: start } }],
        },
        include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } },
      }),
      prisma.inventoryItem.findMany({
        include: {
          menuItem: {
            select: {
              id: true,
              name: true,
              sku: true,
              cost: true,
              category: { select: { name: true } },
            },
          },
        },
      }),
      prisma.auditLog.findMany({
        where: { createdAt: { gte: start, lte: end }, action: { in: relevantActions } },
        include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } },
      }),
    ]);

    const paidOrders = orders.filter((order) => order.status === 'PAID');
    const nonVoidedItems = orderItems.filter((item) => item.status !== 'VOIDED' && item.order.status === 'PAID');
    const totalSales = sumBy(paidOrders, (order) => Number(order.total));
    const totalGuests = sumBy(paidOrders, (order) => order.guestCount ?? 1);
    const itemQtyTotal = sumBy(nonVoidedItems, (item) => item.quantity);

    const laborHoursByUser = new Map<number, number>();
    for (const shift of shifts) {
      const hours = overlapHours(shift.clockIn, shift.clockOut ?? end, start, end);
      laborHoursByUser.set(shift.userId, (laborHoursByUser.get(shift.userId) ?? 0) + hours);
    }

    const employeeMap = new Map<number, any>();
    const ensureEmployee = (userId: number, user: { id: number; firstName: string; lastName: string; role: string } | null | undefined) => {
      if (!employeeMap.has(userId)) {
        employeeMap.set(userId, {
          employeeId: userId,
          employee: fullName(user),
          role: user?.role ?? 'STAFF',
          totalSales: 0,
          totalOrders: 0,
          avgCheck: 0,
          totalTips: 0,
          tipPercent: 0,
          totalDiscounts: 0,
          totalGuests: 0,
          laborHours: 0,
          salesPerLaborHour: 0,
          refundCount: 0,
          refundAmount: 0,
          voidItems: 0,
          voidOrders: 0,
        });
      }
      return employeeMap.get(userId);
    };

    for (const order of paidOrders) {
      if (!order.serverId) continue;
      const entry = ensureEmployee(order.serverId, order.server);
      entry.totalSales += Number(order.total);
      entry.totalOrders += 1;
      entry.totalTips += Number(order.tipAmount);
      entry.totalDiscounts += Number(order.discountAmount);
      entry.totalGuests += order.guestCount ?? 1;
    }

    for (const [userId, hours] of laborHoursByUser.entries()) {
      const existingShift = shifts.find((shift) => shift.userId === userId);
      const entry = ensureEmployee(userId, existingShift?.user);
      entry.laborHours = hours;
    }

    for (const order of orders) {
      for (const payment of order.payments) {
        if (payment.isRefunded && payment.processedById) {
          const entry = ensureEmployee(payment.processedById, payment.processedBy);
          entry.refundCount += 1;
          entry.refundAmount += Number(payment.refundAmount ?? 0);
        }
      }
    }

    for (const log of auditLogs) {
      if (!log.userId) continue;
      const entry = ensureEmployee(log.userId, log.user);
      if (log.action === 'VOID_ITEM') entry.voidItems += 1;
      if (log.action === 'VOID_ORDER') entry.voidOrders += 1;
    }

    const employeePerformance = Array.from(employeeMap.values())
      .map((entry) => ({
        ...entry,
        avgCheck: avg(entry.totalSales, entry.totalOrders),
        tipPercent: entry.totalSales ? (entry.totalTips / entry.totalSales) * 100 : 0,
        salesPerLaborHour: entry.laborHours ? entry.totalSales / entry.laborHours : 0,
      }))
      .sort((a, b) => b.totalSales - a.totalSales);

    const serverTips = employeePerformance
      .map((entry) => ({
        employee: entry.employee,
        role: entry.role,
        totalTips: entry.totalTips,
        tipPercent: entry.tipPercent,
        avgTipPerOrder: avg(entry.totalTips, entry.totalOrders),
        totalOrders: entry.totalOrders,
      }))
      .sort((a, b) => b.totalTips - a.totalTips);

    const shiftPerformance = shifts
      .map((shift) => {
        const shiftStart = new Date(Math.max(shift.clockIn.getTime(), start.getTime()));
        const shiftEnd = new Date(Math.min((shift.clockOut ?? end).getTime(), end.getTime()));
        const shiftOrders = paidOrders.filter(
          (order) => order.serverId === shift.userId && order.createdAt >= shiftStart && order.createdAt <= shiftEnd
        );
        const sales = sumBy(shiftOrders, (order) => Number(order.total));
        const tips = sumBy(shiftOrders, (order) => Number(order.tipAmount));
        const guests = sumBy(shiftOrders, (order) => order.guestCount ?? 1);
        const ticketMinutes = shiftOrders
          .filter((order) => order.closedAt)
          .map((order) => (new Date(order.closedAt!).getTime() - new Date(order.createdAt).getTime()) / 60000);
        const hours = overlapHours(shift.clockIn, shift.clockOut ?? end, start, end);
        const voidCount = auditLogs.filter(
          (log) => log.userId === shift.userId && log.createdAt >= shiftStart && log.createdAt <= shiftEnd && log.action.startsWith('VOID_')
        ).length;
        return {
          shiftId: shift.id,
          employee: fullName(shift.user),
          role: shift.user.role,
          date: dayKey(shiftStart),
          clockIn: shift.clockIn,
          clockOut: shift.clockOut,
          laborHours: hours,
          totalSales: sales,
          totalOrders: shiftOrders.length,
          avgCheck: avg(sales, shiftOrders.length),
          totalTips: tips,
          totalGuests: guests,
          avgTicketMinutes: avg(sumBy(ticketMinutes, (value) => value), ticketMinutes.length),
          voidCount,
          salesPerHour: hours ? sales / hours : 0,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.totalSales - a.totalSales);

    const laborByDay = new Map<string, any>();
    for (let time = start.getTime(); time <= end.getTime(); time += MS_PER_DAY) {
      const day = new Date(time);
      laborByDay.set(dayKey(day), {
        date: dayKey(day),
        weekday: weekdayLabel(day),
        laborHours: 0,
        totalSales: 0,
        totalOrders: 0,
        totalTips: 0,
      });
    }

    for (const order of paidOrders) {
      const key = dayKey(order.createdAt);
      const row = laborByDay.get(key);
      if (!row) continue;
      row.totalSales += Number(order.total);
      row.totalOrders += 1;
      row.totalTips += Number(order.tipAmount);
    }

    for (const shift of shifts) {
      let cursor = startOfDay(new Date(Math.max(shift.clockIn.getTime(), start.getTime())));
      const shiftEnd = new Date(Math.min((shift.clockOut ?? end).getTime(), end.getTime()));
      while (cursor <= shiftEnd) {
        const key = dayKey(cursor);
        const row = laborByDay.get(key);
        if (row) {
          row.laborHours += overlapHours(shift.clockIn, shift.clockOut ?? end, cursor, endOfDay(cursor));
        }
        cursor = new Date(cursor.getTime() + MS_PER_DAY);
      }
    }

    const laborVsSales = Array.from(laborByDay.values()).map((row) => ({
      ...row,
      salesPerLaborHour: row.laborHours ? row.totalSales / row.laborHours : 0,
      avgCheck: avg(row.totalSales, row.totalOrders),
    }));

    const byWeekday = new Map<string, any>();
    for (const order of paidOrders) {
      const label = weekdayLabel(order.createdAt);
      if (!byWeekday.has(label)) {
        byWeekday.set(label, { weekday: label, totalSales: 0, totalOrders: 0, totalGuests: 0, avgCheck: 0, revenuePerGuest: 0 });
      }
      const row = byWeekday.get(label);
      row.totalSales += Number(order.total);
      row.totalOrders += 1;
      row.totalGuests += order.guestCount ?? 1;
    }
    const weekdayOrder = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const salesByDayOfWeek = weekdayOrder
      .map((weekday) => byWeekday.get(weekday) ?? { weekday, totalSales: 0, totalOrders: 0, totalGuests: 0 })
      .map((row) => ({ ...row, avgCheck: avg(row.totalSales, row.totalOrders), revenuePerGuest: avg(row.totalSales, row.totalGuests) }));

    const byServicePeriod = new Map<string, any>();
    for (const period of ['Breakfast', 'Lunch', 'Happy Hour', 'Dinner', 'Late Night']) {
      byServicePeriod.set(period, { period, totalSales: 0, totalOrders: 0, totalGuests: 0, avgCheck: 0 });
    }
    for (const order of paidOrders) {
      const period = servicePeriodFor(order.createdAt);
      const row = byServicePeriod.get(period);
      row.totalSales += Number(order.total);
      row.totalOrders += 1;
      row.totalGuests += order.guestCount ?? 1;
    }
    const salesByServicePeriod = Array.from(byServicePeriod.values()).map((row) => ({ ...row, avgCheck: avg(row.totalSales, row.totalOrders) }));

    const coversMap = new Map<string, any>();
    for (const order of paidOrders) {
      const key = dayKey(order.createdAt);
      if (!coversMap.has(key)) {
        coversMap.set(key, { date: key, weekday: weekdayLabel(order.createdAt), totalGuests: 0, totalOrders: 0, totalSales: 0 });
      }
      const row = coversMap.get(key);
      row.totalGuests += order.guestCount ?? 1;
      row.totalOrders += 1;
      row.totalSales += Number(order.total);
    }
    const coversAndGuests = Array.from(coversMap.values())
      .map((row) => ({
        ...row,
        avgPartySize: avg(row.totalGuests, row.totalOrders),
        revenuePerGuest: avg(row.totalSales, row.totalGuests),
        avgCheck: avg(row.totalSales, row.totalOrders),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const tableMap = new Map<string, any>();
    for (const order of paidOrders) {
      if (order.type !== 'DINE_IN' || !order.table || !order.closedAt) continue;
      const duration = (new Date(order.closedAt).getTime() - new Date(order.createdAt).getTime()) / 60000;
      const key = `${order.table.id}`;
      if (!tableMap.has(key)) {
        tableMap.set(key, { table: order.table.name, turns: 0, totalMinutes: 0, totalSales: 0, guests: 0 });
      }
      const row = tableMap.get(key);
      row.turns += 1;
      row.totalMinutes += duration;
      row.totalSales += Number(order.total);
      row.guests += order.guestCount ?? 1;
    }
    const tableTurnTimes = Array.from(tableMap.values())
      .map((row) => ({
        table: row.table,
        turns: row.turns,
        avgTurnMinutes: avg(row.totalMinutes, row.turns),
        revenuePerTurn: avg(row.totalSales, row.turns),
        guestsPerTurn: avg(row.guests, row.turns),
      }))
      .sort((a, b) => b.turns - a.turns);

    const fulfillmentMap = new Map<string, any>();
    for (const type of ['DINE_IN', 'TO_GO', 'DELIVERY', 'BAR']) {
      fulfillmentMap.set(type, { type, totalOrders: 0, totalOpenToSend: 0, sentCount: 0, totalOpenToClose: 0, closeCount: 0, totalSendToClose: 0, sendCloseCount: 0 });
    }
    for (const order of orders) {
      const row = fulfillmentMap.get(order.type);
      row.totalOrders += 1;
      const sentTimes = order.items.map((item) => item.sentAt).filter(Boolean) as Date[];
      if (sentTimes.length > 0) {
        const firstSent = sentTimes.reduce((min, time) => (time < min ? time : min), sentTimes[0]);
        row.totalOpenToSend += (firstSent.getTime() - new Date(order.createdAt).getTime()) / 60000;
        row.sentCount += 1;
        if (order.closedAt) {
          row.totalSendToClose += (new Date(order.closedAt).getTime() - firstSent.getTime()) / 60000;
          row.sendCloseCount += 1;
        }
      }
      if (order.closedAt) {
        row.totalOpenToClose += (new Date(order.closedAt).getTime() - new Date(order.createdAt).getTime()) / 60000;
        row.closeCount += 1;
      }
    }
    const orderFulfillment = Array.from(fulfillmentMap.values()).map((row) => ({
      type: row.type,
      totalOrders: row.totalOrders,
      avgOpenToSendMinutes: avg(row.totalOpenToSend, row.sentCount),
      avgOpenToCloseMinutes: avg(row.totalOpenToClose, row.closeCount),
      avgSendToCloseMinutes: avg(row.totalSendToClose, row.sendCloseCount),
    }));

    const kitchenMap = new Map<string, any>();
    for (const item of nonVoidedItems) {
      if (!item.sentAt) continue;
      const key = `${item.menuItem.id}`;
      if (!kitchenMap.has(key)) {
        kitchenMap.set(key, {
          item: item.menuItem.name,
          category: item.menuItem.category?.name ?? 'Uncategorized',
          quantity: 0,
          totalOrderToSend: 0,
          sendCount: 0,
          totalSendToClose: 0,
          closeCount: 0,
        });
      }
      const row = kitchenMap.get(key);
      row.quantity += item.quantity;
      row.totalOrderToSend += (new Date(item.sentAt).getTime() - new Date(item.order.createdAt).getTime()) / 60000;
      row.sendCount += 1;
      if (item.order.closedAt) {
        row.totalSendToClose += (new Date(item.order.closedAt).getTime() - new Date(item.sentAt).getTime()) / 60000;
        row.closeCount += 1;
      }
    }
    const kitchenTicketTimes = Array.from(kitchenMap.values())
      .map((row) => ({
        item: row.item,
        category: row.category,
        quantity: row.quantity,
        avgOrderToSendMinutes: avg(row.totalOrderToSend, row.sendCount),
        avgSendToCloseMinutes: avg(row.totalSendToClose, row.closeCount),
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 20);

    const voidRefundMap = new Map<string, any>();
    const ensureSignalRow = (name: string) => {
      if (!voidRefundMap.has(name)) {
        voidRefundMap.set(name, { employee: name, voidOrders: 0, voidItems: 0, refundCount: 0, refundAmount: 0, discountAmount: 0 });
      }
      return voidRefundMap.get(name);
    };
    for (const log of auditLogs) {
      const name = fullName(log.user);
      const row = ensureSignalRow(name);
      if (log.action === 'VOID_ORDER') row.voidOrders += 1;
      if (log.action === 'VOID_ITEM') row.voidItems += 1;
    }
    for (const order of orders) {
      if (order.server) {
        const row = ensureSignalRow(fullName(order.server));
        row.discountAmount += Number(order.discountAmount);
      }
      for (const payment of order.payments) {
        if (!payment.isRefunded) continue;
        const row = ensureSignalRow(fullName(payment.processedBy));
        row.refundCount += 1;
        row.refundAmount += Number(payment.refundAmount ?? 0);
      }
    }
    const voidCompRefunds = Array.from(voidRefundMap.values()).sort(
      (a, b) => (b.refundAmount + b.discountAmount + b.voidItems + b.voidOrders) - (a.refundAmount + a.discountAmount + a.voidItems + a.voidOrders)
    );

    const discountMap = new Map<string, any>();
    for (const order of orders) {
      for (const applied of order.discounts) {
        const key = `${applied.discountId}`;
        if (!discountMap.has(key)) {
          discountMap.set(key, {
            discount: applied.discount.name,
            code: applied.discount.code,
            count: 0,
            totalAmount: 0,
            topEmployee: 'Unassigned',
            employeeCount: new Map<string, number>(),
          });
        }
        const row = discountMap.get(key);
        row.count += 1;
        row.totalAmount += Number(applied.amount);
        const employee = fullName(order.server);
        row.employeeCount.set(employee, (row.employeeCount.get(employee) ?? 0) + 1);
      }
    }
    const discountPerformance = Array.from(discountMap.values())
      .map((row) => {
        let topEmployee = 'Unassigned';
        let max = 0;
        for (const [employee, count] of row.employeeCount.entries()) {
          if (count > max) {
            max = count;
            topEmployee = employee;
          }
        }
        return {
          discount: row.discount,
          code: row.code,
          count: row.count,
          totalAmount: row.totalAmount,
          avgDiscount: avg(row.totalAmount, row.count),
          topEmployee,
        };
      })
      .sort((a, b) => b.totalAmount - a.totalAmount);

    const categoryMap = new Map<string, any>();
    for (const item of nonVoidedItems) {
      const category = item.menuItem.category?.name ?? 'Uncategorized';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, { category, quantity: 0, revenue: 0 });
      }
      const row = categoryMap.get(category);
      row.quantity += item.quantity;
      row.revenue += item.quantity * Number(item.unitPrice);
    }
    const categorySalesMix = Array.from(categoryMap.values())
      .map((row) => ({ ...row, mixPercent: totalSales ? (row.revenue / totalSales) * 100 : 0 }))
      .sort((a, b) => b.revenue - a.revenue);

    const itemProfitMap = new Map<string, any>();
    for (const item of nonVoidedItems) {
      const key = `${item.menuItem.id}`;
      if (!itemProfitMap.has(key)) {
        itemProfitMap.set(key, {
          item: item.menuItem.name,
          category: item.menuItem.category?.name ?? 'Uncategorized',
          quantity: 0,
          revenue: 0,
          cost: 0,
        });
      }
      const row = itemProfitMap.get(key);
      row.quantity += item.quantity;
      row.revenue += item.quantity * Number(item.unitPrice);
      row.cost += item.quantity * Number(item.menuItem.cost ?? 0);
    }
    const itemProfitability = Array.from(itemProfitMap.values())
      .map((row) => ({
        ...row,
        grossProfit: row.revenue - row.cost,
        marginPercent: row.revenue ? ((row.revenue - row.cost) / row.revenue) * 100 : 0,
      }))
      .sort((a, b) => b.grossProfit - a.grossProfit)
      .slice(0, 25);

    const modifierMap = new Map<string, any>();
    for (const item of nonVoidedItems) {
      for (const mod of item.modifiers) {
        const key = `${mod.modifier.id}`;
        if (!modifierMap.has(key)) {
          modifierMap.set(key, { modifier: mod.modifier.name, count: 0, revenue: 0 });
        }
        const row = modifierMap.get(key);
        row.count += item.quantity;
        row.revenue += item.quantity * Number(mod.price);
      }
    }
    const modifierAddOns = Array.from(modifierMap.values())
      .map((row) => ({ ...row, attachmentRate: itemQtyTotal ? (row.count / itemQtyTotal) * 100 : 0 }))
      .sort((a, b) => b.revenue - a.revenue);

    const soldQtyByMenu = new Map<number, number>();
    for (const item of nonVoidedItems) {
      soldQtyByMenu.set(item.menuItemId, (soldQtyByMenu.get(item.menuItemId) ?? 0) + item.quantity);
    }
    const inventoryConsumption = inventory
      .map((item) => {
        const soldQty = item.menuItemId ? soldQtyByMenu.get(item.menuItemId) ?? 0 : 0;
        const onHand = Number(item.quantity);
        const dailyUse = soldQty / dayCount;
        return {
          item: item.menuItem?.name ?? item.customName ?? 'Custom Inventory',
          category: item.menuItem?.category?.name ?? 'Custom Inventory',
          onHand,
          soldQty,
          lowThreshold: Number(item.lowThreshold ?? 0),
          projectedDaysLeft: dailyUse > 0 ? onHand / dailyUse : null,
          status: onHand <= 0 ? 'Out' : item.lowThreshold && onHand <= Number(item.lowThreshold) ? 'Low' : 'OK',
        };
      })
      .sort((a, b) => a.onHand - b.onHand);

    const totalRefundAmount = sumBy(
      orders.flatMap((order) => order.payments.filter((payment) => payment.isRefunded)),
      (payment) => Number(payment.refundAmount ?? 0)
    );
    const voidedOrders = orders.filter((order) => order.status === 'VOIDED');
    const voidedItems = orderItems.filter((item) => item.status === 'VOIDED');
    const wasteShrink = [
      {
        signal: 'Voided Items',
        count: voidedItems.length,
        amount: sumBy(voidedItems, (item) => item.quantity * Number(item.unitPrice)),
        note: 'Operational waste proxy from voided line items',
      },
      {
        signal: 'Voided Orders',
        count: voidedOrders.length,
        amount: sumBy(voidedOrders, (order) => Number(order.total)),
        note: 'Canceled tickets impacting potential revenue',
      },
      {
        signal: 'Refunded Payments',
        count: orders.flatMap((order) => order.payments.filter((payment) => payment.isRefunded)).length,
        amount: totalRefundAmount,
        note: 'Cash leakage from refunded payments',
      },
      {
        signal: 'Out of Stock Inventory',
        count: inventoryConsumption.filter((row) => row.status === 'Out').length,
        amount: 0,
        note: 'Operational risk from depleted stock',
      },
    ];

    const inventoryValuationRows = inventory
      .map((item) => {
        const cost = Number(item.menuItem?.cost ?? 0);
        const onHand = Number(item.quantity);
        return {
          item: item.menuItem?.name ?? item.customName ?? 'Custom Inventory',
          category: item.menuItem?.category?.name ?? 'Custom Inventory',
          onHand,
          unitCost: cost,
          inventoryValue: onHand * cost,
          costTracked: Boolean(item.menuItem?.cost),
        };
      })
      .sort((a, b) => b.inventoryValue - a.inventoryValue);
    const inventoryValuation = {
      totalValue: sumBy(inventoryValuationRows, (row) => row.inventoryValue),
      trackedItems: inventoryValuationRows.filter((row) => row.costTracked).length,
      missingCostItems: inventoryValuationRows.filter((row) => !row.costTracked).length,
      rows: inventoryValuationRows,
    };

    const customerMap = new Map<string, any>();
    for (const order of paidOrders) {
      const customerKey = order.customerId
        ? `customer:${order.customerId}`
        : order.customerPhone
          ? `phone:${order.customerPhone}`
          : order.customerName
            ? `name:${order.customerName}`
            : null;
      if (!customerKey) continue;
      if (!customerMap.has(customerKey)) {
        customerMap.set(customerKey, {
          customer: order.customer
            ? `${order.customer.firstName} ${order.customer.lastName ?? ''}`.trim()
            : order.customerName ?? order.customerPhone ?? 'Walk-In',
          visits: 0,
          totalSales: 0,
          totalGuests: 0,
          firstVisit: order.createdAt,
          lastVisit: order.createdAt,
        });
      }
      const row = customerMap.get(customerKey);
      row.visits += 1;
      row.totalSales += Number(order.total);
      row.totalGuests += order.guestCount ?? 1;
      if (order.createdAt < row.firstVisit) row.firstVisit = order.createdAt;
      if (order.createdAt > row.lastVisit) row.lastVisit = order.createdAt;
    }
    const customerFrequency = Array.from(customerMap.values())
      .map((row) => ({
        customer: row.customer,
        visits: row.visits,
        totalSales: row.totalSales,
        avgCheck: avg(row.totalSales, row.visits),
        totalGuests: row.totalGuests,
        lastVisit: row.lastVisit,
        repeatCustomer: row.visits > 1,
      }))
      .sort((a, b) => b.visits - a.visits || b.totalSales - a.totalSales);

    const channelMap = new Map<string, any>();
    for (const type of ['DINE_IN', 'TO_GO', 'DELIVERY', 'BAR']) {
      channelMap.set(type, { type, totalSales: 0, totalOrders: 0, totalGuests: 0, avgCheck: 0 });
    }
    for (const order of paidOrders) {
      const row = channelMap.get(order.type);
      row.totalSales += Number(order.total);
      row.totalOrders += 1;
      row.totalGuests += order.guestCount ?? 1;
    }
    const channelSales = Array.from(channelMap.values()).map((row) => ({
      ...row,
      avgCheck: avg(row.totalSales, row.totalOrders),
      revenuePerGuest: avg(row.totalSales, row.totalGuests),
    }));

    const overview = {
      totalSales,
      paidOrders: paidOrders.length,
      avgCheck: avg(totalSales, paidOrders.length),
      totalTips: sumBy(paidOrders, (order) => Number(order.tipAmount)),
      totalGuests,
      repeatCustomers: customerFrequency.filter((row) => row.repeatCustomer).length,
      laborHours: Array.from(laborHoursByUser.values()).reduce((sum, value) => sum + value, 0),
      inventoryValue: inventoryValuation.totalValue,
      outOfStockItems: inventoryConsumption.filter((row) => row.status === 'Out').length,
    };

    res.json({
      meta: { start, end, dayCount },
      overview,
      employeePerformance,
      serverTips,
      shiftPerformance,
      laborVsSales,
      salesByDayOfWeek,
      salesByServicePeriod,
      coversAndGuests,
      tableTurnTimes,
      orderFulfillment,
      kitchenTicketTimes,
      voidCompRefunds,
      discountPerformance,
      categorySalesMix,
      itemProfitability,
      modifierAddOns,
      inventoryConsumption,
      wasteShrink,
      inventoryValuation,
      customerFrequency,
      channelSales,
    });
  } catch (err) {
    next(err);
  }
}
