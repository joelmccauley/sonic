import React, { useEffect, useState } from 'react';
import { Box, Dialog, DialogActions, DialogContent, DialogTitle, Button, Stack, Typography, CircularProgress } from '@mui/material';
import { Outlet, Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import Sidebar from './Sidebar';
import LockScreen from './LockScreen';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { WebSocketProvider } from '@/contexts/WebSocketContext';
import { shiftsApi } from '@/api/shifts.api';
import { extractError } from '@/api/client';
import { Schedule } from '@mui/icons-material';

export default function MainLayout() {
  const { isAuthenticated, isLocked, user } = useAuthStore();
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [clockInDismissedForUser, setClockInDismissedForUser] = useState<number | null>(null);

  const { data: activeShift, isLoading: activeShiftLoading, refetch: refetchActiveShift } = useQuery({
    queryKey: ['active-shift'],
    queryFn: () => shiftsApi.getActive().then((r) => r.data),
    enabled: isAuthenticated && !isLocked,
    retry: false,
    staleTime: 0,
  });

  useEffect(() => {
    setClockInDismissedForUser(null);
  }, [user?.id]);

  const clockInMutation = useMutation({
    mutationFn: () => shiftsApi.clockIn().then((r) => r.data),
    onSuccess: async () => {
      enqueueSnackbar('Shift started', { variant: 'success' });
      setClockInDismissedForUser(user?.id ?? null);
      await refetchActiveShift();
      await queryClient.invalidateQueries({ queryKey: ['my-activity'] });
    },
    onError: (err) => enqueueSnackbar(extractError(err), { variant: 'error' }),
  });

  const showClockInPrompt = !!user && !isLocked && !activeShiftLoading && !activeShift && clockInDismissedForUser !== user.id;

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

      <Dialog open={showClockInPrompt} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: 'rgba(0,120,212,0.16)', color: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Schedule />
            </Box>
            <Typography variant="h6" fontWeight={800}>Clock in to start your shift?</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            You’re signed in, but this session does not have an active shift yet. Start your shift now so your time, activity, and logout status stay accurate.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0, gap: 1 }}>
          <Button onClick={() => setClockInDismissedForUser(user?.id ?? null)} disabled={clockInMutation.isPending}>
            Not now
          </Button>
          <Button variant="contained" onClick={() => clockInMutation.mutate()} disabled={clockInMutation.isPending} startIcon={clockInMutation.isPending ? <CircularProgress size={16} /> : undefined}>
            Start Shift
          </Button>
        </DialogActions>
      </Dialog>
    </WebSocketProvider>
  );
}
