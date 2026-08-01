import React, { useMemo, useState } from 'react';
import {
  Box, Paper, Typography, Stack, TextField, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Grid, FormControlLabel, Checkbox,
  Tabs, Tab, Divider, Alert, MenuItem,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '@/api/customers.api';
import { extractError } from '@/api/client';
import type { Customer, Order } from '@/types';

function campaignTargets(customers: Customer[], audience: 'all' | 'email' | 'text' | 'opted-in') {
  return customers.filter((customer) => {
    if (audience === 'all') return true;
    if (audience === 'email') return Boolean(customer.email);
    if (audience === 'text') return Boolean(customer.phone);
    return Boolean(customer.emailOptIn || customer.textOptIn);
  });
}

function customerName(customer: Customer) {
  return `${customer.firstName} ${customer.lastName ?? ''}`.trim();
}

export default function CustomerManagement() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [campaignTab, setCampaignTab] = useState(0);
  const [audience, setAudience] = useState<'all' | 'email' | 'text' | 'opted-in'>('opted-in');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [sendText, setSendText] = useState(false);
  const [error, setError] = useState('');

  const customersQuery = useQuery({
    queryKey: ['customers-admin'],
    queryFn: () => customersApi.list({ limit: 500 }).then((r) => r.data),
  });

  const customerOrdersQuery = useQuery({
    queryKey: ['customer-orders', selectedCustomer?.id],
    queryFn: () => customersApi.orders(selectedCustomer!.id).then((r) => r.data),
    enabled: Boolean(selectedCustomer),
  });

  const createCustomerMutation = useMutation({
    mutationFn: (data: { firstName: string; lastName?: string; email?: string; phone?: string; emailOptIn?: boolean; textOptIn?: boolean }) => customersApi.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers-admin'] }),
  });

  const updateCustomerMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Customer> }) => customersApi.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers-admin'] }),
  });

  const pointsMutation = useMutation({
    mutationFn: ({ id, points }: { id: number; points: number }) => customersApi.points(id, points),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers-admin'] }),
  });

  const filtered = useMemo(() => {
    const list = customersQuery.data?.customers ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((customer) =>
      customerName(customer).toLowerCase().includes(q)
      || customer.email?.toLowerCase().includes(q)
      || customer.phone?.includes(q)
    );
  }, [customersQuery.data, search]);

  const totals = useMemo(() => {
    const list = customersQuery.data?.customers ?? [];
    return {
      total: list.length,
      emailOptedIn: list.filter((customer) => customer.emailOptIn).length,
      textOptedIn: list.filter((customer) => customer.textOptIn).length,
      campaignTargets: campaignTargets(list, audience).length,
    };
  }, [customersQuery.data, audience]);

  const openCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
  };

  const saveCampaign = () => {
    setError('');
    if (!subject.trim() && sendEmail) {
      setError('Enter an email subject.');
      return;
    }
    if (!message.trim()) {
      setError('Enter a campaign message.');
      return;
    }
    setCampaignOpen(false);
  };

  const sendPoints = () => {
    if (!selectedCustomer) return;
    pointsMutation.mutate({ id: selectedCustomer.id, points: 100 });
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2} mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={800}>Customers & Campaigns</Typography>
          <Typography variant="body2" color="text.secondary">View customer accounts, opt-ins, and marketing audiences from the tenant panel.</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={() => setCampaignOpen(true)}>Create Campaign</Button>
          <Button variant="contained" onClick={() => createCustomerMutation.mutate({ firstName: 'New', lastName: 'Customer', emailOptIn: true, textOptIn: true })}>
            Quick Add Customer
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={6} md={3}><Paper sx={{ p: 2 }}><Typography variant="caption" color="text.secondary">Customers</Typography><Typography variant="h4" fontWeight={800}>{totals.total}</Typography></Paper></Grid>
        <Grid item xs={12} sm={6} md={3}><Paper sx={{ p: 2 }}><Typography variant="caption" color="text.secondary">Email Opt-ins</Typography><Typography variant="h4" fontWeight={800}>{totals.emailOptedIn}</Typography></Paper></Grid>
        <Grid item xs={12} sm={6} md={3}><Paper sx={{ p: 2 }}><Typography variant="caption" color="text.secondary">Text Opt-ins</Typography><Typography variant="h4" fontWeight={800}>{totals.textOptedIn}</Typography></Paper></Grid>
        <Grid item xs={12} sm={6} md={3}><Paper sx={{ p: 2 }}><Typography variant="caption" color="text.secondary">Campaign Audience</Typography><Typography variant="h4" fontWeight={800}>{totals.campaignTargets}</Typography></Paper></Grid>
      </Grid>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
          <TextField fullWidth size="small" label="Search customers" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Chip label={`Opted in: ${totals.campaignTargets}`} />
        </Stack>
      </Paper>

      {customersQuery.isLoading ? (
        <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>
      ) : customersQuery.error ? (
        <Alert severity="error">{extractError(customersQuery.error)}</Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Customer</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell>Opt-ins</TableCell>
                <TableCell align="right">Points</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((customer) => (
                <TableRow key={customer.id} hover>
                  <TableCell>
                    <Typography fontWeight={700}>{customerName(customer)}</Typography>
                    <Typography variant="caption" color="text.secondary">#{customer.id}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{customer.email ?? 'No email'}</Typography>
                    <Typography variant="caption" color="text.secondary">{customer.phone ?? 'No phone'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Chip size="small" label={`Email ${customer.emailOptIn ? 'On' : 'Off'}`} color={customer.emailOptIn ? 'success' : 'default'} />
                      <Chip size="small" label={`Text ${customer.textOptIn ? 'On' : 'Off'}`} color={customer.textOptIn ? 'success' : 'default'} />
                    </Stack>
                  </TableCell>
                  <TableCell align="right"><Typography fontWeight={700}>{customer.points}</Typography></TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button size="small" onClick={() => openCustomer(customer)}>View</Button>
                      <Button size="small" onClick={() => updateCustomerMutation.mutate({ id: customer.id, data: { emailOptIn: !customer.emailOptIn } })}>
                        Toggle Email
                      </Button>
                      <Button size="small" onClick={() => updateCustomerMutation.mutate({ id: customer.id, data: { textOptIn: !customer.textOptIn } })}>
                        Toggle Text
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={Boolean(selectedCustomer)} onClose={() => setSelectedCustomer(null)} fullWidth maxWidth="md">
        <DialogTitle>{selectedCustomer ? customerName(selectedCustomer) : 'Customer'}</DialogTitle>
        <DialogContent dividers>
          <Tabs value={campaignTab} onChange={(_, value) => setCampaignTab(value)}>
            <Tab label="Profile" />
            <Tab label="Orders" />
            <Tab label="Campaigns" />
          </Tabs>
          <Divider sx={{ my: 2 }} />
          {campaignTab === 0 && selectedCustomer && (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">Manage contact info and notification preferences.</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}><TextField fullWidth label="First Name" value={selectedCustomer.firstName} onChange={(e) => setSelectedCustomer({ ...selectedCustomer, firstName: e.target.value })} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="Last Name" value={selectedCustomer.lastName ?? ''} onChange={(e) => setSelectedCustomer({ ...selectedCustomer, lastName: e.target.value })} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="Email" value={selectedCustomer.email ?? ''} onChange={(e) => setSelectedCustomer({ ...selectedCustomer, email: e.target.value })} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="Phone" value={selectedCustomer.phone ?? ''} onChange={(e) => setSelectedCustomer({ ...selectedCustomer, phone: e.target.value })} /></Grid>
              </Grid>
              <Stack direction="row" spacing={2}>
                <Chip label={`Email ${selectedCustomer.emailOptIn ? 'enabled' : 'disabled'}`} />
                <Chip label={`Text ${selectedCustomer.textOptIn ? 'enabled' : 'disabled'}`} />
                <Chip label={`${selectedCustomer.points} points`} />
              </Stack>
              <Stack direction="row" spacing={1}>
                <Button variant="contained" onClick={() => updateCustomerMutation.mutate({ id: selectedCustomer.id, data: selectedCustomer })}>Save Customer</Button>
                <Button variant="outlined" onClick={sendPoints}>Add 100 Loyalty Points</Button>
              </Stack>
            </Stack>
          )}
          {campaignTab === 1 && selectedCustomer && (
            <Stack spacing={1.5}>
              {customerOrdersQuery.isLoading ? <CircularProgress /> : (customerOrdersQuery.data ?? []).map((order: Order) => (
                <Paper key={order.id} sx={{ p: 2 }}>
                  <Stack direction="row" justifyContent="space-between">
                    <Box>
                      <Typography fontWeight={700}>{order.orderNumber}</Typography>
                      <Typography variant="caption" color="text.secondary">{new Date(order.createdAt).toLocaleString()}</Typography>
                    </Box>
                    <Chip size="small" label={order.status} />
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
          {campaignTab === 2 && (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">Build email or SMS campaigns from the customers already opted in.</Typography>
              <FormControlLabel control={<Checkbox checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />} label="Send email" />
              <FormControlLabel control={<Checkbox checked={sendText} onChange={(e) => setSendText(e.target.checked)} />} label="Send text" />
              <TextField select label="Audience" value={audience} onChange={(e) => setAudience(e.target.value as any)}>
                <MenuItem value="all">All customers</MenuItem>
                <MenuItem value="email">Has email</MenuItem>
                <MenuItem value="text">Has phone</MenuItem>
                <MenuItem value="opted-in">Notification opted-in</MenuItem>
              </TextField>
              <TextField label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} fullWidth disabled={!sendEmail} />
              <TextField label="Message" value={message} onChange={(e) => setMessage(e.target.value)} fullWidth multiline minRows={4} />
              {error && <Alert severity="error">{error}</Alert>}
              <Button variant="contained" onClick={saveCampaign}>Save Campaign Draft</Button>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedCustomer(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={campaignOpen} onClose={() => setCampaignOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create Campaign</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField select label="Audience" value={audience} onChange={(e) => setAudience(e.target.value as any)}>
              <MenuItem value="all">All customers</MenuItem>
              <MenuItem value="email">Has email</MenuItem>
              <MenuItem value="text">Has phone</MenuItem>
              <MenuItem value="opted-in">Notification opted-in</MenuItem>
            </TextField>
            <TextField label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} fullWidth />
            <TextField label="Message" value={message} onChange={(e) => setMessage(e.target.value)} fullWidth multiline minRows={4} />
            <Stack direction="row" spacing={1}>
              <FormControlLabel control={<Checkbox checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />} label="Email" />
              <FormControlLabel control={<Checkbox checked={sendText} onChange={(e) => setSendText(e.target.checked)} />} label="Text" />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              This drafts a campaign using the selected audience. You can wire this into SendGrid, Mailchimp, or an SMS provider next.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCampaignOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveCampaign}>Save Draft</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
