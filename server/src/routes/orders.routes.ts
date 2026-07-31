import { Router } from 'express';
import * as ctrl from '../controllers/orders.controller';
import { authenticate } from '../middleware/auth';

export const ordersRoutes = Router();

ordersRoutes.use(authenticate);

ordersRoutes.get('/', ctrl.getOrders);
ordersRoutes.get('/open', ctrl.getOpenOrders);
ordersRoutes.get('/kds', ctrl.getKDSOrders);
ordersRoutes.get('/:id', ctrl.getOrder);
ordersRoutes.post('/', ctrl.createOrder);
ordersRoutes.put('/:id', ctrl.updateOrder);
ordersRoutes.patch('/:id/status', ctrl.updateOrderStatus);
ordersRoutes.post('/:id/items', ctrl.addOrderItem);
ordersRoutes.put('/:id/items/:itemId', ctrl.updateOrderItem);
ordersRoutes.patch('/:id/items/:itemId', ctrl.updateItemStatus);
ordersRoutes.delete('/:id/items/:itemId', ctrl.voidOrderItem);
ordersRoutes.post('/:id/send', ctrl.sendToKitchen);
ordersRoutes.post('/:id/transfer', ctrl.transferTable);
ordersRoutes.post('/:id/split', ctrl.splitCheck);
ordersRoutes.post('/:id/discount', ctrl.applyDiscount);
ordersRoutes.delete('/:id/discount/:discountId', ctrl.removeDiscount);
ordersRoutes.delete('/:id/void', ctrl.voidOrder);
ordersRoutes.get('/:id/receipt', ctrl.getReceipt);
