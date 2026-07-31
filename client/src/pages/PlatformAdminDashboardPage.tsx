import React, { useMemo, useState } from 'react';
import {
  Box, Typography, Stack, Grid, Paper, Card, CardContent, Chip, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  FormControl, InputLabel, Select, MenuItem, CircularProgress, TextField,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { platformApi, type PlatformOrganization, type PlatformPlanTier, type PlatformSubscriptionStatus } from '@/api/platform.api';
import { usePlatformAdminStore } from '@/store/platformAdminStore';
import { extractError } from '@/api/client';

function money(value: number) {
  return `$${Number(value ?? 0).toFixed(2)}`;
}

function StatCard({ title, value, subtitle }: { title: string; value: string | number; subtitle?: string }) {
  return (
    <Card sx={{ bgcolor: '#111722', border: '1px solid rgba(255,255,255,0.08)', height: '100%' }}>
      <CardContent>
        <Typography variant="caption" color="text.secondary" textTransform="uppercase" letterSpacing={0.7}>{title}</Typography>
        <Typography variant="h4" fontWeight={800} mt={0.5}>{value}</Typography>
        {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
      </CardContent>
    </Card>
  );
}

export default function PlatformAdminDashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const logout = usePlatformAdminStore((s) => s.logout);
  const email = usePlatformAdminStore((s) => s.email);

  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['platform-overview'],
    queryFn: () => platformApi.getOverview().then((r) => r.data),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<Pick<PlatformOrganization, 'isActive' | 'planTier' | 'subscriptionStatus'>> }) =>
      platformApi.updateOrganization(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-overview'] }),
  });

  const rows = useMemo(() => {
    const orgs = data?.organizations ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return orgs;
    return orgs.filter((o) =>
      o.name.toLowerCase().includes(q)
      || o.slug.toLowerCase().includes(q)
      || o.email.toLowerCase().includes(q)
    );
  }, [data, search]);

  if (isLoading) {
    return <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>;
  }

  if (error || !data) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography color="error">{extractError(error)}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, minHeight: '100vh', bgcolor: '#05070d' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2} mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={800}>SonicPOS Platform Console</Typography>
          <Typography variant="body2" color="text.secondary">Signed in as {email}</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={() => navigate('/admin/reports')}>Back to Tenant App</Button>
          <Button variant="contained" color="error" onClick={() => { logout(); navigate('/platform/login'); }}>Sign Out</Button>
        </Stack>
      </Stack>

      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={6} md={3}><StatCard title="Organizations" value={data.summary.totalOrganizations} /></Grid>
        <Grid item xs={12} sm={6} md={3}><StatCard title="Active" value={data.summary.activeOrganizations} subtitle={`Trialing: ${data.summary.trialingOrganizations}`} /></Grid>
        <Grid item xs={12} sm={6} md={3}><StatCard title="MRR" value={money(data.summary.monthlyRecurringRevenue)} subtitle={`Past Due: ${data.summary.pastDueOrganizations}`} /></Grid>
        <Grid item xs={12} sm={6} md={3}><StatCard title="30D Sales" value={money(data.summary.totalSales30d)} subtitle={`30D Orders: ${data.summary.totalOrders30d}`} /></Grid>
      </Grid>

      <Paper sx={{ p: 2, bgcolor: '#111722', border: '1px solid rgba(255,255,255,0.08)', mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', md: 'center' }}>
          <TextField
            size="small"
            label="Search Companies"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 280 }}
          />
          <Stack direction="row" spacing={1}>
            <Chip label={`Starter: ${data.summary.planCounts.STARTER}`} size="small" />
            <Chip label={`Professional: ${data.summary.planCounts.PROFESSIONAL}`} size="small" />
            <Chip label={`Enterprise: ${data.summary.planCounts.ENTERPRISE}`} size="small" />
          </Stack>
        </Stack>
      </Paper>

      <TableContainer component={Paper} sx={{ bgcolor: '#111722', border: '1px solid rgba(255,255,255,0.08)' }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ '& th': { fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary' } }}>
              <TableCell>Company</TableCell>
              <TableCell>Slug</TableCell>
              <TableCell>Plan</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Users</TableCell>
              <TableCell align="right">30D Orders</TableCell>
              <TableCell align="right">30D Sales</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((org) => (
              <TableRow key={org.id} sx={{ '& td': { borderBottom: '1px solid rgba(255,255,255,0.05)' } }}>
                <TableCell>
                  <Typography fontWeight={700}>{org.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{org.email}</Typography>
                </TableCell>
                <TableCell>{org.slug}</TableCell>
                <TableCell>
                  <FormControl size="small" sx={{ minWidth: 130 }}>
                    <InputLabel>Plan</InputLabel>
                    <Select
                      label="Plan"
                      value={org.planTier}
                      onChange={(e) => updateMutation.mutate({ id: org.id, patch: { planTier: e.target.value as PlatformPlanTier } })}
                      disabled={updateMutation.isPending}
                    >
                      <MenuItem value="STARTER">Starter</MenuItem>
                      <MenuItem value="PROFESSIONAL">Professional</MenuItem>
                      <MenuItem value="ENTERPRISE">Enterprise</MenuItem>
                    </Select>
                  </FormControl>
                </TableCell>
                <TableCell>
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Status</InputLabel>
                    <Select
                      label="Status"
                      value={org.subscriptionStatus}
                      onChange={(e) => updateMutation.mutate({ id: org.id, patch: { subscriptionStatus: e.target.value as PlatformSubscriptionStatus } })}
                      disabled={updateMutation.isPending}
                    >
                      <MenuItem value="TRIALING">TRIALING</MenuItem>
                      <MenuItem value="ACTIVE">ACTIVE</MenuItem>
                      <MenuItem value="PAST_DUE">PAST_DUE</MenuItem>
                      <MenuItem value="CANCELED">CANCELED</MenuItem>
                    </Select>
                  </FormControl>
                </TableCell>
                <TableCell align="right">{org.usersCount}</TableCell>
                <TableCell align="right">{org.orders30d}</TableCell>
                <TableCell align="right">{money(org.sales30d)}</TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    color={org.isActive ? 'error' : 'success'}
                    variant="outlined"
                    onClick={() => updateMutation.mutate({ id: org.id, patch: { isActive: !org.isActive } })}
                    disabled={updateMutation.isPending}
                  >
                    {org.isActive ? 'Disable' : 'Enable'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
