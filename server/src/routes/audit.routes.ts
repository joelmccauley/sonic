import { Router } from 'express';
import * as ctrl from '../controllers/audit.controller';
import { authenticate, requireManager, requireFeature } from '../middleware/auth';

export const auditRoutes = Router();

auditRoutes.use(authenticate, requireManager, requireFeature('auditLog'));

auditRoutes.get('/', ctrl.getAuditLogs);
auditRoutes.get('/export', ctrl.exportAuditLogs);
