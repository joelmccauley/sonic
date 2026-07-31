import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';

export async function getAuditLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, entity, action, startDate, endDate, limit = '100', offset = '0' } = req.query;
    const where: any = {};
    if (userId) where.userId = parseInt(String(userId));
    if (entity) where.entity = String(entity);
    if (action) where.action = { contains: String(action), mode: 'insensitive' };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(String(startDate));
      if (endDate) where.createdAt.lte = new Date(String(endDate));
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { firstName: true, lastName: true, username: true } } },
        orderBy: { createdAt: 'desc' },
        take: parseInt(String(limit)),
        skip: parseInt(String(offset)),
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ logs, total });
  } catch (err) {
    next(err);
  }
}

export async function exportAuditLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const { startDate, endDate } = req.query;
    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(String(startDate));
      if (endDate) where.createdAt.lte = new Date(String(endDate));
    }

    const logs = await prisma.auditLog.findMany({
      where,
      include: { user: { select: { username: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });

    // Return as CSV
    const csv = [
      'Timestamp,User,Action,Entity,EntityId,Details,IP',
      ...logs.map((l) =>
        [
          l.createdAt.toISOString(),
          l.user ? `${l.user.firstName} ${l.user.lastName}` : 'System',
          l.action,
          l.entity,
          l.entityId ?? '',
          l.details ? JSON.stringify(l.details).replace(/,/g, ';') : '',
          l.ipAddress ?? '',
        ].join(',')
      ),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-log.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
}
