import { Request, Response, NextFunction } from 'express';
import { Role, OrderStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/database';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const ACTIVE_STATUSES: OrderStatus[] = ['OPEN', 'SENT_TO_KITCHEN', 'IN_PROGRESS', 'READY'];
const SAFE_AUDIT_ACTIONS = new Set([
  'CREATE_ORDER',
  'SEND_TO_KITCHEN',
  'TRANSFER_TABLE',
  'APPLY_DISCOUNT',
  'VOID_ITEM',
  'VOID_ORDER',
  'PROCESS_PAYMENT',
  'PROCESS_REFUND',
  'CREATE_EMPLOYEE',
  'ENABLE_EMPLOYEE',
  'DISABLE_EMPLOYEE',
  'CHANGE_ROLE',
]);

const detailMetricSchema = z.enum(['needs-attention', 'open-checks', 'paid-today', 'sales-today']);

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatDateTime(date: Date) {
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function roleGroup(role: Role) {
  if (role === Role.OWNER || role === Role.MANAGER) return 'leader';
  if (role === Role.KITCHEN || role === Role.BARTENDER) return 'production';
  return 'service';
}

function toMoney(value: unknown) {
  return Number(value ?? 0);
}

function buildTone(kind: string) {
  if (kind.includes('VOID') || kind.includes('REFUND')) return 'error';
  if (kind.includes('PAYMENT')) return 'success';
  if (kind.includes('CREATE')) return 'info';
  if (kind.includes('READY') || kind.includes('SEND')) return 'warning';
  return 'neutral';
}

export async function getMyActivityOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const isLeader = user.role === Role.OWNER || user.role === Role.MANAGER;
    const today = startOfDay(new Date());
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 6);
    const group = roleGroup(user.role);

    const [recentOrders, activeOrders, recentPayments, recentShifts, recentLogs, tables, lowInventoryCandidates, customersAdded] = await Promise.all([
      prisma.order.findMany({
        where: {
          OR: [
            { createdAt: { gte: weekStart } },
            { closedAt: { gte: weekStart } },
          ],
        },
        include: {
          table: { select: { name: true } },
          server: { select: { firstName: true, lastName: true } },
          payments: { select: { id: true, createdAt: true, processedById: true, amount: true, tip: true, method: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      }),
      prisma.order.findMany({
        where: {
          status: { in: [...ACTIVE_STATUSES] },
          OR: [
            { tableId: null },
            { table: { isActive: true } },
          ],
        },
        select: { id: true, status: true, type: true, tableId: true, serverId: true, table: { select: { name: true } }, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.payment.findMany({
        where: { createdAt: { gte: weekStart } },
        include: {
          order: { select: { orderNumber: true, type: true, table: { select: { name: true } } } },
          processedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.shift.findMany({
        where: { OR: [{ clockIn: { gte: weekStart } }, { clockOut: { gte: weekStart } }] },
        include: { user: { select: { firstName: true, lastName: true, role: true } } },
        orderBy: { clockIn: 'desc' },
        take: 50,
      }),
      prisma.auditLog.findMany({
        where: { createdAt: { gte: weekStart } },
        include: { user: { select: { firstName: true, lastName: true, username: true } } },
        orderBy: { createdAt: 'desc' },
        take: 80,
      }),
      prisma.table.findMany({
        select: { id: true, name: true, status: true, section: true },
      }),
      prisma.inventoryItem.findMany({
        where: { lowThreshold: { not: null } },
        include: { menuItem: { select: { name: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 200,
      }),
      prisma.customer.count({ where: { createdAt: { gte: weekStart } } }),
    ]);

    const lowInventory = lowInventoryCandidates.filter((item) => Number(item.quantity ?? 0) <= Number(item.lowThreshold ?? Number.POSITIVE_INFINITY));

    const orgOrders = isLeader ? recentOrders : recentOrders.filter((order) => order.serverId === user.userId || order.payments.some((payment) => payment.processedById === user.userId));
    const orgPayments = isLeader ? recentPayments : recentPayments.filter((payment) => payment.processedById === user.userId);
    const orgShifts = isLeader ? recentShifts : recentShifts.filter((shift) => shift.userId === user.userId);
    const orgLogs = isLeader ? recentLogs.filter((log) => SAFE_AUDIT_ACTIONS.has(log.action)) : recentLogs.filter((log) => log.userId === user.userId && SAFE_AUDIT_ACTIONS.has(log.action));

    const completed7d = recentOrders.filter((order) => order.status === 'PAID' && !!order.closedAt && new Date(order.closedAt) >= weekStart).length;
    const created7d = recentLogs.filter((log) => log.action.startsWith('CREATE_')).length;
    const updated7d = recentLogs.filter((log) => SAFE_AUDIT_ACTIONS.has(log.action) && !log.action.startsWith('CREATE_')).length;
    const dueSoon = group === 'production'
      ? activeOrders.filter((order) => order.status === 'SENT_TO_KITCHEN' || order.status === 'IN_PROGRESS').length
      : group === 'service'
        ? tables.filter((table) => table.status === 'OCCUPIED').length
        : activeOrders.filter((order) => order.status === 'SENT_TO_KITCHEN' || order.status === 'IN_PROGRESS').length + lowInventory.length;

    const paidToday = recentOrders.filter((order) => order.status === 'PAID' && !!order.closedAt && new Date(order.closedAt) >= today).length;
    const openToday = recentOrders.filter((order) => ACTIVE_STATUSES.includes(order.status as (typeof ACTIVE_STATUSES)[number])).length;
    const totalTipsToday = recentPayments.filter((payment) => new Date(payment.createdAt) >= today).reduce((sum, payment) => sum + toMoney(payment.tip), 0);
    const totalSalesToday = recentPayments.filter((payment) => new Date(payment.createdAt) >= today).reduce((sum, payment) => sum + toMoney(payment.amount), 0);
    const lowInventoryCount = lowInventory.length;
    const occupiedTablesCount = tables.filter((table) => table.status === 'OCCUPIED').length;
    const activeShift = orgShifts.find((shift) => !shift.clockOut) ?? null;
    const activeShiftMinutes = activeShift ? Math.max(0, Math.round((Date.now() - new Date(activeShift.clockIn).getTime()) / 60000)) : 0;
    const myOrdersToday = recentOrders.filter((order) => order.serverId === user.userId && new Date(order.createdAt) >= today).length;
    const myTipsToday = recentPayments.filter((payment) => payment.processedById === user.userId && new Date(payment.createdAt) >= today).reduce((sum, payment) => sum + toMoney(payment.tip), 0);

    const focusCards = group === 'leader'
      ? [
        { title: 'Open checks', value: activeOrders.length, subtitle: 'All live orders', color: '#3f8fdf' },
        { title: 'Due soon', value: dueSoon, subtitle: 'Needs attention', color: '#f59e0b' },
        { title: 'Low stock', value: lowInventoryCount, subtitle: 'Inventory to review', color: '#ef4444' },
        { title: 'Customers added', value: customersAdded, subtitle: 'Last 7 days', color: '#22c55e' },
      ]
      : group === 'production'
        ? [
          { title: 'Tickets in queue', value: activeOrders.filter((order) => order.status === 'SENT_TO_KITCHEN').length, subtitle: 'Waiting to be worked', color: '#f59e0b' },
          { title: 'In progress', value: activeOrders.filter((order) => order.status === 'IN_PROGRESS').length, subtitle: 'Currently cooking', color: '#3f8fdf' },
          { title: 'Ready to bump', value: activeOrders.filter((order) => order.status === 'READY').length, subtitle: 'Waiting for delivery', color: '#22c55e' },
          { title: 'Completed', value: completed7d, subtitle: 'Closed this week', color: '#7c3aed' },
        ]
        : [
          { title: 'Active shift', value: activeShift ? `${activeShiftMinutes} min` : 'Not clocked in', subtitle: activeShift ? 'Clocked in now' : 'No active shift', color: '#3f8fdf' },
          { title: 'Occupied tables', value: tables.filter((table) => table.status === 'OCCUPIED').length, subtitle: 'On the floor', color: '#f59e0b' },
          { title: 'My orders', value: myOrdersToday, subtitle: 'Created today', color: '#22c55e' },
          { title: 'My tips', value: `$${myTipsToday.toFixed(2)}`, subtitle: 'Processed today', color: '#7c3aed' },
        ];

    const workstream = group === 'production'
      ? [
        { label: 'Tickets waiting', value: activeOrders.filter((order) => order.status === 'SENT_TO_KITCHEN').length, color: '#c19c00' },
        { label: 'In progress', value: activeOrders.filter((order) => order.status === 'IN_PROGRESS').length, color: '#0078d4' },
        { label: 'Ready to bump', value: activeOrders.filter((order) => order.status === 'READY').length, color: '#57a300' },
      ]
      : group === 'service'
        ? [
          { label: 'Open checks', value: activeOrders.length, color: '#0078d4' },
          { label: 'Occupied tables', value: occupiedTablesCount, color: '#c19c00' },
          { label: 'Paid today', value: paidToday, color: '#57a300' },
        ]
        : [
          { label: 'Paid today', value: paidToday, color: '#57a300' },
          { label: 'Open checks', value: activeOrders.length, color: '#0078d4' },
          { label: 'Needs attention', value: dueSoon, color: '#c19c00' },
        ];

    const feedBase = [
      ...orgLogs.map((log) => ({
        id: `log-${log.id}`,
        kind: log.action.toLowerCase(),
        title: `${log.action.replace(/_/g, ' ').toLowerCase()}`,
        subtitle: `${log.entity}${log.entityId ? ` #${log.entityId}` : ''}${log.user ? ` · ${log.user.firstName} ${log.user.lastName}` : ''}`,
        time: log.createdAt,
        tone: buildTone(log.action),
      })),
      ...orgPayments.map((payment) => ({
        id: `payment-${payment.id}`,
        kind: 'payment',
        title: `Payment ${payment.method.toLowerCase().replace('_', ' ')}`,
        subtitle: `Order ${payment.order.orderNumber}${payment.order.table?.name ? ` · ${payment.order.table.name}` : ''} · ${formatDateTime(payment.createdAt)}`,
        time: payment.createdAt,
        tone: 'success' as const,
      })),
      ...orgShifts.map((shift) => ({
        id: `shift-${shift.id}`,
        kind: 'shift',
        title: shift.clockOut ? 'Shift closed' : 'Shift opened',
        subtitle: `${shift.user.firstName} ${shift.user.lastName} · ${formatDateTime(shift.clockOut ?? shift.clockIn)}`,
        time: shift.clockOut ?? shift.clockIn,
        tone: shift.clockOut ? 'neutral' : 'info' as const,
      })),
      ...recentOrders
        .filter((order) => order.createdAt >= weekStart || (order.closedAt && new Date(order.closedAt) >= weekStart))
        .filter((order) => isLeader || order.serverId === user.userId)
        .map((order) => ({
          id: `order-${order.id}`,
          kind: 'order',
          title: order.status === 'PAID' ? `Order ${order.orderNumber} completed` : `Order ${order.orderNumber} opened`,
          subtitle: `${order.type.replace('_', ' ')}${order.table?.name ? ` · ${order.table.name}` : ''} · ${formatDateTime(order.closedAt ?? order.createdAt)}`,
          time: order.closedAt ?? order.createdAt,
          tone: order.status === 'PAID' ? 'success' as const : 'warning' as const,
        })),
      ...lowInventory.map((item) => ({
        id: `inventory-${item.id}`,
        kind: 'inventory',
        title: `Low stock: ${item.menuItem?.name ?? item.customName ?? 'Inventory item'}`,
        subtitle: `${Number(item.quantity).toFixed(0)} remaining · threshold ${Number(item.lowThreshold ?? 0).toFixed(0)}`,
        time: item.updatedAt,
        tone: 'error' as const,
      })),
    ];

    const feed = feedBase
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 16)
      .map((entry) => ({
        id: entry.id,
        kind: entry.kind,
        title: entry.title,
        subtitle: entry.subtitle,
        timeLabel: formatTime(new Date(entry.time)),
        tone: entry.tone,
      }));

    res.json({
      role: user.role,
      scopeLabel: isLeader ? 'Team activity' : 'My activity',
      summary: {
        completed7d,
        created7d,
        updated7d,
        dueSoon,
      },
      focusCards,
      workstream,
      feed,
      meta: {
        openOrders: activeOrders.length,
        paidToday,
        openToday,
        totalSalesToday,
        totalTipsToday,
        lowInventoryCount,
        activeShiftMinutes,
      },
    });
  } catch (err) {
    next(err);
  }
}

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`;
}

export async function getMyActivityDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const metric = detailMetricSchema.parse(req.params.metric);
    const today = startOfDay(new Date());
    const group = roleGroup(user.role);

    const activeOrders = await prisma.order.findMany({
      where: {
        status: { in: [...ACTIVE_STATUSES] },
        OR: [
          { tableId: null },
          { table: { isActive: true } },
        ],
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        type: true,
        total: true,
        updatedAt: true,
        createdAt: true,
        table: { select: { name: true } },
        serverId: true,
        server: { select: { firstName: true, lastName: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });

    const paidOrdersToday = await prisma.order.findMany({
      where: {
        status: OrderStatus.PAID,
        closedAt: { gte: today },
      },
      select: {
        id: true,
        orderNumber: true,
        type: true,
        total: true,
        closedAt: true,
        table: { select: { name: true } },
        serverId: true,
        server: { select: { firstName: true, lastName: true } },
      },
      orderBy: { closedAt: 'desc' },
      take: 300,
    });

    const paymentsToday = await prisma.payment.findMany({
      where: { createdAt: { gte: today } },
      select: {
        id: true,
        amount: true,
        tip: true,
        method: true,
        createdAt: true,
        processedById: true,
        processedBy: { select: { firstName: true, lastName: true } },
        order: { select: { id: true, orderNumber: true, table: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const lowInventoryCandidates = await prisma.inventoryItem.findMany({
      where: { lowThreshold: { not: null } },
      include: { menuItem: { select: { name: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 300,
    });

    const lowInventory = lowInventoryCandidates.filter((item) => Number(item.quantity ?? 0) <= Number(item.lowThreshold ?? Number.POSITIVE_INFINITY));

    const visibleActiveOrders = user.role === Role.OWNER || user.role === Role.MANAGER
      ? activeOrders
      : activeOrders.filter((order) => order.serverId === user.userId);

    const visiblePaidOrders = user.role === Role.OWNER || user.role === Role.MANAGER
      ? paidOrdersToday
      : paidOrdersToday.filter((order) => order.serverId === user.userId);

    const visiblePayments = user.role === Role.OWNER || user.role === Role.MANAGER
      ? paymentsToday
      : paymentsToday.filter((payment) => payment.processedById === user.userId);

    if (metric === 'open-checks') {
      const items = visibleActiveOrders.map((order) => ({
        id: `order-${order.id}`,
        title: `Order ${order.orderNumber}`,
        subtitle: `${order.type.replace('_', ' ')}${order.table?.name ? ` · ${order.table.name}` : ''}${order.server ? ` · ${order.server.firstName} ${order.server.lastName}` : ''}`,
        status: order.status,
        amountLabel: formatCurrency(Number(order.total ?? 0)),
        timeLabel: formatDateTime(order.updatedAt),
      }));

      res.json({
        metric,
        title: 'Open checks',
        description: 'Orders that are still active and not yet closed.',
        summary: {
          count: items.length,
          totalAmount: items.reduce((sum, item) => sum + Number(item.amountLabel.replace('$', '')), 0),
        },
        sections: [{ id: 'open-checks', title: 'Active orders', items }],
      });
      return;
    }

    if (metric === 'paid-today') {
      const items = visiblePaidOrders.map((order) => ({
        id: `paid-order-${order.id}`,
        title: `Order ${order.orderNumber}`,
        subtitle: `${order.type.replace('_', ' ')}${order.table?.name ? ` · ${order.table.name}` : ''}${order.server ? ` · ${order.server.firstName} ${order.server.lastName}` : ''}`,
        status: 'PAID',
        amountLabel: formatCurrency(Number(order.total ?? 0)),
        timeLabel: formatDateTime(order.closedAt ?? new Date()),
      }));

      res.json({
        metric,
        title: 'Paid today',
        description: 'Checks that were closed and marked paid today.',
        summary: {
          count: items.length,
          totalAmount: items.reduce((sum, item) => sum + Number(item.amountLabel.replace('$', '')), 0),
        },
        sections: [{ id: 'paid-today', title: 'Paid checks', items }],
      });
      return;
    }

    if (metric === 'sales-today') {
      const items = visiblePayments.map((payment) => ({
        id: `payment-${payment.id}`,
        title: `Payment ${payment.method.replace('_', ' ')}`,
        subtitle: `Order ${payment.order.orderNumber}${payment.order.table?.name ? ` · ${payment.order.table.name}` : ''}${payment.processedBy ? ` · ${payment.processedBy.firstName} ${payment.processedBy.lastName}` : ''}`,
        amountLabel: formatCurrency(Number(payment.amount ?? 0)),
        tipLabel: formatCurrency(Number(payment.tip ?? 0)),
        timeLabel: formatDateTime(payment.createdAt),
      }));

      res.json({
        metric,
        title: 'Sales today',
        description: 'Payments processed today, including tips.',
        summary: {
          count: items.length,
          totalAmount: visiblePayments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0),
        },
        sections: [{ id: 'sales-today', title: 'Payments', items }],
      });
      return;
    }

    const attentionOrders = visibleActiveOrders.filter((order) => order.status === OrderStatus.SENT_TO_KITCHEN || order.status === OrderStatus.IN_PROGRESS);
    const orderItems = attentionOrders.map((order) => ({
      id: `attention-order-${order.id}`,
      title: `Order ${order.orderNumber}`,
      subtitle: `${order.type.replace('_', ' ')}${order.table?.name ? ` · ${order.table.name}` : ''}${order.server ? ` · ${order.server.firstName} ${order.server.lastName}` : ''}`,
      status: order.status,
      amountLabel: formatCurrency(Number(order.total ?? 0)),
      timeLabel: formatDateTime(order.updatedAt),
    }));

    const inventoryItems = (group === 'leader' ? lowInventory : []).map((item) => ({
      id: `inventory-${item.id}`,
      title: item.menuItem?.name ?? item.customName ?? 'Inventory item',
      subtitle: `Threshold ${Number(item.lowThreshold ?? 0).toFixed(0)} · current ${Number(item.quantity ?? 0).toFixed(0)} ${item.unit}`,
      status: 'LOW_STOCK',
      amountLabel: null,
      timeLabel: formatDateTime(item.updatedAt),
    }));

    res.json({
      metric,
      title: 'Needs attention',
      description: 'Items that need action now.',
      summary: {
        count: orderItems.length + inventoryItems.length,
        totalAmount: orderItems.reduce((sum, item) => sum + Number(item.amountLabel?.replace('$', '') ?? 0), 0),
      },
      sections: [
        { id: 'attention-orders', title: 'Kitchen / service queue', items: orderItems },
        ...(inventoryItems.length > 0 ? [{ id: 'attention-inventory', title: 'Low inventory', items: inventoryItems }] : []),
      ],
    });
  } catch (err) {
    next(err);
  }
}