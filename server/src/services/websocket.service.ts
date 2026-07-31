import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import type { JwtPayload } from '../middleware/auth';

let io: SocketServer;

/** Room names are namespaced per organization so tenants never cross streams. */
function orgRoom(organizationId: number, room: string): string {
  return `org:${organizationId}:${room}`;
}

export function initWebSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: [env.CLIENT_URL, /^http:\/\/localhost:\d+$/],
      credentials: true,
    },
    pingTimeout: 60_000,
    pingInterval: 25_000,
  });

  // Authenticate sockets and attach the tenant
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error('Authentication required'));
      const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      if (!payload.organizationId) return next(new Error('Session outdated'));
      (socket.data as any).organizationId = payload.organizationId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const organizationId = (socket.data as any).organizationId as number;
    logger.info(`WebSocket connected: ${socket.id} (org ${organizationId})`);

    // Join rooms based on client type — always namespaced to the socket's org
    socket.on('join', (rooms: string | string[]) => {
      const roomList = Array.isArray(rooms) ? rooms : [rooms];
      roomList.forEach((r) => socket.join(orgRoom(organizationId, r)));
      logger.debug(`Socket ${socket.id} joined: ${roomList.join(', ')} (org ${organizationId})`);
    });

    // KDS item status update from kitchen
    socket.on('kds:item-status', async (data: { orderId: number; itemId: number; status: string }) => {
      io.to(orgRoom(organizationId, 'pos')).emit('kds:item-status', data);
      io.to(orgRoom(organizationId, 'kds')).emit('kds:item-status', data);
    });

    // Table status change broadcast
    socket.on('table:status', (data: { tableId: number; status: string }) => {
      io.to(orgRoom(organizationId, 'pos')).emit('table:status', data);
    });

    socket.on('disconnect', (reason) => {
      logger.info(`WebSocket disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
}

export function getIO(): SocketServer {
  if (!io) throw new Error('WebSocket not initialized');
  return io;
}

export function emitOrderUpdate(order: any): void {
  if (!io || !order?.organizationId) return;
  io.to(orgRoom(order.organizationId, 'pos')).emit('order:update', order);
  io.to(orgRoom(order.organizationId, 'kds')).emit('order:update', order);
}

export function emitKDSUpdate(order: any): void {
  if (!io || !order?.organizationId) return;
  io.to(orgRoom(order.organizationId, 'kds')).emit('kds:new-order', order);
}

export function emitTableUpdate(table: any): void {
  if (!io || !table?.organizationId) return;
  io.to(orgRoom(table.organizationId, 'pos')).emit('table:update', table);
}

export function emitLowStockAlert(item: any): void {
  if (!io || !item?.organizationId) return;
  io.to(orgRoom(item.organizationId, 'admin')).emit('inventory:low-stock', item);
}
