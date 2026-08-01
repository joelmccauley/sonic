import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getMyActivityOverview, getMyActivityDetail } from '../controllers/activity.controller';

export const activityRoutes = Router();

activityRoutes.use(authenticate);

activityRoutes.get('/overview', getMyActivityOverview);
activityRoutes.get('/details/:metric', getMyActivityDetail);