import { Router } from 'express';
import * as ctrl from '../controllers/reports.controller';
import { authenticate, requireManager } from '../middleware/auth';

export const reportsRoutes = Router();

reportsRoutes.use(authenticate, requireManager);

reportsRoutes.get('/sales', ctrl.salesReport);
reportsRoutes.get('/sales/hourly', ctrl.hourlySales);
reportsRoutes.get('/items', ctrl.itemsReport);
reportsRoutes.get('/employees', ctrl.employeesReport);
reportsRoutes.get('/payments', ctrl.paymentsReport);
reportsRoutes.get('/discounts', ctrl.discountsReport);
reportsRoutes.get('/summary', ctrl.getDailySummary);
reportsRoutes.get('/analytics', ctrl.analyticsDashboard);
