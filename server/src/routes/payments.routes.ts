import { Router } from 'express';
import * as ctrl from '../controllers/payments.controller';
import { authenticate, requireManager } from '../middleware/auth';

export const paymentsRoutes = Router();

paymentsRoutes.use(authenticate);

paymentsRoutes.post('/orders/:orderId/pay', ctrl.processPayment);
paymentsRoutes.post('/orders/:orderId/refund/:paymentId', requireManager, ctrl.processRefund);
paymentsRoutes.get('/orders/:orderId', ctrl.getOrderPayments);
paymentsRoutes.post('/orders/:orderId/print-receipt', ctrl.printReceipt);
