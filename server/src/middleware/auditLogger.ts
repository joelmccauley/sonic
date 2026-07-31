import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

export function auditLog(action: string, entity: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    // Run after handler via res.on('finish')
    next();

    // Fire-and-forget audit entry
    const entityId = req.params.id ?? req.params.tableId ?? null;
    prisma.auditLog
      .create({
        data: {
          userId: req.user?.userId,
          action,
          entity,
          entityId: entityId ?? undefined,
          details: req.method !== 'GET' ? req.body : undefined,
          ipAddress: req.ip,
        },
      })
      .catch((err) => logger.warn('Audit log failed', err));
  };
}
