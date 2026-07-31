import { prisma } from '../config/database';
import { logger } from '../utils/logger';

class AuditService {
  async log(
    userId: number | undefined,
    action: string,
    entity: string,
    entityId?: string,
    details?: Record<string, unknown>,
    ipAddress?: string
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: { userId, action, entity, entityId, details, ipAddress },
      });
    } catch (err) {
      logger.warn('Failed to create audit log', err);
    }
  }
}

export const auditService = new AuditService();
