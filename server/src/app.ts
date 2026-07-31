import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { env } from './config/env';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { apiRouter } from './routes';
import { handleStripeWebhook } from './controllers/billing.controller';

export function createApp(): Application {
  const app = express();

  // ── Security headers ───────────────────────────────────────────────────
  app.use(helmet());

  // ── CORS ──────────────────────────────────────────────────────────────
  app.use(
    cors({
      origin: [env.CLIENT_URL, /^http:\/\/localhost:\d+$/],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // ── Compression ────────────────────────────────────────────────────────
  app.use(compression());

  // ── Stripe webhook (raw body required for signature verification; must be
  //    registered BEFORE express.json) ─────────────────────────────────
  app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

  // ── Body parsing ────────────────────────────────────────────────────────
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));

  // ── HTTP logging ────────────────────────────────────────────────────────
  app.use(
    morgan('combined', {
      stream: { write: (msg) => logger.http(msg.trim()) },
      skip: (req) => req.url === '/health',
    })
  );

  // ── Rate limiting ────────────────────────────────────────────────────────
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  });
  app.use('/api/', limiter);

  // Tighter limit on auth endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { error: 'Too many authentication attempts.' },
  });
  app.use('/api/auth/', authLimiter);

  // ── Static uploads folder ────────────────────────────────────────────────
  app.use('/uploads', (_req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  }, express.static(path.join(__dirname, '../uploads')));

  // ── Health check ─────────────────────────────────────────────────────────
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
  });

  // ── API routes ───────────────────────────────────────────────────────────
  app.use('/api', apiRouter);

  // ── 404 ──────────────────────────────────────────────────────────────────
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Route not found' });
  });

  // ── Global error handler ──────────────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
