import React, { useState } from 'react';
import {
  Box, Grid, Paper, Avatar, Typography, Chip, Stack, Button, IconButton,
} from '@mui/material';
import { LockOutlined, Backspace } from '@mui/icons-material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { authApi } from '@/api/auth.api';
import { useAuthStore } from '@/store/authStore';
import { employeesApi } from '@/api/employees.api';
import { extractError } from '@/api/client';
import type { User } from '@/types';

const ROLE_COLORS: Record<string, string> = {
  OWNER: '#0078d4', MANAGER: '#c42b1c', SERVER: '#0078d4',
  CASHIER: '#ff9800', KITCHEN: '#4caf50', BARTENDER: '#00bcd4',
};

const NUMPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

export default function LockScreen() {
  const { login } = useAuthStore();
  const { enqueueSnackbar } = useSnackbar();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');

  const { data: employees = [] } = useQuery({
    queryKey: ['employee-profiles'],
    queryFn: () => employeesApi.getProfiles().then((r) => r.data),
  });

  const pinMutation = useMutation({
    mutationFn: ({ username, pin }: { username: string; pin: string }) =>
      authApi.loginPin(username, pin),
    onSuccess: ({ data }) => {
      login(data.user, data.token);
      enqueueSnackbar(`Welcome back, ${data.user.firstName}!`, { variant: 'success' });
    },
    onError: (err) => {
      setPinError(extractError(err));
      setPin('');
    },
  });

  const handlePinPress = (digit: string) => {
    if (digit === '⌫') { setPin((p) => p.slice(0, -1)); setPinError(''); return; }
    if (pin.length >= 4) return;
    const newPin = pin + digit;
    setPin(newPin);
    setPinError('');
    if (newPin.length === 4 && selectedUser) {
      pinMutation.mutate({ username: selectedUser.username, pin: newPin });
    }
  };

  return (
    <Box
      sx={{
        position: 'fixed', inset: 0, zIndex: 9999,
        bgcolor: '#141414',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        p: 2,
      }}
    >
      {/* Lock icon */}
      <Stack direction="row" alignItems="center" spacing={1.5} mb={4}>
        <Box sx={{ bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 2, p: 1.5, display: 'flex' }}>
          <LockOutlined sx={{ fontSize: 28, color: 'text.secondary' }} />
        </Box>
        <Box>
          <Typography variant="h6" fontWeight={700}>Switch User</Typography>
          <Typography variant="caption" color="text.secondary">Select your profile to continue</Typography>
        </Box>
      </Stack>

      <Box sx={{ maxWidth: 480, width: '100%' }}>
        {!selectedUser ? (
          /* Employee grid */
          <Grid container spacing={1.5}>
            {employees.map((emp) => (
              <Grid item xs={6} sm={4} key={emp.id}>
                <Paper
                  onClick={() => { setSelectedUser(emp); setPin(''); setPinError(''); }}
                  elevation={0}
                  sx={{
                    p: 2, cursor: 'pointer', textAlign: 'center',
                    bgcolor: '#1e1e1e', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 1,
                    '&:hover': { bgcolor: '#2a2a2a', borderColor: 'rgba(0,120,212,0.5)' },
                    transition: 'all 0.1s',
                  }}
                >
                  <Avatar sx={{ bgcolor: ROLE_COLORS[emp.role] ?? '#0078d4', mx: 'auto', mb: 1, width: 48, height: 48, fontSize: 18 }}>
                    {emp.firstName[0]}
                  </Avatar>
                  <Typography variant="body2" fontWeight={600}>{emp.firstName} {emp.lastName}</Typography>
                  <Chip label={emp.role} size="small" sx={{ mt: 0.5, fontSize: '0.62rem', height: 18 }} />
                </Paper>
              </Grid>
            ))}
          </Grid>
        ) : (
          /* PIN entry */
          <Box>
            <Stack direction="row" alignItems="center" spacing={2} mb={3}>
              <Avatar sx={{ bgcolor: ROLE_COLORS[selectedUser.role] ?? '#0078d4', width: 44, height: 44 }}>
                {selectedUser.firstName[0]}
              </Avatar>
              <Box flex={1}>
                <Typography variant="subtitle1" fontWeight={700}>{selectedUser.firstName} {selectedUser.lastName}</Typography>
                <Chip label={selectedUser.role} size="small" />
              </Box>
              <Button size="small" onClick={() => { setSelectedUser(null); setPin(''); setPinError(''); }}>
                Change
              </Button>
            </Stack>

            <Typography variant="body2" color="text.secondary" textAlign="center" mb={2}>
              Enter your 4-digit PIN
            </Typography>

            {/* PIN dots */}
            <Stack direction="row" justifyContent="center" spacing={2} mb={2}>
              {[0, 1, 2, 3].map((i) => (
                <Box key={i} sx={{
                  width: 14, height: 14, borderRadius: '50%',
                  border: '1px solid',
                  borderColor: pinError ? 'error.main' : i < pin.length ? 'primary.main' : 'divider',
                  bgcolor: pinError ? 'error.main' : i < pin.length ? 'primary.main' : 'transparent',
                  transition: 'all 0.1s',
                }} />
              ))}
            </Stack>

            {pinError && (
              <Typography variant="caption" color="error" textAlign="center" display="block" mb={1}>{pinError}</Typography>
            )}

            {/* Numpad */}
            <Grid container spacing={1}>
              {NUMPAD.map((key, i) => (
                <Grid item xs={4} key={i}>
                  {key === '' ? (
                    <Box />
                  ) : (
                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={() => handlePinPress(key)}
                      disabled={pinMutation.isPending}
                      sx={{
                        height: 56, fontSize: key === '⌫' ? '1.1rem' : '1.4rem',
                        fontWeight: 400, borderColor: 'rgba(255,255,255,0.1)',
                        color: key === '⌫' ? 'text.secondary' : 'text.primary',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.2)' },
                      }}
                    >
                      {key}
                    </Button>
                  )}
                </Grid>
              ))}
            </Grid>
          </Box>
        )}
      </Box>
    </Box>
  );
}
