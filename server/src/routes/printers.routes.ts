import { Router } from 'express';
import * as ctrl from '../controllers/printers.controller';
import { authenticate, requireManager } from '../middleware/auth';

export const printerRoutes = Router();

printerRoutes.use(authenticate);

printerRoutes.get('/', ctrl.getPrinters);
printerRoutes.post('/', requireManager, ctrl.createPrinter);
printerRoutes.put('/:id', requireManager, ctrl.updatePrinter);
printerRoutes.delete('/:id', requireManager, ctrl.deletePrinter);
printerRoutes.post('/:id/test', requireManager, ctrl.testPrinter);
printerRoutes.patch('/:id/default', requireManager, ctrl.setDefaultPrinter);
