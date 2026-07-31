import React, { useState } from 'react';
import { Box, Card, CardContent, TextField, Button, Typography, Stack, Alert } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { platformApi } from '@/api/platform.api';
import { usePlatformAdminStore } from '@/store/platformAdminStore';
import { extractError } from '@/api/client';

export default function PlatformAdminLoginPage() {
  const navigate = useNavigate();
  const login = usePlatformAdminStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const loginMutation = useMutation({
    mutationFn: () => platformApi.login(email, password),
    onSuccess: ({ data }) => {
      login(data.token, data.admin.email);
      navigate('/platform/dashboard', { replace: true });
    },
    onError: (e) => setError(extractError(e)),
  });

  return (
    <Box sx={{
      minHeight: '100vh',
      bgcolor: '#05070d',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      p: 2,
      background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(29,95,174,0.22), transparent 65%), #05070d',
    }}>
      <Card sx={{ width: '100%', maxWidth: 460, bgcolor: '#111722', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={2.5}>
            <Box>
              <Typography variant="h5" fontWeight={800} color="#e6eef9">SonicPOS Platform Admin</Typography>
              <Typography variant="body2" color="#9fb4cc">Cross-company operations, management, and reporting.</Typography>
            </Box>

            {error && <Alert severity="error">{error}</Alert>}

            <TextField
              label="Admin Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loginMutation.mutate()}
              fullWidth
            />

            <Button
              variant="contained"
              onClick={() => { setError(''); loginMutation.mutate(); }}
              disabled={loginMutation.isPending || !email || !password}
              sx={{ py: 1.4, fontWeight: 700, bgcolor: '#1d5fae' }}
            >
              {loginMutation.isPending ? 'Signing In...' : 'Sign In'}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
