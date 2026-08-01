import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme';
import MainLayout from './components/layout/MainLayout';
import LoginPage from './pages/LoginPage';
import LandingPage from './pages/LandingPage';
import SignupPage from './pages/SignupPage';
import POSPage from './pages/POSPage';
import KDSPage from './pages/KDSPage';
import AdminPage from './pages/AdminPage';
import FloorViewPage from './pages/FloorViewPage';
import MyActivityPage from './pages/MyActivityPage';
import MyActivityDetailPage from './pages/MyActivityDetailPage';
import PlatformAdminLoginPage from './pages/PlatformAdminLoginPage';
import PlatformAdminDashboardPage from './pages/PlatformAdminDashboardPage';
import PublicOrderPage from './pages/PublicOrderPage';
import { useAuthStore } from './store/authStore';
import { usePlatformAdminStore } from './store/platformAdminStore';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/" replace />;
}

function RequireRole({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/floorview" replace />;
  return <>{children}</>;
}

function RequirePlatformAdmin({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = usePlatformAdminStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/platform/login" replace />;
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/platform/login" element={<PlatformAdminLoginPage />} />
        <Route path="/platform/dashboard" element={<RequirePlatformAdmin><PlatformAdminDashboardPage /></RequirePlatformAdmin>} />
        <Route path="/platform" element={<Navigate to="/platform/dashboard" replace />} />
        <Route path="/order/:slug" element={<PublicOrderPage />} />
        <Route element={<RequireAuth><MainLayout /></RequireAuth>}>
          <Route path="/orders" element={<Navigate to="/floorview" replace />} />
          <Route path="/order-builder" element={
            <RequireRole roles={['OWNER', 'MANAGER']}>
              <POSPage />
            </RequireRole>
          } />
          <Route path="/pos" element={<Navigate to="/order-builder" replace />} />
          <Route path="/floorview" element={<FloorViewPage />} />
          <Route path="/my-activity" element={<MyActivityPage />} />
          <Route path="/my-activity/details/:metric" element={<MyActivityDetailPage />} />
          <Route path="/kds" element={
            <RequireRole roles={['OWNER', 'MANAGER', 'KITCHEN', 'SERVER', 'BARTENDER']}>
              <KDSPage />
            </RequireRole>
          } />
          <Route path="/admin/*" element={
            <RequireRole roles={['OWNER', 'MANAGER']}>
              <AdminPage />
            </RequireRole>
          } />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ThemeProvider>
  );
}
