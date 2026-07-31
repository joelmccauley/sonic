import React from 'react';
import {
  Box, Button, Container, Typography, Stack, Grid, Card, CardContent,
  Chip, Divider, List, ListItem, ListItemIcon, ListItemText, AppBar, Toolbar,
} from '@mui/material';
import {
  Bolt, TableRestaurant, Kitchen, BarChart, Inventory2, LocalOffer,
  People, Print, CheckCircle, Close, ArrowForward, PointOfSale, Security, SupportAgent,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { billingApi } from '@/api/billing.api';
import { useAuthStore } from '@/store/authStore';
import type { PlanInfo, PlanTier } from '@/types';

// ── Design tokens (derived from the SONIC chrome logo) ───────────────────────
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

const FEATURE_ROWS: Array<{ key: string; label: string }> = [
  { key: 'pos', label: 'Point of Sale & Floor View' },
  { key: 'menuManagement', label: 'Menu Builder & Modifiers' },
  { key: 'basicReports', label: 'Sales Reports' },
  { key: 'kds', label: 'Kitchen Display System' },
  { key: 'inventory', label: 'Inventory Tracking' },
  { key: 'discounts', label: 'Discounts & Comps' },
  { key: 'customers', label: 'Customers & Loyalty' },
  { key: 'multiPrinter', label: 'Multiple Printer Stations' },
  { key: 'advancedReports', label: 'Advanced Reports & Exports' },
  { key: 'auditLog', label: 'Audit Log & Compliance' },
  { key: 'prioritySupport', label: 'Priority Support' },
];

const FALLBACK_PLANS: PlanInfo[] = [
  {
    tier: 'STARTER', name: 'Starter', price: 29, tagline: 'Everything you need to start selling',
    maxEmployees: 5, maxTables: 15,
    features: { pos: true, floorPlan: true, menuManagement: true, basicReports: true, kds: false, inventory: false, discounts: false, customers: false, advancedReports: false, auditLog: false, multiPrinter: false, prioritySupport: false },
  },
  {
    tier: 'PROFESSIONAL', name: 'Professional', price: 59, tagline: 'For growing restaurants that need the full toolkit',
    maxEmployees: 15, maxTables: null,
    features: { pos: true, floorPlan: true, menuManagement: true, basicReports: true, kds: true, inventory: true, discounts: true, customers: true, advancedReports: false, auditLog: false, multiPrinter: true, prioritySupport: false },
  },
  {
    tier: 'ENTERPRISE', name: 'Enterprise', price: 99, tagline: 'Maximum power, insight, and support',
    maxEmployees: null, maxTables: null,
    features: { pos: true, floorPlan: true, menuManagement: true, basicReports: true, kds: true, inventory: true, discounts: true, customers: true, advancedReports: true, auditLog: true, multiPrinter: true, prioritySupport: true },
  },
];

const HIGHLIGHTS = [
  { icon: <PointOfSale />, title: 'Lightning-fast ordering', text: 'A POS built for the rush. Ring in orders, split checks, and fire tickets to the kitchen in seconds.' },
  { icon: <TableRestaurant />, title: 'Live floor view', text: 'See every table\'s status at a glance. Drag-and-drop floor plan editor matches your real dining room.' },
  { icon: <Kitchen />, title: 'Kitchen Display System', text: 'Replace paper tickets with a real-time KDS. Course timing, item status, and bump bars included.' },
  { icon: <Inventory2 />, title: 'Inventory that keeps up', text: 'Track stock levels automatically as orders come in, with low-stock alerts before you 86 an item.' },
  { icon: <BarChart />, title: 'Reports that matter', text: 'Daily sales, product mix, labor, and voids — know your numbers without spreadsheets.' },
  { icon: <Security />, title: 'Roles & audit trail', text: 'PIN-based logins, granular roles, and a full audit log of every void, comp, and price change.' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  const { data } = useQuery({
    queryKey: ['public-plans'],
    queryFn: () => billingApi.getPlans().then((r) => r.data),
    staleTime: 5 * 60_000,
  });
  const plans = data?.plans ?? FALLBACK_PLANS;

  const choosePlan = (tier: PlanTier) => navigate(`/signup?plan=${tier}`);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: BG, color: '#e8eef7', overflowX: 'hidden' }}>
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: 'rgba(5,7,13,0.82)', backdropFilter: 'blur(18px)', borderBottom: `1px solid ${EDGE}` }}>
        <Toolbar sx={{ maxWidth: 1200, width: '100%', mx: 'auto' }}>
          <Stack direction="row" alignItems="baseline" spacing={0.75} sx={{ flexGrow: 1, cursor: 'pointer' }} onClick={() => navigate('/')}>
            <img src="/logo.png" alt="SONIC" style={{ height: 30, objectFit: 'contain' }} />
            <Typography sx={{ ...chromeText, fontSize: 22 }}>POS</Typography>
          </Stack>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button color="inherit" sx={{ color: '#9fb4cc' }} onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>
              Pricing
            </Button>
            {isAuthenticated ? (
              <Button variant="contained" endIcon={<ArrowForward />} onClick={() => navigate('/floorview')}
                sx={{ background: `linear-gradient(180deg, ${CHROME_LIGHT}, ${CHROME_BLUE})`, fontWeight: 600 }}>
                Open Dashboard
              </Button>
            ) : (
              <>
                <Button color="inherit" sx={{ color: '#9fb4cc' }} onClick={() => navigate('/login')}>Sign in</Button>
                <Button variant="contained" onClick={() => navigate('/signup')}
                  sx={{ background: `linear-gradient(180deg, ${CHROME_LIGHT}, ${CHROME_BLUE})`, fontWeight: 600 }}>
                  Start free trial
                </Button>
              </>
            )}
          </Stack>
        </Toolbar>
      </AppBar>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <Box sx={{
        position: 'relative', pt: { xs: 10, md: 16 }, pb: { xs: 12, md: 18 }, textAlign: 'center',
        background: `radial-gradient(ellipse 90% 60% at 50% -10%, rgba(35,100,180,0.28), transparent 65%)`,
      }}>
        {/* speed lines echoing the logo's italic slant */}
        <Box aria-hidden sx={{
          position: 'absolute', inset: 0, opacity: 0.35, pointerEvents: 'none',
          background: `repeating-linear-gradient(102deg, transparent 0 140px, rgba(60,130,210,0.05) 140px 142px)`,
        }} />
        <Container maxWidth="md" sx={{ position: 'relative' }}>
          <Chip label="14-day free trial · No card required" size="small"
            sx={{ mb: 3, bgcolor: 'rgba(45,110,190,0.15)', color: '#7db4e8', border: `1px solid ${EDGE}`, fontWeight: 600 }} />
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <img src="/logo.png" alt="SONIC" style={{ height: 84, objectFit: 'contain', filter: 'drop-shadow(0 6px 30px rgba(40,110,190,0.45))' }} />
          </Box>
          <Typography variant="h2" sx={{ fontWeight: 800, letterSpacing: '-0.03em', fontSize: { xs: '2.2rem', md: '3.4rem' }, lineHeight: 1.1 }}>
            The point of sale that moves{' '}
            <Box component="span" sx={{ ...chromeText, fontSize: 'inherit' }}>at the speed of service</Box>
          </Typography>
          <Typography sx={{ mt: 3, mx: 'auto', maxWidth: 640, color: '#9fb4cc', fontSize: '1.125rem', lineHeight: 1.7 }}>
            SonicPOS runs your whole restaurant — floor plan, orders, kitchen, payments, inventory, and staff — from one blazing-fast system.
            Set up in minutes. One flat monthly price.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center" sx={{ mt: 5 }}>
            <Button size="large" variant="contained" endIcon={<Bolt />} onClick={() => navigate('/signup')}
              sx={{
                px: 5, py: 1.5, fontSize: '1.05rem', fontWeight: 700, borderRadius: 2,
                background: `linear-gradient(180deg, ${CHROME_LIGHT} 0%, ${CHROME_BLUE} 55%, #14477f 100%)`,
                boxShadow: '0 8px 32px rgba(40,110,190,0.4)',
                '&:hover': { background: `linear-gradient(180deg, #55a0e8, ${CHROME_BLUE})` },
              }}>
              Create your POS
            </Button>
            <Button size="large" variant="outlined" onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
              sx={{ px: 5, py: 1.5, fontSize: '1.05rem', borderRadius: 2, borderColor: EDGE, color: '#cfe0f2', '&:hover': { borderColor: CHROME_LIGHT, bgcolor: 'rgba(45,110,190,0.08)' } }}>
              See pricing
            </Button>
          </Stack>
        </Container>
      </Box>

      {/* ── Feature grid ─────────────────────────────────────────────────── */}
      <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
        <Typography variant="h3" textAlign="center" sx={{ fontWeight: 800, letterSpacing: '-0.02em', mb: 1.5, fontSize: { xs: '1.8rem', md: '2.4rem' } }}>
          Built for the dinner rush
        </Typography>
        <Typography textAlign="center" sx={{ color: '#9fb4cc', mb: 8, maxWidth: 560, mx: 'auto' }}>
          Every screen designed for speed, every workflow tested on a packed Friday night.
        </Typography>
        <Grid container spacing={3}>
          {HIGHLIGHTS.map((f) => (
            <Grid item xs={12} sm={6} md={4} key={f.title}>
              <Card sx={{
                height: '100%', bgcolor: BG_ELEVATED, border: `1px solid ${EDGE}`, borderRadius: 3,
                transition: 'transform 0.2s, border-color 0.2s',
                '&:hover': { transform: 'translateY(-4px)', borderColor: 'rgba(80,150,220,0.4)' },
              }}>
                <CardContent sx={{ p: 3.5 }}>
                  <Box sx={{
                    width: 46, height: 46, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2,
                    background: `linear-gradient(180deg, rgba(63,143,223,0.25), rgba(20,71,127,0.25))`, color: CHROME_LIGHT,
                    border: `1px solid ${EDGE}`,
                  }}>
                    {f.icon}
                  </Box>
                  <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>{f.title}</Typography>
                  <Typography variant="body2" sx={{ color: '#9fb4cc', lineHeight: 1.7 }}>{f.text}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* ── Pricing ─────────────────────────────────────────────────────── */}
      <Box id="pricing" sx={{ py: { xs: 8, md: 12 }, background: `radial-gradient(ellipse 80% 50% at 50% 0%, rgba(35,100,180,0.12), transparent 70%)` }}>
        <Container maxWidth="lg">
          <Typography variant="h3" textAlign="center" sx={{ fontWeight: 800, letterSpacing: '-0.02em', mb: 1.5, fontSize: { xs: '1.8rem', md: '2.4rem' } }}>
            Simple, flat pricing
          </Typography>
          <Typography textAlign="center" sx={{ color: '#9fb4cc', mb: 8 }}>
            No percentage of sales. No hidden fees. Cancel anytime.
          </Typography>

          <Grid container spacing={3} alignItems="stretch" justifyContent="center">
            {plans.map((plan) => {
              const popular = plan.tier === 'PROFESSIONAL';
              return (
                <Grid item xs={12} md={4} key={plan.tier}>
                  <Card sx={{
                    height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 4, position: 'relative',
                    bgcolor: BG_ELEVATED,
                    border: popular ? `2px solid ${CHROME_LIGHT}` : `1px solid ${EDGE}`,
                    boxShadow: popular ? '0 12px 48px rgba(40,110,190,0.3)' : 'none',
                    transform: popular ? { md: 'scale(1.04)' } : 'none',
                  }}>
                    {popular && (
                      <Chip label="MOST POPULAR" size="small" sx={{
                        position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                        background: `linear-gradient(180deg, ${CHROME_LIGHT}, ${CHROME_BLUE})`, color: '#fff', fontWeight: 700, letterSpacing: '0.06em',
                      }} />
                    )}
                    <CardContent sx={{ p: 4, display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: popular ? CHROME_LIGHT : '#e8eef7' }}>{plan.name}</Typography>
                      <Typography variant="body2" sx={{ color: '#9fb4cc', mb: 3, minHeight: 40 }}>{plan.tagline}</Typography>
                      <Stack direction="row" alignItems="baseline" spacing={1} mb={3}>
                        <Typography sx={{ fontSize: '3rem', fontWeight: 800, letterSpacing: '-0.04em' }}>${plan.price}</Typography>
                        <Typography sx={{ color: '#9fb4cc' }}>/month</Typography>
                      </Stack>
                      <Button fullWidth size="large" variant={popular ? 'contained' : 'outlined'}
                        onClick={() => choosePlan(plan.tier)}
                        sx={popular
                          ? { background: `linear-gradient(180deg, ${CHROME_LIGHT}, ${CHROME_BLUE})`, fontWeight: 700, borderRadius: 2, py: 1.25 }
                          : { borderColor: EDGE, color: '#cfe0f2', fontWeight: 600, borderRadius: 2, py: 1.25, '&:hover': { borderColor: CHROME_LIGHT } }}>
                        Start 14-day trial
                      </Button>
                      <Divider sx={{ my: 3, borderColor: EDGE }} />
                      <List dense disablePadding>
                        <ListItem disableGutters sx={{ py: 0.5 }}>
                          <ListItemIcon sx={{ minWidth: 30 }}><People sx={{ fontSize: 18, color: CHROME_LIGHT }} /></ListItemIcon>
                          <ListItemText primaryTypographyProps={{ fontSize: '0.875rem' }}
                            primary={plan.maxEmployees ? `Up to ${plan.maxEmployees} employees` : 'Unlimited employees'} />
                        </ListItem>
                        <ListItem disableGutters sx={{ py: 0.5 }}>
                          <ListItemIcon sx={{ minWidth: 30 }}><TableRestaurant sx={{ fontSize: 18, color: CHROME_LIGHT }} /></ListItemIcon>
                          <ListItemText primaryTypographyProps={{ fontSize: '0.875rem' }}
                            primary={plan.maxTables ? `Up to ${plan.maxTables} tables` : 'Unlimited tables'} />
                        </ListItem>
                        {FEATURE_ROWS.map((row) => {
                          const has = plan.features[row.key];
                          return (
                            <ListItem disableGutters key={row.key} sx={{ py: 0.5, opacity: has ? 1 : 0.38 }}>
                              <ListItemIcon sx={{ minWidth: 30 }}>
                                {has
                                  ? <CheckCircle sx={{ fontSize: 18, color: '#57a300' }} />
                                  : <Close sx={{ fontSize: 18, color: '#5a6a80' }} />}
                              </ListItemIcon>
                              <ListItemText primaryTypographyProps={{ fontSize: '0.875rem' }} primary={row.label} />
                            </ListItem>
                          );
                        })}
                      </List>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Container>
      </Box>

      {/* ── CTA band ─────────────────────────────────────────────────────── */}
      <Container maxWidth="md" sx={{ py: { xs: 8, md: 12 }, textAlign: 'center' }}>
        <Card sx={{
          borderRadius: 4, border: `1px solid ${EDGE}`, p: { xs: 4, md: 8 },
          background: `linear-gradient(135deg, rgba(20,60,110,0.5), rgba(8,14,26,0.9)), ${BG_ELEVATED}`,
        }}>
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em', mb: 2 }}>
            Ready to run your restaurant at <Box component="span" sx={{ ...chromeText, fontSize: 'inherit' }}>sonic speed</Box>?
          </Typography>
          <Typography sx={{ color: '#9fb4cc', mb: 4 }}>
            Create your POS in under two minutes. Your menu, your floor plan, your rules.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <Button size="large" variant="contained" endIcon={<ArrowForward />} onClick={() => navigate('/signup')}
              sx={{
                px: 5, py: 1.5, fontWeight: 700, borderRadius: 2,
                background: `linear-gradient(180deg, ${CHROME_LIGHT}, ${CHROME_BLUE})`,
                boxShadow: '0 8px 32px rgba(40,110,190,0.4)',
              }}>
              Start free trial
            </Button>
          </Stack>
          <Stack direction="row" spacing={3} justifyContent="center" sx={{ mt: 4, color: '#6d8199' }}>
            <Stack direction="row" spacing={0.75} alignItems="center"><CheckCircle sx={{ fontSize: 15 }} /><Typography variant="caption">14-day free trial</Typography></Stack>
            <Stack direction="row" spacing={0.75} alignItems="center"><CheckCircle sx={{ fontSize: 15 }} /><Typography variant="caption">No card required</Typography></Stack>
            <Stack direction="row" spacing={0.75} alignItems="center"><CheckCircle sx={{ fontSize: 15 }} /><Typography variant="caption">Cancel anytime</Typography></Stack>
          </Stack>
        </Card>
      </Container>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <Box component="footer" sx={{ borderTop: `1px solid ${EDGE}`, py: 6, bgcolor: BG }}>
        <Container maxWidth="lg">
          <Grid container spacing={4}>
            <Grid item xs={12} md={4}>
              <Stack direction="row" alignItems="baseline" spacing={0.75} mb={1.5}>
                <img src="/logo.png" alt="SONIC" style={{ height: 24, objectFit: 'contain' }} />
                <Typography sx={{ ...chromeText, fontSize: 18 }}>POS</Typography>
              </Stack>
              <Typography variant="body2" sx={{ color: '#6d8199', maxWidth: 300 }}>
                The all-in-one restaurant point of sale. Fast to set up, faster to use.
              </Typography>
            </Grid>
            <Grid item xs={6} md={2}>
              <Typography variant="subtitle2" sx={{ mb: 1.5, color: '#cfe0f2' }}>Product</Typography>
              <Stack spacing={1}>
                <Typography variant="body2" sx={{ color: '#6d8199', cursor: 'pointer', '&:hover': { color: CHROME_LIGHT } }} onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>Pricing</Typography>
                <Typography variant="body2" sx={{ color: '#6d8199', cursor: 'pointer', '&:hover': { color: CHROME_LIGHT } }} onClick={() => navigate('/signup')}>Sign up</Typography>
                <Typography variant="body2" sx={{ color: '#6d8199', cursor: 'pointer', '&:hover': { color: CHROME_LIGHT } }} onClick={() => navigate('/login')}>Sign in</Typography>
              </Stack>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="subtitle2" sx={{ mb: 1.5, color: '#cfe0f2' }}>Features</Typography>
              <Stack spacing={1}>
                {['Point of Sale', 'Kitchen Display', 'Inventory', 'Reports'].map((f) => (
                  <Typography key={f} variant="body2" sx={{ color: '#6d8199' }}>{f}</Typography>
                ))}
              </Stack>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="subtitle2" sx={{ mb: 1.5, color: '#cfe0f2' }}>Support</Typography>
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <SupportAgent sx={{ fontSize: 16, color: '#6d8199' }} />
                  <Typography variant="body2" sx={{ color: '#6d8199' }}>support@sonicpos.com</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Print sx={{ fontSize: 16, color: '#6d8199' }} />
                  <Typography variant="body2" sx={{ color: '#6d8199' }}>Hardware setup guides</Typography>
                </Stack>
              </Stack>
            </Grid>
          </Grid>
          <Divider sx={{ my: 4, borderColor: EDGE }} />
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
            <Typography variant="caption" sx={{ color: '#4a5a70' }}>
              © {new Date().getFullYear()} SonicPOS. All rights reserved.
            </Typography>
            <Stack direction="row" spacing={3}>
              <Typography variant="caption" sx={{ color: '#4a5a70' }}>Privacy</Typography>
              <Typography variant="caption" sx={{ color: '#4a5a70' }}>Terms</Typography>
            </Stack>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
