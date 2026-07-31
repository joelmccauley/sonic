import http from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { initWebSocket } from './services/websocket.service';
import { prisma } from './config/database';

async function bootstrap() {
  // Verify DB connection
  try {
    await prisma.$connect();
    logger.info('✅ Database connected');
  } catch (err) {
    logger.error('❌ Database connection failed', err);
    process.exit(1);
  }

  const app = createApp();
  const httpServer = http.createServer(app);

  // Initialize WebSocket
  initWebSocket(httpServer);

  httpServer.listen(env.PORT, () => {
    logger.info(`🚀 SonicPOS server running on port ${env.PORT} [${env.NODE_ENV}]`);
    logger.info(`📡 WebSocket ready`);
    logger.info(`🔗 Health: http://localhost:${env.PORT}/health`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    httpServer.close(async () => {
      await prisma.$disconnect();
      logger.info('Server closed');
      process.exit(0);
    });
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', err);
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', reason);
    process.exit(1);
  });
}

bootstrap();
