import React, { useState } from 'react';
import {
  Box, Card, CardContent, TextField, Button, Typography, Divider,
  Stack, Chip, Alert, CircularProgress, Grid, Avatar, Paper, InputAdornment,
  Tabs, Tab,
} from '@mui/material';
import { Lock, Storefront, ArrowBack, Visibility, VisibilityOff } from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { authApi } from '@/api/auth.api';
import { useAuthStore } from '@/store/authStore';
import { extractError } from '@/api/client';
import { useGoogleSignIn } from '@/hooks/useGoogleSignIn';

const ROLE_COLORS: Record<string, string> = {
  OWNER: '#1d5fae', MANAGER: '#c42b1c', SERVER: '#2196f3',
  CASHIER: '#ff9800', KITCHEN: '#4caf50', BARTENDER: '#00bcd4',
};

// ─────────────────────────────────────────────────────────────────────────────
// Staff PIN login — step 1: enter store code, step 2: pick staff, step 3: PIN
// ─────────────────────────────────────────────────────────────────────────────
function StaffLoginPanel() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const { enqueueSnackbar } = useSnackbar();

  const [storeCode, setStoreCode] = useState('');
  const [confirmedSlug, setConfirmedSlug] = useState('');
  const [selectedUser, setSelectedUser] = useState<{ username: string; firstName: string; lastName: string; role: string } | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');

  const { data: storeInfo, isFetching, error: storeError } = useQuery({
    queryKey: ['store-info', confirmedSlug],
    queryFn: () => authApi.getStoreInfo(confirmedSlug).then((r) => r.data),
    enabled: Boolean(confirmedSlug),
    retry: false,
  });

  const pinMutation = useMutation({
    mutationFn: ({ username, pin }: { username: string; pin: string }) =>
      authApi.loginPin(username, pin, confirmedSlug),
    onSuccess: ({ data }) => {
      login(data.user, data.token, data.organization);
      enqueueSnackbar(`Welcome, ${data.user.firstName}!`, { variant: 'success' });
      navigate('/floorview');
    },
    onError: (err) => { setPinError(extractError(err)); setPin(''); },
  });

  const handlePinPress = (digit: string) => {
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    setPinError('');
    if (next.length === 4 && selectedUser) pinMutation.mutate({ username: selectedUser.username, pin: next });
  };

  // Step 1: store code entry
  if (!confirmedSlug) {
    return (
      <Stack spacing={2.5}>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          Enter your restaurant's store code to log in as staff.
        </Typography>
        <TextField
          label="Store Code"
          value={storeCode}
          onChange={(e) => setStoreCode(e.target.value.toLowerCase().trim())}
          fullWidth autoFocus
          placeholder="e.g. cozumel"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Storefront sx={{ color: 'text.disabled', fontSize: 20 }} />
              </InputAdornment>
            ),
          }}
          onKeyDown={(e) => e.key === 'Enter' && storeCode && setConfirmedSlug(storeCode)}
        />
        <Button variant="contained" size="large" fullWidth
          disabled={!storeCode} onClick={() => setConfirmedSlug(storeCode)}>
          Find My Store
        </Button>
      </Stack>
    );
  }

  if (isFetching) {
    return (
      <Box textAlign="center" py={4}>
        <CircularProgress size={36} />
        <Typography variant="body2" color="text.secondary" mt={2}>Looking up store…</Typography>
      </Box>
    );
  }

  if (storeError || !storeInfo) {
    return (
      <Stack spacing={2}>
        <Alert severity="error">
          Store code "<strong>{confirmedSlug}</strong>" not found. Check the code and try again.
        </Alert>
        <Button startIcon={<ArrowBack />} onClick={() => { setConfirmedSlug(''); setStoreCode(''); }}>
          Try Again
        </Button>
      </Stack>
    );
  }

  // Step 2: pick a staff member
  if (!selectedUser) {
    return (
      <>
        <Stack direction="row" alignItems="center" spacing={1.5} mb={2.5}>
          {storeInfo.logoUrl && (
            <Box component="img" src={storeInfo.logoUrl} alt={storeInfo.name}
              sx={{ height: 36, objectFit: 'contain', borderRadius: 1 }} />
          )}
          <Box flex={1}>
            <Typography variant="h6" fontWeight={700} noWrap>{storeInfo.name}</Typography>
            <Typography variant="caption" color="text.secondary">Select your profile</Typography>
          </Box>
          <Button size="small" startIcon={<ArrowBack sx={{ fontSize: '0.85rem !important' }} />}
            onClick={() => { setConfirmedSlug(''); setStoreCode(''); }} sx={{ color: 'text.secondary' }}>
            Change
          </Button>
        </Stack>
        <Grid container spacing={1.5}>
          {storeInfo.staff.map((u) => (
            <Grid item xs={6} key={u.username}>
              <Paper
                onClick={() => { setSelectedUser(u); setPin(''); setPinError(''); }}
                sx={{
                  p: 1.75, cursor: 'pointer', textAlign: 'center',
                  bgcolor: '#1e1e1e', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 1, transition: 'border-color 0.15s',
                  '&:hover': { bgcolor: '#252525', borderColor: 'rgba(63,143,223,0.5)' },
                }}
              >
                <Avatar sx={{ bgcolor: ROLE_COLORS[u.role] ?? '#555', mx: 'auto', mb: 1, width: 46, height: 46, fontSize: 18 }}>
                  {u.firstName[0]}
                </Avatar>
                <Typography fontWeight={600} variant="body2" noWrap>
                  {u.firstName} {u.lastName[0]}.
                </Typography>
                <Chip label={u.role} size="small"
                  sx={{ mt: 0.5, fontSize: '0.6rem', height: 18,
                    bgcolor: `${ROLE_COLORS[u.role] ?? '#555'}22`,
                    color: ROLE_COLORS[u.role] ?? '#aaa' }} />
              </Paper>
            </Grid>
          ))}
        </Grid>
      </>
    );
  }

  // Step 3: PIN pad
  return (
    <>
      <Stack direction="row" alignItems="center" spacing={2} mb={2.5}>
        <Avatar sx={{ bgcolor: ROLE_COLORS[selectedUser.role] ?? '#555', width: 44, height: 44 }}>
          {selectedUser.firstName[0]}
        </Avatar>
        <Box flex={1}>
          <Typography variant="subtitle1" fontWeight={700}>
            {selectedUser.firstName} {selectedUser.lastName}
          </Typography>
          <Chip label={selectedUser.role} size="small"
            sx={{ fontSize: '0.65rem', height: 18,
              bgcolor: `${ROLE_COLORS[selectedUser.role] ?? '#555'}22`,
              color: ROLE_COLORS[selectedUser.role] }} />
        </Box>
        <Button size="small" sx={{ color: 'text.secondary' }}
          onClick={() => { setSelectedUser(null); setPin(''); setPinError(''); }}>
          Change
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" textAlign="center" mb={2}>
        Enter your 4-digit PIN
      </Typography>
      <Stack direction="row" justifyContent="center" spacing={2} mb={2.5}>
        {[0, 1, 2, 3].map((i) => (
          <Box key={i} sx={{
            width: 12, height: 12, borderRadius: '50%', border: '1px solid',
            borderColor: i < pin.length ? 'primary.main' : 'divider',
            bgcolor: i < pin.length ? 'primary.main' : 'transparent',
          }} />
        ))}
      </Stack>
      {pinError && <Alert severity="error" sx={{ mb: 2 }}>{pinError}</Alert>}
      <Grid container spacing={1.25} justifyContent="center">
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, idx) => (
          <Grid item xs={4} key={idx}>
            {k === '' ? <Box /> : (
              <Button fullWidth variant="outlined" size="large"
                onClick={() => k === '⌫' ? setPin((p) => p.slice(0, -1)) : handlePinPress(k)}
                disabled={pinMutation.isPending}
                sx={{ height: 52, fontSize: '1.2rem', borderColor: 'rgba(255,255,255,0.12)', bgcolor: '#1e1e1e', '&:hover': { bgcolor: '#2a2a2a' } }}>
                {k}
              </Button>
            )}
          </Grid>
        ))}
      </Grid>
      <Button fullWidth variant="text" sx={{ mt: 1.5, color: 'text.secondary' }} onClick={() => setPin('')}>
        Clear
      </Button>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Owner / web login — email+password + Google
// ─────────────────────────────────────────────────────────────────────────────
function OwnerLoginPanel() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const { enqueueSnackbar } = useSnackbar();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  const passwordMutation = useMutation({
    mutationFn: () => authApi.login(username.trim(), password),
    onSuccess: ({ data }) => {
      login(data.user, data.token, data.organization);
      enqueueSnackbar(`Welcome, ${data.user.firstName}!`, { variant: 'success' });
      navigate('/floorview');
    },
    onError: (err) => enqueueSnackbar(extractError(err), { variant: 'error' }),
  });

  const googleMutation = useMutation({
    mutationFn: (credential: string) => authApi.googleAuth(credential),
    onSuccess: ({ data }) => {
      login(data.user, data.token, data.organization);
      enqueueSnackbar(`Welcome, ${data.user.firstName}!`, { variant: 'success' });
      navigate('/floorview');
    },
    onError: (err: any) => {
      if (err?.response?.data?.code === 'GOOGLE_SIGNUP_REQUIRED') navigate('/signup');
      else enqueueSnackbar(extractError(err), { variant: 'error' });
    },
  });

  const { buttonRef, googleEnabled } = useGoogleSignIn(
    (credential) => googleMutation.mutate(credential),
    true,
  );

  return (
    <Stack spacing={2.5}>
      {googleEnabled && (
        <>
          <Box ref={buttonRef} sx={{ display: 'flex', justifyContent: 'center' }} />
          <Divider><Typography variant="caption" color="text.disabled">or sign in with username</Typography></Divider>
        </>
      )}
      <TextField label="Username or Email" value={username}
        onChange={(e) => setUsername(e.target.value)} fullWidth autoFocus={!googleEnabled}
        onKeyDown={(e) => e.key === 'Enter' && password && passwordMutation.mutate()} />
      <TextField label="Password" type={showPw ? 'text' : 'password'}
        value={password} onChange={(e) => setPassword(e.target.value)} fullWidth
        onKeyDown={(e) => e.key === 'Enter' && username && passwordMutation.mutate()}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <Button onClick={() => setShowPw((v) => !v)} size="small" sx={{ minWidth: 0, color: 'text.disabled' }}>
                {showPw ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
              </Button>
            </InputAdornment>
          ),
        }} />
      <Button variant="contained" size="large" fullWidth
        onClick={() => passwordMutation.mutate()}
        disabled={passwordMutation.isPending || googleMutation.isPending || !username || !password}>
        {passwordMutation.isPending ? <CircularProgress size={22} /> : 'Sign In'}
      </Button>
      <Divider />
      <Button variant="text" size="small" sx={{ color: 'text.disabled' }} onClick={() => navigate('/')}>
        ← Back to SonicPOS.com
      </Button>
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root login page — tabs: Owner | Staff
// ─────────────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<0 | 1>(searchParams.get('mode') === 'staff' ? 1 : 0);

  return (
    <Box sx={{
      minHeight: '100vh', bgcolor: 'background.default',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 2,
      background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(29,95,174,0.18), transparent 65%), #0d0d0d',
    }}>
      <Box mb={3} sx={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
        <img src="/logo.png" alt="SonicPOS" style={{ height: 52, objectFit: 'contain', display: 'block' }} />
      </Box>

      <Card sx={{
        maxWidth: 480, width: '100%',
        bgcolor: '#181c22', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 3, boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
      }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth"
          sx={{
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            '& .MuiTab-root': { py: 1.75, fontWeight: 600, fontSize: '0.875rem', color: 'text.secondary' },
            '& .Mui-selected': { color: '#3f8fdf !important' },
            '& .MuiTabs-indicator': { backgroundColor: '#3f8fdf', height: 2 },
          }}>
          <Tab label="Owner / Manager" icon={<Lock sx={{ fontSize: 16 }} />} iconPosition="start" />
          <Tab label="Staff PIN Login" icon={<Storefront sx={{ fontSize: 16 }} />} iconPosition="start" />
        </Tabs>

        <CardContent sx={{ p: 3.5 }}>
          {tab === 0 ? <OwnerLoginPanel /> : <StaffLoginPanel />}
        </CardContent>
      </Card>

      <Typography variant="caption" color="text.disabled" mt={3}>
        New restaurant?{' '}
        <Box component="span"
          sx={{ color: '#3f8fdf', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
          onClick={() => navigate('/signup')}>
          Start your free trial
        </Box>
      </Typography>
    </Box>
  );
}
