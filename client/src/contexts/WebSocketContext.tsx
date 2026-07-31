import React, { createContext, useContext, useEffect, useRef, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/authStore';
import { useOrderStore } from '@/store/orderStore';
import type { Order, Table } from '@/types';

interface WebSocketContextValue {
  socket: Socket | null;
  joinRoom: (room: string | string[]) => void;
}

const WebSocketContext = createContext<WebSocketContextValue>({ socket: null, joinRoom: () => {} });

export function WebSocketProvider({ children, rooms }: { children: ReactNode; rooms?: string[] }) {
  const socketRef = useRef<Socket | null>(null);
  const { isAuthenticated, token } = useAuthStore();
  const { updateKDSOrder, setActiveOrder, activeOrder } = useOrderStore();

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const socket = io('/', {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[WS] Connected');
      if (rooms?.length) socket.emit('join', rooms);
    });

    socket.on('order:update', (order: Order) => {
      updateKDSOrder(order);
      // If this is the active order, refresh it
      if (activeOrder?.id === order.id) {
        setActiveOrder(order);
      }
    });

    socket.on('kds:new-order', (order: Order) => {
      updateKDSOrder(order);
    });

    socket.on('disconnect', (reason) => {
      console.log('[WS] Disconnected:', reason);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, token]);

  const joinRoom = (room: string | string[]) => {
    socketRef.current?.emit('join', room);
  };

  return (
    <WebSocketContext.Provider value={{ socket: socketRef.current, joinRoom }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export const useWebSocket = () => useContext(WebSocketContext);
