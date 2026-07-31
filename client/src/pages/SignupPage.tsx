import React, { useState } from 'react';
import {
  Box, Button, Container, Typography, Stack, Grid, Card, CardContent,
  TextField, Chip, Divider, List, ListItem, ListItemIcon, ListItemText,
  CircularProgress, Alert, InputAdornment, IconButton, AppBar, Toolbar,
} from '@mui/material';
import {
  CheckCircle, Close, ArrowForward, ArrowBack, Visibility, VisibilityOff,
  TableRestaurant, People, Bolt, Storefront,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { authApi } from '@/api/auth.api';
import { useAuthStore } from '@/store/authStore';
import { useGoogleSignIn } from '@/hooks/useGoogleSignIn';
import { extractError } from '@/api/client';
import type { PlanTier } from '@/types';

// ── Design tokens (SONIC chrome logo) ────────────────────────────────────────
const BG = '#05070d';
const BG_ELEVATED = '#0a0f1a';
const CHROME_BLUE = '#1d5fae';
const CHROME_LIGHT = '#3f8fdf';
const EDGE = 'rgba(120,170,230,0.14)';

const chromeText = {
  fontWeight: 800,
  fontStyle: 'italic' as const,
  letterSpacing: '-0.02em',
  background: `linear-gradient(180deg, #6fb3f0 0%, #2a72c0 42%, #123a6e 50%, #2f7cc9 58%, #0e2c55 100%)`,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
};

const inputSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: BG_ELEVATED,
    color: '#e8eef7',
    '& fieldset': { borderColor: EDGE },
    '&:hover fieldset': { borderColor: 'rgba(63,143,223,0.4)' },
    '&.Mui-focused fieldset': { borderColor: CHROME_LIGHT },
  },
  '& .MuiInputLabel-root': { color: '#6d8199' },
  '& .MuiInputLabel-root.Mui-focused': { color: CHROME_LIGHT },
  '& .MuiFormHelperText-root': { color: '#4a5a70' },
  '& input': { color: '#e8eef7' },
};

// ── Plan definitions (mirrors server config/plans.ts) ─────────────────────────
const PLANS = [
  {
    tier: 'STARTER' as PlanTier,
    name: 'Starter',
    price: 29,
    tagline: 'Everything you need to start selling',
    maxEmployees: 5,
    maxTables: 15,
    features: [
      'Point of Sale & Floor View',
      'Menu Builder & Modifiers',
      'Sales Reports',
    ],
    missing: [
      'Kitchen Display System',
      'Inventory Tracking',
      'Discounts & Loyalty',
      'Advanced Reports',
      'Audit Log',
    ],
    popular: false,
  },
  {
    tier: 'PROFESSIONAL' as PlanTier,
    name: 'Professional',
    price: 59,
    tagline: 'For growing restaurants that need the full toolkit',
    maxEmployees: 15,
    maxTables: null as number | null,
    features: [
      'Everything in Starter',
      'Kitchen Display System',
      'Inventory Tracking',
      'Discounts & Comps',
      'Customer Loyalty',
      'Multiple Printer Stations',
    ],
    missing: [
      'Advanced Reports & Exports',
      'Audit Log & Compliance',
    ],
    popular: true,
  },
  {
    tier: 'ENTERPRISE' as PlanTier,
    name: 'Enterprise',
    price: 99,
    tagline: 'Maximum power, insight, and support',
    maxEmployees: null as number | null,
    maxTables: null as number | null,
    features: [
      'Everything in Professional',
      'Advanced Reports & Exports',
      'Audit Log & Compliance',
      'Priority Support',
      'Unlimited Employees & Tables',
    ],
    missing: [],
    popular: false,
  },
];

// ── Step indicator component ───────────────────────────────────────────────────
function StepIndicator({ current }: { current: number }) {
  const steps = [{ n: 1, label: 'Choose Plan' }, { n: 2, label: 'Create Account' }];
  return (
    <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center" mb={6}>
      {steps.map(({ n, label }, idx) => (
        <React.Fragment key={n}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{
              width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: '0.75rem', transition: 'all 0.2s',
              bgcolor: n < current ? '#57a300' : n === current ? CHROME_BLUE : 'rgba(255,255,255,0.07)',
              color: '#fff',
              border: n === current ? `2px solid ${CHROME_LIGHT}` : '2px solid transparent',
              boxShadow: n === current ? `0 0 0 3px rgba(63,143,223,0.2)` : 'none',
            }}>
              {n < current ? <CheckCircle sx={{ fontSize: 14 }} /> : n}
            </Box>
            <Typography variant="body2" sx={{
              color: n === current ? '#e8eef7' : n < current ? '#9fb4cc' : '#4a5a70',
              fontWeight: n === current ? 700 : 400, fontSize: '0.8125rem',
            }}>
              {label}
            </Typography>
          </Stack>
          {idx < steps.length - 1 && (
            <Box sx={{ width: 40, height: 1, bgcolor: n < current ? '#57a300' : EDGE, transition: 'background 0.3s' }} />
          )}
        </React.Fragment>
      ))}
    </Stack>
  );
}

// ── Shared Nav bar ─────────────────────────────────────────────────────────────
function SignupNav() {
  const navigate = useNavigate();
  return (
    <AppBar position="sticky" elevation={0} sx={{
      bgcolor: 'rgba(5,7,13,0.82)', backdropFilter: 'blur(18px)',
      borderBottom: `1px solid ${EDGE}`,
    }}>
      <Toolbar sx={{ maxWidth: 1200, width: '100%', mx: 'auto' }}>
        <Stack
          direction="row" alignItems="baseline" spacing={0.75}
          sx={{ flexGrow: 1, cursor: 'pointer' }}
          onClick={() => navigate('/')}
        >
          <img src="/logo.png" alt="SONIC" style={{ height: 30, objectFit: 'contain' }} />
          <Typography sx={{ ...chromeText, fontSize: 22 }}>POS</Typography>
        </Stack>
        <Button color="inherit" sx={{ color: '#9fb4cc' }} onClick={() => navigate('/login')}>
          Sign in
        </Button>
      </Toolbar>
    </AppBar>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function SignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login: authLogin } = useAuthStore();
  const { enqueueSnackbar } = useSnackbar();

  const preselected = searchParams.get('plan') as PlanTier | null;
  const validPreselect = PLANS.find((p) => p.tier === preselected);

  const [step, setStep] = useState<1 | 2 | 3>(validPreselect ? 2 : 1);
  const [selectedPlan, setSelectedPlan] = useState<PlanTier>(
    validPreselect ? preselected! : 'PROFESSIONAL'
  );

  // Form state
  const [restaurantName, setRestaurantName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');

  // Google OAuth state
  const [googleCredential, setGoogleCredential] = useState<string | null>(null);
  const [googleProfile, setGoogleProfile] = useState<{
    name: string; email: string; picture?: string;
  } | null>(null);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const signupMutation = useMutation({
    mutationFn: () =>
      authApi.signup({
        restaurantName: restaurantName.trim(),
        email: email.trim().toLowerCase(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        planTier: selectedPlan,
      }),
    onSuccess: ({ data }) => {
      authLogin(data.user, data.token, data.organization);
      setStep(3);
    },
    onError: (err) => setFormError(extractError(err)),
  });

  const googleCompleteMutation = useMutation({
    mutationFn: (credential: string) =>
      authApi.googleAuth(credential, {
        restaurantName: restaurantName.trim(),
        planTier: selectedPlan,
      }),
    onSuccess: ({ data }) => {
      authLogin(data.user, data.token, data.organization);
      setStep(3);
    },
    onError: (err) => setFormError(extractError(err)),
  });

  // ── Google credential handler ──────────────────────────────────────────────
  const handleGoogleCredential = async (credential: string) => {
    setFormError('');
    try {
      // Try logging in first (existing user)
      const { data } = await authApi.googleAuth(credential);
      authLogin(data.user, data.token, data.organization);
      enqueueSnackbar(`Welcome back, ${data.user.firstName}!`, { variant: 'success' });
      navigate('/floorview');
    } catch (err: any) {
      const code = err?.response?.data?.code;
      if (code === 'GOOGLE_SIGNUP_REQUIRED') {
        // New Google user — decode profile from JWT payload
        try {
          const raw = credential.split('.')[1] ?? '';
          const padded = raw.replace(/-/g, '+').replace(/_/g, '/');
          const payload = JSON.parse(atob(padded));
          setGoogleProfile({
            name: payload.name ?? '',
            email: payload.email ?? '',
            picture: payload.picture,
          });
          setEmail(payload.email ?? '');
          setFirstName(payload.given_name ?? '');
          setLastName(payload.family_name ?? '');
        } catch { /* ignore decode errors */ }
        setGoogleCredential(credential);
        // Stay on step 2 (they still need to enter restaurant name)
      } else {
        setFormError(extractError(err));
      }
    }
  };

  const { buttonRef, googleEnabled } = useGoogleSignIn(handleGoogleCredential, step === 2);

  // ── Validation & submit ───────────────────────────────────────────────────
  const handleEmailSignup = () => {
    setFormError('');
    if (!restaurantName.trim()) { setFormError('Restaurant name is required'); return; }
    if (!firstName.trim()) { setFormError('First name is required'); return; }
    if (!lastName.trim()) { setFormError('Last name is required'); return; }
    if (!email.trim()) { setFormError('Email is required'); return; }
    if (password.length < 8) { setFormError('Password must be at least 8 characters'); return; }
    signupMutation.mutate();
  };

  const handleGoogleComplete = () => {
    if (!googleCredential) return;
    setFormError('');
    if (!restaurantName.trim()) { setFormError('Restaurant name is required'); return; }
    googleCompleteMutation.mutate(googleCredential);
  };

  const isPending = signupMutation.isPending || googleCompleteMutation.isPending;

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 1 — Choose Plan
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: BG, color: '#e8eef7', overflowX: 'hidden' }}>
        <SignupNav />
        <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
          <StepIndicator current={1} />

          <Typography variant="h3" textAlign="center" sx={{
            fontWeight: 800, letterSpacing: '-0.02em', mb: 1,
            fontSize: { xs: '1.8rem', md: '2.4rem' },
          }}>
            Choose your plan
          </Typography>
          <Typography textAlign="center" sx={{ color: '#9fb4cc', mb: 8, fontSize: '1.05rem' }}>
            14-day free trial · No credit card required · Cancel anytime
          </Typography>

          <Grid container spacing={3} alignItems="stretch" justifyContent="center">
            {PLANS.map((plan) => {
              const selected = selectedPlan === plan.tier;
              return (
                <Grid item xs={12} md={4} key={plan.tier}>
                  <Card
                    onClick={() => setSelectedPlan(plan.tier)}
                    sx={{
                      height: '100%', display: 'flex', flexDirection: 'column',
                      borderRadius: 4, position: 'relative', cursor: 'pointer',
                      bgcolor: BG_ELEVATED,
                      border: selected
                        ? `2px solid ${CHROME_LIGHT}`
                        : plan.popular
                        ? `1px solid rgba(63,143,223,0.35)`
                        : `1px solid ${EDGE}`,
                      boxShadow: selected
                        ? `0 0 0 4px rgba(63,143,223,0.15), 0 12px 48px rgba(40,110,190,0.25)`
                        : 'none',
                      transform: plan.popular && !selected ? { md: 'scale(1.03)' } : 'none',
                      transition: 'all 0.18s ease',
                      '&:hover': {
                        borderColor: CHROME_LIGHT,
                        transform: plan.popular ? { md: 'scale(1.04)' } : 'translateY(-2px)',
                      },
                    }}
                  >
                    {plan.popular && (
                      <Chip
                        label="MOST POPULAR"
                        size="small"
                        sx={{
                          position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                          background: `linear-gradient(180deg, ${CHROME_LIGHT}, ${CHROME_BLUE})`,
                          color: '#fff', fontWeight: 700, letterSpacing: '0.06em', fontSize: '0.7rem',
                        }}
                      />
                    )}
                    <CardContent sx={{ p: 4, display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: selected ? CHROME_LIGHT : '#e8eef7', mb: 0.5 }}>
                        {plan.name}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#9fb4cc', mb: 3, minHeight: 40, lineHeight: 1.6 }}>
                        {plan.tagline}
                      </Typography>
                      <Stack direction="row" alignItems="baseline" spacing={0.75} mb={3}>
                        <Typography sx={{ fontSize: '2.8rem', fontWeight: 800, letterSpacing: '-0.04em' }}>
                          ${plan.price}
                        </Typography>
                        <Typography sx={{ color: '#9fb4cc', fontSize: '0.95rem' }}>/month</Typography>
                      </Stack>

                      <Button
                        fullWidth
                        size="large"
                        variant={selected ? 'contained' : 'outlined'}
                        onClick={(e) => { e.stopPropagation(); setSelectedPlan(plan.tier); setStep(2); }}
                        sx={selected ? {
                          background: `linear-gradient(180deg, ${CHROME_LIGHT}, ${CHROME_BLUE})`,
                          fontWeight: 700, borderRadius: 2, py: 1.25,
                          boxShadow: '0 4px 20px rgba(40,110,190,0.4)',
                        } : {
                          borderColor: EDGE, color: '#cfe0f2', fontWeight: 600, borderRadius: 2, py: 1.25,
                          '&:hover': { borderColor: CHROME_LIGHT, bgcolor: 'rgba(63,143,223,0.06)' },
                        }}
                      >
                        {selected ? 'Selected — Continue →' : `Choose ${plan.name}`}
                      </Button>

                      <Divider sx={{ my: 3, borderColor: EDGE }} />

                      <List dense disablePadding>
                        <ListItem disableGutters sx={{ py: 0.4 }}>
                          <ListItemIcon sx={{ minWidth: 28 }}>
                            <People sx={{ fontSize: 15, color: CHROME_LIGHT }} />
                          </ListItemIcon>
                          <ListItemText
                            primaryTypographyProps={{ fontSize: '0.8125rem', color: '#cfe0f2' }}
                            primary={plan.maxEmployees ? `Up to ${plan.maxEmployees} employees` : 'Unlimited employees'}
                          />
                        </ListItem>
                        <ListItem disableGutters sx={{ py: 0.4 }}>
                          <ListItemIcon sx={{ minWidth: 28 }}>
                            <TableRestaurant sx={{ fontSize: 15, color: CHROME_LIGHT }} />
                          </ListItemIcon>
                          <ListItemText
                            primaryTypographyProps={{ fontSize: '0.8125rem', color: '#cfe0f2' }}
                            primary={plan.maxTables ? `Up to ${plan.maxTables} tables` : 'Unlimited tables'}
                          />
                        </ListItem>
                        {plan.features.map((f) => (
                          <ListItem disableGutters key={f} sx={{ py: 0.4 }}>
                            <ListItemIcon sx={{ minWidth: 28 }}>
                              <CheckCircle sx={{ fontSize: 15, color: '#57a300' }} />
                            </ListItemIcon>
                            <ListItemText primaryTypographyProps={{ fontSize: '0.8125rem', color: '#cfe0f2' }} primary={f} />
                          </ListItem>
                        ))}
                        {plan.missing.map((f) => (
                          <ListItem disableGutters key={f} sx={{ py: 0.4, opacity: 0.38 }}>
                            <ListItemIcon sx={{ minWidth: 28 }}>
                              <Close sx={{ fontSize: 15, color: '#5a6a80' }} />
                            </ListItemIcon>
                            <ListItemText primaryTypographyProps={{ fontSize: '0.8125rem', color: '#9fb4cc' }} primary={f} />
                          </ListItem>
                        ))}
                      </List>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>

          {/* Continue button */}
          <Stack direction="column" alignItems="center" spacing={2} sx={{ mt: 7 }}>
            <Button
              variant="contained"
              size="large"
              endIcon={<ArrowForward />}
              onClick={() => setStep(2)}
              sx={{
                px: 6, py: 1.5, fontWeight: 700, borderRadius: 2, fontSize: '1.05rem',
                background: `linear-gradient(180deg, ${CHROME_LIGHT} 0%, ${CHROME_BLUE} 55%, #14477f 100%)`,
                boxShadow: '0 8px 32px rgba(40,110,190,0.4)',
                '&:hover': { background: `linear-gradient(180deg, #55a0e8, ${CHROME_BLUE})` },
              }}
            >
              Continue with {PLANS.find((p) => p.tier === selectedPlan)?.name} — $
              {PLANS.find((p) => p.tier === selectedPlan)?.price}/mo
            </Button>
            <Typography variant="body2" sx={{ color: '#6d8199' }}>
              Already have an account?{' '}
              <Box
                component="span"
                sx={{ color: CHROME_LIGHT, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                onClick={() => navigate('/login')}
              >
                Sign in
              </Box>
            </Typography>
          </Stack>
        </Container>
      </Box>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 3 — Success
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 3) {
    const plan = PLANS.find((p) => p.tier === selectedPlan)!;
    return (
      <Box sx={{
        minHeight: '100vh', bgcolor: BG, color: '#e8eef7',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `radial-gradient(ellipse 70% 50% at 50% 30%, rgba(35,100,180,0.2), transparent 65%), ${BG}`,
      }}>
        <Container maxWidth="sm" sx={{ textAlign: 'center', py: 8 }}>
          <Box sx={{ mb: 4 }}>
            <img
              src="/logo.png"
              alt="SONIC"
              style={{ height: 72, objectFit: 'contain', filter: 'drop-shadow(0 6px 30px rgba(40,110,190,0.5))' }}
            />
          </Box>
          <Box sx={{
            width: 80, height: 80, borderRadius: '50%',
            bgcolor: 'rgba(87,163,0,0.12)', border: '2px solid rgba(87,163,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            mx: 'auto', mb: 4,
            boxShadow: '0 0 32px rgba(87,163,0,0.2)',
          }}>
            <CheckCircle sx={{ fontSize: 44, color: '#57a300' }} />
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em', mb: 2 }}>
            Your POS is live!
          </Typography>
          <Typography sx={{ color: '#9fb4cc', mb: 1, fontSize: '1.05rem', lineHeight: 1.7 }}>
            You're on the{' '}
            <Box component="span" sx={{ color: CHROME_LIGHT, fontWeight: 700 }}>{plan.name}</Box>{' '}
            plan with a 14-day free trial.
          </Typography>
          <Typography sx={{ color: '#6d8199', mb: 5, fontSize: '0.9rem' }}>
            No credit card required until your trial ends.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <Button
              variant="contained"
              size="large"
              endIcon={<Bolt />}
              onClick={() => navigate('/floorview')}
              sx={{
                px: 5, py: 1.5, fontWeight: 700, borderRadius: 2,
                background: `linear-gradient(180deg, ${CHROME_LIGHT}, ${CHROME_BLUE})`,
                boxShadow: '0 8px 32px rgba(40,110,190,0.4)',
              }}
            >
              Open My POS
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate('/admin/settings')}
              sx={{
                px: 5, py: 1.5, fontWeight: 600, borderRadius: 2,
                borderColor: EDGE, color: '#cfe0f2',
                '&:hover': { borderColor: CHROME_LIGHT, bgcolor: 'rgba(63,143,223,0.06)' },
              }}
            >
              Settings
            </Button>
          </Stack>
          <Stack direction="row" spacing={3} justifyContent="center" sx={{ mt: 5, color: '#4a5a70' }}>
            {['14-day free trial', 'No card required', 'Cancel anytime'].map((t) => (
              <Stack key={t} direction="row" spacing={0.75} alignItems="center">
                <CheckCircle sx={{ fontSize: 13, color: '#57a300' }} />
                <Typography variant="caption">{t}</Typography>
              </Stack>
            ))}
          </Stack>
        </Container>
      </Box>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 2 — Create Account
  // ─────────────────────────────────────────────────────────────────────────
  const selectedPlanData = PLANS.find((p) => p.tier === selectedPlan)!;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: BG, color: '#e8eef7' }}>
      <SignupNav />
      <Container maxWidth="sm" sx={{ py: { xs: 5, md: 8 } }}>
        <StepIndicator current={2} />

        {/* Selected plan banner */}
        <Card sx={{ mb: 4, bgcolor: BG_ELEVATED, border: `1px solid ${EDGE}`, borderRadius: 3 }}>
          <CardContent sx={{ py: '10px !important', px: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{
              width: 36, height: 36, borderRadius: 2, flexShrink: 0,
              bgcolor: 'rgba(63,143,223,0.12)', border: `1px solid ${EDGE}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Bolt sx={{ color: CHROME_LIGHT, fontSize: 18 }} />
            </Box>
            <Box sx={{ flex: 1, overflow: 'hidden' }}>
              <Typography variant="body2" fontWeight={700} noWrap>
                {selectedPlanData.name} Plan · ${selectedPlanData.price}/mo
              </Typography>
              <Typography variant="caption" sx={{ color: '#6d8199' }}>
                14-day free trial · No card required
              </Typography>
            </Box>
            <Button
              size="small"
              startIcon={<ArrowBack sx={{ fontSize: '0.9rem !important' }} />}
              onClick={() => setStep(1)}
              sx={{ color: '#9fb4cc', fontSize: '0.75rem', flexShrink: 0 }}
            >
              Change
            </Button>
          </CardContent>
        </Card>

        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em', mb: 0.75 }}>
          Create your account
        </Typography>
        <Typography sx={{ color: '#9fb4cc', mb: 4, lineHeight: 1.6 }}>
          Your restaurant will be live in under 60 seconds.
        </Typography>

        {formError && (
          <Alert
            severity="error"
            sx={{
              mb: 3, bgcolor: 'rgba(211,47,47,0.1)', color: '#ef9a9a',
              border: '1px solid rgba(211,47,47,0.25)',
              '& .MuiAlert-icon': { color: '#ef5350' },
            }}
            onClose={() => setFormError('')}
          >
            {formError}
          </Alert>
        )}

        {/* Google Sign-In */}
        {googleEnabled && !googleCredential && (
          <>
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" sx={{ color: '#9fb4cc', mb: 2 }}>
                Fastest setup — sign up with Google:
              </Typography>
              <Box ref={buttonRef} sx={{ display: 'flex', justifyContent: 'center' }} />
            </Box>
            <Divider sx={{ my: 3, borderColor: EDGE }}>
              <Typography variant="caption" sx={{ color: '#6d8199', px: 1.5 }}>
                or continue with email
              </Typography>
            </Divider>
          </>
        )}

        {/* Google profile confirmation card */}
        {googleCredential && googleProfile && (
          <Card sx={{
            mb: 3, bgcolor: 'rgba(87,163,0,0.07)',
            border: '1px solid rgba(87,163,0,0.22)', borderRadius: 2,
          }}>
            <CardContent sx={{ py: '10px !important', px: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              {googleProfile.picture ? (
                <Box
                  component="img"
                  src={googleProfile.picture}
                  alt={googleProfile.name}
                  sx={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0 }}
                />
              ) : (
                <Box sx={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  bgcolor: CHROME_BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Typography sx={{ fontWeight: 700, color: '#fff', fontSize: '1rem' }}>
                    {googleProfile.name[0]}
                  </Typography>
                </Box>
              )}
              <Box flex={1} overflow="hidden">
                <Typography variant="body2" fontWeight={700} noWrap>{googleProfile.name}</Typography>
                <Typography variant="caption" sx={{ color: '#9fb4cc' }} noWrap>{googleProfile.email}</Typography>
              </Box>
              <CheckCircle sx={{ color: '#57a300', fontSize: 22, flexShrink: 0 }} />
            </CardContent>
          </Card>
        )}

        <Stack spacing={2.5}>
          {/* Restaurant name always shown */}
          <TextField
            label="Restaurant Name"
            value={restaurantName}
            onChange={(e) => setRestaurantName(e.target.value)}
            fullWidth
            autoFocus={!googleEnabled}
            placeholder="e.g. The Blue Crab Bistro"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Storefront sx={{ color: '#4a5a70', fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
            sx={inputSx}
          />

          {/* Email / password fields — only shown for non-Google signups */}
          {!googleCredential && (
            <>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  fullWidth
                  sx={inputSx}
                />
                <TextField
                  label="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  fullWidth
                  sx={inputSx}
                />
              </Stack>
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                sx={inputSx}
              />
              <TextField
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
                helperText="Minimum 8 characters"
                onKeyDown={(e) => e.key === 'Enter' && handleEmailSignup()}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword((v) => !v)}
                        edge="end"
                        sx={{ color: '#6d8199' }}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={inputSx}
              />
            </>
          )}

          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={googleCredential ? handleGoogleComplete : handleEmailSignup}
            disabled={isPending}
            sx={{
              py: 1.5, fontWeight: 700, fontSize: '1.05rem', borderRadius: 2, mt: 0.5,
              background: `linear-gradient(180deg, ${CHROME_LIGHT} 0%, ${CHROME_BLUE} 55%, #14477f 100%)`,
              boxShadow: '0 8px 32px rgba(40,110,190,0.35)',
              '&:hover': { background: `linear-gradient(180deg, #55a0e8, ${CHROME_BLUE})` },
              '&.Mui-disabled': { opacity: 0.55, background: `linear-gradient(180deg, ${CHROME_LIGHT}, ${CHROME_BLUE})` },
            }}
          >
            {isPending
              ? <CircularProgress size={22} sx={{ color: '#fff' }} />
              : 'Create My POS'}
          </Button>

          <Typography variant="caption" sx={{ color: '#4a5a70', textAlign: 'center', lineHeight: 1.7 }}>
            By creating an account you agree to our{' '}
            <Box component="span" sx={{ color: CHROME_LIGHT, cursor: 'pointer' }}>Terms of Service</Box>
            {' '}and{' '}
            <Box component="span" sx={{ color: CHROME_LIGHT, cursor: 'pointer' }}>Privacy Policy</Box>.
          </Typography>

          <Typography variant="body2" sx={{ color: '#6d8199', textAlign: 'center' }}>
            Already have an account?{' '}
            <Box
              component="span"
              sx={{ color: CHROME_LIGHT, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
              onClick={() => navigate('/login')}
            >
              Sign in
            </Box>
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
