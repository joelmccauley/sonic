import React from 'react';
import {
  Box, Typography, Stack, Grid, Card, CardContent, Button, Chip, Divider,
  List, ListItem, ListItemIcon, ListItemText, CircularProgress, Alert,
  LinearProgress,
} from '@mui/material';
import {
  CheckCircle, Close, OpenInNew, CreditCard, Autorenew, Cancel,
  TableRestaurant, People, Bolt, ArrowUpward, ErrorOutline,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { billingApi } from '@/api/billing.api';
import { extractError } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import type { PlanTier } from '@/types';

// ── Design tokens (SONIC chrome logo) ────────────────────────────────────────
const BG_ELEVATED = '#0e1420';
const BG_CARD = '#111827';
const CHROME_BLUE = '#1d5fae';
const CHROME_LIGHT = '#3f8fdf';
const EDGE = 'rgba(120,170,230,0.14)';
const EDGE_BRIGHT = 'rgba(120,170,230,0.28)';

const PLAN_FEATURES: Record<PlanTier, string[]> = {
  STARTER: [
    'Point of Sale & Floor View',
    'Menu Builder & Modifiers',
    'Sales Reports',
    'Up to 5 employees',
    'Up to 15 tables',
  ],
  PROFESSIONAL: [
    'Everything in Starter',
    'Kitchen Display System',
    'Inventory Tracking',
    'Discounts & Comps',
    'Customer Loyalty',
    'Multiple Printer Stations',
    'Up to 15 employees',
    'Unlimited tables',
  ],
  ENTERPRISE: [
    'Everything in Professional',
    'Advanced Reports & Exports',
    'Audit Log & Compliance',
    'Priority Support',
    'Unlimited employees & tables',
  ],
};

const PLAN_MISSING: Record<PlanTier, string[]> = {
  STARTER: ['Kitchen Display System', 'Inventory', 'Discounts & Loyalty', 'Advanced Reports', 'Audit Log'],
  PROFESSIONAL: ['Advanced Reports & Exports', 'Audit Log & Compliance'],
  ENTERPRISE: [],
};

const PLANS_META: Array<{
  tier: PlanTier; name: string; price: number; tagline: string; popular?: boolean;
}> = [
  { tier: 'STARTER', name: 'Starter', price: 29, tagline: 'Everything you need to start selling' },
  { tier: 'PROFESSIONAL', name: 'Professional', price: 59, tagline: 'The full toolkit for growing restaurants', popular: true },
  { tier: 'ENTERPRISE', name: 'Enterprise', price: 99, tagline: 'Maximum power, insight, and support' },
];

const STATUS_COLORS: Record<string, string> = {
  TRIALING: '#7db4e8',
  ACTIVE: '#57a300',
  PAST_DUE: '#f57c00',
  CANCELED: '#e53935',
};

const STATUS_LABELS: Record<string, string> = {
  TRIALING: 'Free Trial',
  ACTIVE: 'Active',
  PAST_DUE: 'Past Due',
  CANCELED: 'Canceled',
};

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function BillingManagement() {
  const { enqueueSnackbar } = useSnackbar();
  const { setOrganization, organization } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: sub, isLoading, error } = useQuery({
    queryKey: ['billing-subscription'],
    queryFn: () => billingApi.getSubscription().then((r) => r.data),
    staleTime: 60_000,
  });

  const checkoutMutation = useMutation({
    mutationFn: (planTier: PlanTier) => billingApi.checkout(planTier),
    onSuccess: ({ data }) => {
      if (data.url) {
        // Redirect to Stripe checkout
        window.location.href = data.url;
      } else if (data.mock && data.organization) {
        // Dev mode — plan updated in-place
        enqueueSnackbar(`Plan changed to ${data.organization.planTier}`, { variant: 'success' });
        if (organization) {
          setOrganization({
            ...organization,
            planTier: data.organization.planTier,
            subscriptionStatus: data.organization.subscriptionStatus,
          });
        }
        queryClient.invalidateQueries({ queryKey: ['billing-subscription'] });
      }
    },
    onError: (err) => enqueueSnackbar(extractError(err), { variant: 'error' }),
  });

  const portalMutation = useMutation({
    mutationFn: () => billingApi.portal(),
    onSuccess: ({ data }) => { window.location.href = data.url; },
    onError: (err) => enqueueSnackbar(extractError(err), { variant: 'error' }),
  });

  if (isLoading) {
    return (
      <Box sx={{ p: 4 }}>
        <LinearProgress sx={{ borderRadius: 1 }} />
      </Box>
    );
  }

  if (error || !sub) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error" sx={{ bgcolor: 'rgba(211,47,47,0.1)', border: '1px solid rgba(211,47,47,0.25)', color: '#ef9a9a' }}>
          Failed to load billing information. Please refresh the page.
        </Alert>
      </Box>
    );
  }

  const trialDays = daysUntil(sub.trialEndsAt);
  const isTrialing = sub.subscriptionStatus === 'TRIALING';
  const isPastDue = sub.subscriptionStatus === 'PAST_DUE';
  const isCanceled = sub.subscriptionStatus === 'CANCELED';
  const statusColor = STATUS_COLORS[sub.subscriptionStatus] ?? '#9fb4cc';

  return (
    <Box sx={{ p: { xs: 2.5, md: 4 }, maxWidth: 1100, mx: 'auto' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <Box mb={4}>
        <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em', color: '#e8eef7' }}>
          Billing & Subscription
        </Typography>
        <Typography variant="body2" sx={{ color: '#6d8199', mt: 0.5 }}>
          Manage your plan and payment method
        </Typography>
      </Box>

      {/* ── Alerts ──────────────────────────────────────────────────────── */}
      {isTrialing && trialDays !== null && trialDays <= 7 && (
        <Alert
          severity="warning"
          icon={<ErrorOutline />}
          sx={{
            mb: 3, bgcolor: 'rgba(245,124,0,0.1)', border: '1px solid rgba(245,124,0,0.25)',
            color: '#ffb74d', '& .MuiAlert-icon': { color: '#f57c00' },
          }}
          action={
            <Button
              size="small" variant="contained"
              onClick={() => checkoutMutation.mutate(sub.planTier)}
              sx={{ background: `linear-gradient(180deg, ${CHROME_LIGHT}, ${CHROME_BLUE})`, fontWeight: 600 }}
            >
              Add Payment
            </Button>
          }
        >
          Your free trial ends in <strong>{trialDays} day{trialDays !== 1 ? 's' : ''}</strong>.
          Add a payment method to keep your POS running.
        </Alert>
      )}

      {isPastDue && (
        <Alert
          severity="error"
          sx={{ mb: 3, bgcolor: 'rgba(211,47,47,0.1)', border: '1px solid rgba(211,47,47,0.25)', color: '#ef9a9a', '& .MuiAlert-icon': { color: '#ef5350' } }}
          action={
            <Button size="small" variant="outlined" onClick={() => portalMutation.mutate()} sx={{ borderColor: '#ef5350', color: '#ef9a9a' }}>
              Update Card
            </Button>
          }
        >
          Your last payment failed. Please update your payment method to avoid service interruption.
        </Alert>
      )}

      {isCanceled && (
        <Alert
          severity="error"
          sx={{ mb: 3, bgcolor: 'rgba(211,47,47,0.08)', border: '1px solid rgba(211,47,47,0.2)', color: '#ef9a9a', '& .MuiAlert-icon': { color: '#ef5350' } }}
        >
          Your subscription has been canceled. Reactivate below to continue using SonicPOS.
        </Alert>
      )}

      {/* ── Current subscription card ────────────────────────────────────── */}
      <Card sx={{ bgcolor: BG_CARD, border: `1px solid ${EDGE_BRIGHT}`, borderRadius: 3, mb: 4 }}>
        <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} justifyContent="space-between" alignItems={{ sm: 'flex-start' }}>
            <Box>
              <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#e8eef7' }}>
                  {sub.plan.name} Plan
                </Typography>
                <Chip
                  label={STATUS_LABELS[sub.subscriptionStatus] ?? sub.subscriptionStatus}
                  size="small"
                  sx={{
                    bgcolor: `${statusColor}18`,
                    color: statusColor,
                    border: `1px solid ${statusColor}44`,
                    fontWeight: 700,
                    fontSize: '0.7rem',
                  }}
                />
              </Stack>
              <Typography variant="body2" sx={{ color: '#9fb4cc', mb: 2 }}>
                {sub.plan.tagline}
              </Typography>

              <Stack direction="row" spacing={3}>
                <Box>
                  <Typography variant="caption" sx={{ color: '#4a5a70', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Monthly Price
                  </Typography>
                  <Typography sx={{ fontWeight: 800, fontSize: '1.5rem', color: '#e8eef7', letterSpacing: '-0.02em' }}>
                    ${sub.plan.price}<Typography component="span" variant="body2" sx={{ color: '#6d8199', fontWeight: 400 }}>/mo</Typography>
                  </Typography>
                </Box>
                {isTrialing && trialDays !== null && (
                  <Box>
                    <Typography variant="caption" sx={{ color: '#4a5a70', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Trial Ends
                    </Typography>
                    <Typography sx={{ fontWeight: 700, color: trialDays <= 3 ? '#f57c00' : '#e8eef7' }}>
                      {trialDays === 0 ? 'Today' : `${trialDays} days`}
                      <Typography component="span" variant="caption" sx={{ color: '#6d8199', ml: 0.75 }}>
                        ({fmtDate(sub.trialEndsAt)})
                      </Typography>
                    </Typography>
                  </Box>
                )}
                {!isTrialing && sub.currentPeriodEnd && (
                  <Box>
                    <Typography variant="caption" sx={{ color: '#4a5a70', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Next Renewal
                    </Typography>
                    <Typography sx={{ fontWeight: 700, color: '#e8eef7' }}>
                      {fmtDate(sub.currentPeriodEnd)}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Box>

            <Stack spacing={1.5} alignItems={{ xs: 'flex-start', sm: 'flex-end' }} flexShrink={0}>
              {sub.stripeEnabled && (
                <Button
                  variant="outlined"
                  startIcon={<CreditCard />}
                  onClick={() => portalMutation.mutate()}
                  disabled={portalMutation.isPending}
                  sx={{
                    borderColor: EDGE_BRIGHT, color: '#cfe0f2', fontWeight: 600,
                    '&:hover': { borderColor: CHROME_LIGHT, bgcolor: 'rgba(63,143,223,0.06)' },
                    minWidth: 180,
                  }}
                >
                  {portalMutation.isPending ? <CircularProgress size={16} sx={{ color: CHROME_LIGHT }} /> : 'Manage Billing'}
                </Button>
              )}
              {!sub.stripeEnabled && (
                <Chip label="Dev mode — Stripe not configured" size="small"
                  sx={{ bgcolor: 'rgba(120,170,230,0.08)', color: '#6d8199', border: `1px solid ${EDGE}` }} />
              )}
            </Stack>
          </Stack>

          {/* Trial progress bar */}
          {isTrialing && trialDays !== null && (
            <Box mt={3}>
              <Stack direction="row" justifyContent="space-between" mb={0.75}>
                <Typography variant="caption" sx={{ color: '#6d8199' }}>Trial progress</Typography>
                <Typography variant="caption" sx={{ color: '#9fb4cc' }}>
                  {14 - trialDays} of 14 days used
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, ((14 - trialDays) / 14) * 100)}
                sx={{
                  height: 6, borderRadius: 3,
                  bgcolor: 'rgba(255,255,255,0.07)',
                  '& .MuiLinearProgress-bar': {
                    background: trialDays <= 3
                      ? 'linear-gradient(90deg, #f57c00, #ff9800)'
                      : `linear-gradient(90deg, ${CHROME_BLUE}, ${CHROME_LIGHT})`,
                    borderRadius: 3,
                  },
                }}
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* ── Plan comparison ──────────────────────────────────────────────── */}
      <Typography variant="h6" sx={{ fontWeight: 700, color: '#e8eef7', mb: 3 }}>
        {isCanceled ? 'Reactivate a plan' : 'Change your plan'}
      </Typography>

      <Grid container spacing={2.5} alignItems="stretch">
        {PLANS_META.map((plan) => {
          const isCurrent = sub.planTier === plan.tier;
          const isUpgrade = PLANS_META.findIndex((p) => p.tier === sub.planTier) <
            PLANS_META.findIndex((p) => p.tier === plan.tier);

          return (
            <Grid item xs={12} md={4} key={plan.tier}>
              <Card sx={{
                height: '100%', display: 'flex', flexDirection: 'column',
                borderRadius: 3, position: 'relative',
                bgcolor: isCurrent ? `rgba(29,95,174,0.1)` : BG_ELEVATED,
                border: isCurrent
                  ? `2px solid ${CHROME_LIGHT}`
                  : plan.popular
                  ? `1px solid rgba(63,143,223,0.3)`
                  : `1px solid ${EDGE}`,
                boxShadow: isCurrent ? `0 0 24px rgba(40,110,190,0.2)` : 'none',
                transition: 'border-color 0.2s',
              }}>
                {isCurrent && (
                  <Chip
                    label="CURRENT PLAN"
                    size="small"
                    sx={{
                      position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)',
                      background: `linear-gradient(180deg, ${CHROME_LIGHT}, ${CHROME_BLUE})`,
                      color: '#fff', fontWeight: 700, letterSpacing: '0.05em', fontSize: '0.65rem',
                    }}
                  />
                )}
                {plan.popular && !isCurrent && (
                  <Chip
                    label="POPULAR"
                    size="small"
                    sx={{
                      position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)',
                      bgcolor: 'rgba(63,143,223,0.15)', color: CHROME_LIGHT,
                      border: `1px solid ${EDGE_BRIGHT}`, fontWeight: 700, fontSize: '0.65rem',
                    }}
                  />
                )}

                <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: isCurrent ? CHROME_LIGHT : '#e8eef7', mb: 0.5 }}>
                    {plan.name}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#9fb4cc', mb: 2.5, minHeight: 36, lineHeight: 1.6 }}>
                    {plan.tagline}
                  </Typography>

                  <Stack direction="row" alignItems="baseline" spacing={0.5} mb={2.5}>
                    <Typography sx={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-0.04em', color: '#e8eef7' }}>
                      ${plan.price}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#6d8199' }}>/month</Typography>
                  </Stack>

                  {isCurrent ? (
                    <Button
                      fullWidth
                      disabled
                      variant="outlined"
                      sx={{
                        borderColor: EDGE_BRIGHT, color: '#9fb4cc',
                        '&.Mui-disabled': { color: '#9fb4cc', borderColor: EDGE_BRIGHT },
                      }}
                    >
                      <CheckCircle sx={{ fontSize: 16, mr: 0.75 }} /> Current Plan
                    </Button>
                  ) : (
                    <Button
                      fullWidth
                      variant={isUpgrade ? 'contained' : 'outlined'}
                      startIcon={isUpgrade ? <ArrowUpward sx={{ fontSize: 16 }} /> : undefined}
                      onClick={() => checkoutMutation.mutate(plan.tier)}
                      disabled={checkoutMutation.isPending}
                      sx={isUpgrade ? {
                        background: `linear-gradient(180deg, ${CHROME_LIGHT}, ${CHROME_BLUE})`,
                        fontWeight: 700, borderRadius: 2,
                        boxShadow: '0 4px 16px rgba(40,110,190,0.3)',
                      } : {
                        borderColor: EDGE, color: '#9fb4cc',
                        '&:hover': { borderColor: CHROME_LIGHT, color: '#cfe0f2' },
                      }}
                    >
                      {checkoutMutation.isPending && checkoutMutation.variables === plan.tier
                        ? <CircularProgress size={16} sx={{ color: 'inherit' }} />
                        : isUpgrade ? `Upgrade to ${plan.name}` : `Switch to ${plan.name}`}
                    </Button>
                  )}

                  <Divider sx={{ my: 2.5, borderColor: EDGE }} />

                  <List dense disablePadding sx={{ flex: 1 }}>
                    {PLAN_FEATURES[plan.tier].map((f) => (
                      <ListItem disableGutters key={f} sx={{ py: 0.35 }}>
                        <ListItemIcon sx={{ minWidth: 24 }}>
                          <CheckCircle sx={{ fontSize: 14, color: '#57a300' }} />
                        </ListItemIcon>
                        <ListItemText primaryTypographyProps={{ fontSize: '0.8rem', color: '#cfe0f2' }} primary={f} />
                      </ListItem>
                    ))}
                    {PLAN_MISSING[plan.tier].map((f) => (
                      <ListItem disableGutters key={f} sx={{ py: 0.35, opacity: 0.35 }}>
                        <ListItemIcon sx={{ minWidth: 24 }}>
                          <Close sx={{ fontSize: 14, color: '#5a6a80' }} />
                        </ListItemIcon>
                        <ListItemText primaryTypographyProps={{ fontSize: '0.8rem', color: '#9fb4cc' }} primary={f} />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* ── Billing info footer ───────────────────────────────────────────── */}
      <Card sx={{ mt: 4, bgcolor: BG_ELEVATED, border: `1px solid ${EDGE}`, borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} justifyContent="space-between" alignItems="center">
            <Stack spacing={0.5}>
              <Typography variant="body2" sx={{ color: '#e8eef7', fontWeight: 600 }}>
                Billing questions?
              </Typography>
              <Typography variant="caption" sx={{ color: '#6d8199' }}>
                Contact us at{' '}
                <Box component="a" href="mailto:billing@sonicpos.com"
                  sx={{ color: CHROME_LIGHT, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                  billing@sonicpos.com
                </Box>
              </Typography>
            </Stack>
            {sub.stripeEnabled && (
              <Stack direction="row" spacing={2}>
                <Button
                  variant="text"
                  startIcon={<Autorenew />}
                  onClick={() => portalMutation.mutate()}
                  disabled={portalMutation.isPending}
                  sx={{ color: '#9fb4cc', '&:hover': { color: CHROME_LIGHT } }}
                >
                  Manage Subscription
                </Button>
                <Button
                  variant="text"
                  startIcon={<OpenInNew />}
                  onClick={() => portalMutation.mutate()}
                  disabled={portalMutation.isPending}
                  sx={{ color: '#9fb4cc', '&:hover': { color: CHROME_LIGHT } }}
                >
                  View Invoices
                </Button>
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>

      {!sub.stripeEnabled && (
        <Typography variant="caption" sx={{ display: 'block', color: '#4a5a70', mt: 2, textAlign: 'center' }}>
          💡 Dev mode: set STRIPE_SECRET_KEY + STRIPE_PRICE_* env vars to enable real billing.
          Plan changes apply immediately without payment.
        </Typography>
      )}
    </Box>
  );
}
