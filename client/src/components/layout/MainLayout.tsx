import React from 'react';
import { Box } from '@mui/material';
import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import LockScreen from './LockScreen';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { WebSocketProvider } from '@/contexts/WebSocketContext';

export default function MainLayout() {
  const { isAuthenticated, isLocked } = useAuthStore();
  const { sidebarOpen, toggleSidebar } = useUIStore();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <WebSocketProvider rooms={['pos', 'kds']}>
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
        <Sidebar open={sidebarOpen} onToggle={toggleSidebar} />
        <Box component="main" sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <Outlet />
        </Box>
      </Box>
      {isLocked && <LockScreen />}
    </WebSocketProvider>
  );
}
