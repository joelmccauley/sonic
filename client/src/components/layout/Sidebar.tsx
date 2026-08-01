import React, { useCallback, useRef } from 'react';
import { Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Typography, IconButton, Avatar, Divider, Tooltip } from '@mui/material';
import { TableRestaurant, ReceiptLong, Kitchen, BarChart, People, RestaurantMenu,
  Inventory2, LocalOffer, Settings, Logout, Menu as MenuIcon,
  ChevronLeft, Print, ManageAccounts, History, Login as LoginIcon, GridView, Payment, Timeline,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/api/auth.api';
import { useMutation, useQuery } from '@tanstack/react-query';
import { settingsApi } from '@/api/settings.api';
import { useSnackbar } from 'notistack';
import { extractError } from '@/api/client';

const DRAWER_WIDTH = 272;
const COLLAPSED_DRAWER_WIDTH = 82;

const navItems = [
  { label: 'Floor View', icon: <GridView />, path: '/floorview', roles: ['OWNER', 'MANAGER', 'SERVER', 'CASHIER', 'BARTENDER'] },
  { label: 'My Activity', icon: <Timeline />, path: '/my-activity', roles: ['OWNER', 'MANAGER', 'SERVER', 'CASHIER', 'KITCHEN', 'BARTENDER'] },
  { label: 'Order Builder', icon: <TableRestaurant />, path: '/order-builder', roles: ['OWNER', 'MANAGER'] },
  { label: 'Kitchen', icon: <Kitchen />, path: '/kds', roles: ['OWNER', 'MANAGER', 'KITCHEN', 'SERVER', 'BARTENDER'] },
  { label: 'Orders', icon: <ReceiptLong />, path: '/orders', roles: ['OWNER', 'MANAGER', 'CASHIER'] },
  { divider: true, label: 'Admin' },
  { label: 'Menu Builder', icon: <RestaurantMenu />, path: '/admin/menu', roles: ['OWNER', 'MANAGER'] },
  { label: 'Floor Plan', icon: <TableRestaurant />, path: '/admin/floorplan', roles: ['OWNER', 'MANAGER'] },
  { label: 'Employees', icon: <People />, path: '/admin/employees', roles: ['OWNER', 'MANAGER'] },
  { label: 'Tables', icon: <TableRestaurant />, path: '/admin/tables', roles: ['OWNER', 'MANAGER'] },
  { label: 'Inventory', icon: <Inventory2 />, path: '/admin/inventory', roles: ['OWNER', 'MANAGER'] },
  { label: 'Discounts', icon: <LocalOffer />, path: '/admin/discounts', roles: ['OWNER', 'MANAGER'] },
  { label: 'Customers', icon: <People />, path: '/admin/customers', roles: ['OWNER', 'MANAGER'] },
  { label: 'Reports', icon: <BarChart />, path: '/admin/reports', roles: ['OWNER', 'MANAGER'] },
  { label: 'Shifts', icon: <ManageAccounts />, path: '/admin/shifts', roles: ['OWNER', 'MANAGER'] },
  { label: 'Audit Log', icon: <History />, path: '/admin/audit', roles: ['OWNER', 'MANAGER'] },
  { label: 'Printers', icon: <Print />, path: '/admin/printers', roles: ['OWNER', 'MANAGER'] },
  { label: 'Settings', icon: <Settings />, path: '/admin/settings', roles: ['OWNER'] },
  { label: 'Billing', icon: <Payment />, path: '/admin/billing', roles: ['OWNER'] },
];

interface Props {
  open: boolean;
  onToggle: () => void;
}

export default function Sidebar({ open, onToggle }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, lockScreen } = useAuthStore();
  const organization = useAuthStore((s) => s.organization);
  const { enqueueSnackbar } = useSnackbar();
  const navScrollRef = useRef<HTMLUListElement | null>(null);
  const navTouchRef = useRef<{ pointerId: number; startY: number; startScrollTop: number; captured: boolean } | null>(null);

  const logoutMutation = useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      logout();
      navigate('/login');
    },
    onError: (err) => {
      enqueueSnackbar(`Could not log out: ${extractError(err)}`, { variant: 'error' });
    },
  });

  const switchUserMutation = useMutation({
    mutationFn: async () => { /* just lock, no clock-out */ },
    onSuccess: () => lockScreen(),
  });

  const hasAccess = (roles?: string[]) => !roles || roles.includes(user?.role ?? '');

  const { data: publicSettings } = useQuery({
    queryKey: ['settings-public', organization?.id],
    queryFn: () => settingsApi.getPublic().then((r) => r.data),
    enabled: !!user,
    staleTime: 0,
  });
  const logoSrc = publicSettings?.['logo_url'] || '/logo.png';

  const roleColor: Record<string, string> = {
    OWNER: '#0078d4', MANAGER: '#c42b1c', SERVER: '#0078d4',
    CASHIER: '#ff9800', KITCHEN: '#4caf50', BARTENDER: '#00bcd4',
  };

  const handleNavPointerDown = useCallback((e: React.PointerEvent<HTMLUListElement>) => {
    if (e.pointerType === 'mouse') return;
    navTouchRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      startScrollTop: navScrollRef.current?.scrollTop ?? 0,
      captured: false,
    };
  }, []);

  const handleNavPointerMove = useCallback((e: React.PointerEvent<HTMLUListElement>) => {
    const state = navTouchRef.current;
    if (!state || state.pointerId !== e.pointerId || !navScrollRef.current) return;
    const deltaY = e.clientY - state.startY;
    if (!state.captured) {
      if (Math.abs(deltaY) < 3) return;
      state.captured = true;
      try {
        e.currentTarget.setPointerCapture(state.pointerId);
      } catch {
        // Ignore capture failures; the scroll gesture still works.
      }
    }
    e.preventDefault();
    navScrollRef.current.scrollTop = state.startScrollTop - deltaY;
  }, []);

  const clearNavTouchState = useCallback((e: React.PointerEvent<HTMLUListElement>) => {
    const state = navTouchRef.current;
    if (!state || state.pointerId !== e.pointerId) return;
    try {
      if (e.currentTarget.hasPointerCapture(state.pointerId)) {
        e.currentTarget.releasePointerCapture(state.pointerId);
      }
    } catch {
      // Ignore release failures.
    }
    navTouchRef.current = null;
  }, []);

  return (
    <>
      <Drawer
        variant="permanent"
        open={open}
        sx={{
          width: open ? DRAWER_WIDTH : COLLAPSED_DRAWER_WIDTH,
        flexShrink: 0,
        transition: 'width 0.25s',
        '& .MuiDrawer-paper': {
          width: open ? DRAWER_WIDTH : COLLAPSED_DRAWER_WIDTH,
          height: '100vh',
          overflowY: 'hidden',
          transition: 'width 0.25s',
          bgcolor: 'rgba(18,18,18,0.88)',
          backdropFilter: 'blur(20px) saturate(160%)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          // Thin modern scrollbar
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.12) transparent',
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.12)', borderRadius: 2 },
          '&::-webkit-scrollbar-thumb:hover': { background: 'rgba(255,255,255,0.22)' },
        },
      }}
    >
      {/* Logo + collapse toggle */}
      <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: open ? 'space-between' : 'center', minHeight: 68, flexShrink: 0 }}>
        {open && (
          <img src={logoSrc} alt="SonicPOS" style={{ height: 52, objectFit: 'contain', maxWidth: 190 }} />
        )}
        <IconButton onClick={onToggle} sx={{ color: 'text.secondary' }}>
          {open ? <ChevronLeft /> : <MenuIcon />}
        </IconButton>
      </Box>

      <Divider />

      {/* User info + logout */}
      {user && (
        <Box sx={{ px: 1.5, py: 1.25, flexShrink: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: open ? 0.75 : 0, py: 1, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.04)', justifyContent: open ? 'flex-start' : 'center' }}>
            <Avatar sx={{ bgcolor: roleColor[user.role] ?? 'primary.main', width: 40, height: 40, flexShrink: 0, fontSize: '1rem' }}>
              {user.firstName[0]}
            </Avatar>
            {open && (
              <>
                <Box overflow="hidden" flex={1}>
                  <Typography variant="body2" fontWeight={600} noWrap sx={{ fontSize: '0.95rem', lineHeight: 1.35 }}>{user.firstName} {user.lastName}</Typography>
                  <Typography variant="caption" sx={{ color: roleColor[user.role] ?? 'primary.main', fontSize: '0.8rem', lineHeight: 1.1 }}>{user.role}</Typography>
                </Box>
                <Tooltip title="Logout" placement="right">
                  <IconButton onClick={() => logoutMutation.mutate()} sx={{ color: 'text.disabled', flexShrink: 0, '&:hover': { color: 'error.main' } }}>
                    <Logout sx={{ fontSize: 20 }} />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Box>
          {/* Switch User */}
          <Tooltip title="Switch User" placement="right" disableHoverListener={open}>
            <Box
              onClick={() => switchUserMutation.mutate()}
              sx={{
                mt: 0.75, px: open ? 1.25 : 0, py: 0.75, borderRadius: 1.25, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 1,
                justifyContent: open ? 'flex-start' : 'center',
                border: '1px solid rgba(255,255,255,0.07)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
              }}
            >
              <LoginIcon sx={{ fontSize: 19, color: 'text.disabled', flexShrink: 0 }} />
              {open && (
                <Typography variant="caption" color="text.disabled" fontWeight={600} sx={{ fontSize: '0.85rem' }}>
                  Switch User
                </Typography>
              )}
            </Box>
          </Tooltip>
          {!open && (
            <Tooltip title="Logout" placement="right">
              <IconButton onClick={() => logoutMutation.mutate()} sx={{ mt: 0.75, color: 'text.disabled', width: '100%', borderRadius: 1.25, '&:hover': { color: 'error.main', bgcolor: 'rgba(196,43,28,0.1)' } }}>
                <Logout sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )}

      <Divider />

      {/* Nav items — fills remaining space, no independent scroll */}
      <List
        ref={navScrollRef}
        sx={{
          px: 1.25,
          py: 1.25,
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'none',
          overscrollBehavior: 'contain',
        }}
        onPointerDown={handleNavPointerDown}
        onPointerMove={handleNavPointerMove}
        onPointerUp={clearNavTouchState}
        onPointerCancel={clearNavTouchState}
      >
        {navItems.map((item, idx) => {
          if ('divider' in item && item.divider) {
            // Only show section header if at least one following item is accessible
            const hasVisibleItems = navItems.slice(idx + 1).some((next) => {
              if ('divider' in next && next.divider) return false; // stop at next section
              const n = next as { roles?: string[] };
              return hasAccess(n.roles);
            });
            if (!hasVisibleItems) return null;
            return open ? (
              <Typography key={idx} variant="caption" color="text.disabled" sx={{ px: 1.5, pt: 2, pb: 0.75, display: 'block', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.72rem' }}>
                {item.label}
              </Typography>
            ) : <Divider key={idx} sx={{ my: 1 }} />;
          }

          const navItem = item as { label: string; icon: React.ReactNode; path: string; roles?: string[] };
          if (!hasAccess(navItem.roles)) return null;

          const active = location.pathname.startsWith(navItem.path);

          return (
            <Tooltip key={navItem.path} title={!open ? navItem.label : ''} placement="right">
              <ListItemButton
                onClick={() => navigate(navItem.path)}
                selected={active}
                sx={{
                  borderRadius: 1.25, mb: 0.5, minHeight: 46,
                  px: open ? 1.5 : 1,
                  justifyContent: open ? 'flex-start' : 'center',
                  '&.Mui-selected': { bgcolor: 'rgba(0,120,212,0.15)', '&:hover': { bgcolor: 'rgba(0,120,212,0.2)' } },
                }}
              >
                <ListItemIcon sx={{ color: active ? 'primary.main' : 'text.secondary', minWidth: open ? 42 : 'auto' }}>
                  {React.cloneElement(navItem.icon as React.ReactElement, { sx: { fontSize: 22 } })}
                </ListItemIcon>
                {open && <ListItemText primary={navItem.label} primaryTypographyProps={{ fontSize: '1rem', fontWeight: active ? 600 : 400 }} />}
              </ListItemButton>
            </Tooltip>
          );
        })}
      </List>
    </Drawer>
  </>
  );
}
