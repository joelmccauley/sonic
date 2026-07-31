import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography,
  Stack, Grid, Box, TextField, Divider, Chip, Tab, Tabs, RadioGroup,
  Radio, FormControlLabel, CircularProgress, Alert, Slider, Paper,
} from '@mui/material';
import {
  CreditCard, AttachMoney, CardGiftcard, CheckCircle, AccountBalance, Print,
} from '@mui/icons-material';
import { useMutation } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { paymentsApi } from '@/api/payments.api';
import type { Order, PaymentMethod } from '@/types';
import { extractError } from '@/api/client';

const PAYMENT_METHODS = [
  { value: 'CASH' as PaymentMethod, label: 'Cash', icon: <AttachMoney /> },
  { value: 'CREDIT_CARD' as PaymentMethod, label: 'Credit', icon: <CreditCard /> },
  { value: 'DEBIT_CARD' as PaymentMethod, label: 'Debit', icon: <CreditCard /> },
  { value: 'GIFT_CARD' as PaymentMethod, label: 'Gift Card', icon: <CardGiftcard /> },
  { value: 'CHECK' as PaymentMethod, label: 'Check', icon: <AccountBalance /> },
  { value: 'COMP' as PaymentMethod, label: 'Comp', icon: <CheckCircle /> },
];

const TIP_SUGGESTIONS = [0, 15, 18, 20, 25];

interface Props {
  open: boolean;
  order: Order | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PaymentModal({ open, order, onClose, onSuccess }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [customTipPct, setCustomTipPct] = useState(0);
  const [selectedTipPct, setSelectedTipPct] = useState<number | null>(0);
  const [cashTendered, setCashTendered] = useState('');
  const [last4, setLast4] = useState('');
  const [reference, setReference] = useState('');
  const [paid, setPaid] = useState(false);
  const [paidResult, setPaidResult] = useState<{ change?: number } | null>(null);

  // Reset modal state whenever a payment session starts for a (possibly new) order.
  useEffect(() => {
    if (!open) return;
    setMethod('CASH');
    setCustomTipPct(0);
    setSelectedTipPct(0);
    setCashTendered('');
    setLast4('');
    setReference('');
    setPaid(false);
    setPaidResult(null);
  }, [open, order?.id]);

  const tipPct = selectedTipPct !== null ? selectedTipPct : customTipPct;
  const subtotal = order ? Number(order.subtotal) - Number(order.discountAmount) : 0;
  const tipAmount = Math.round(subtotal * (tipPct / 100) * 100) / 100;
  const total = order ? Number(order.total) + tipAmount : 0;

  const payMutation = useMutation({
    mutationFn: () =>
      paymentsApi.process(order!.id, {
        method,
        amount: total,
        tip: tipAmount,
        cashTendered: method === 'CASH' && cashTendered ? parseFloat(cashTendered) : undefined,
        last4: last4 || undefined,
        reference: reference || undefined,
      }),
    onSuccess: ({ data }) => {
      setPaid(true);
      setPaidResult({ change: data.change });
      enqueueSnackbar('Payment processed!', { variant: 'success' });
    },
    onError: (e) => enqueueSnackbar(extractError(e), { variant: 'error' }),
  });

  const printMutation = useMutation({
    mutationFn: () => paymentsApi.printReceipt(order!.id),
    onSuccess: () => enqueueSnackbar('Receipt sent to printer', { variant: 'info' }),
    onError: (e) => enqueueSnackbar(extractError(e), { variant: 'error' }),
  });

  if (!order) return null;

  const cashButtons = ['5', '10', '20', '50', '100'];

  if (paid) {
    return (
      <Dialog open={open} maxWidth="xs" fullWidth PaperProps={{ sx: { bgcolor: '#242424', textAlign: 'center' } }}>
        <DialogContent sx={{ py: 5 }}>
          <CheckCircle sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
          <Typography variant="h4" fontWeight={800} color="success.main" gutterBottom>PAID</Typography>
          <Typography variant="h5" gutterBottom>${total.toFixed(2)}</Typography>
          {paidResult?.change !== undefined && paidResult.change > 0 && (
            <Alert severity="info" sx={{ mt: 2, textAlign: 'left' }}>
              <Typography variant="h6">Change Due: <b>${paidResult.change.toFixed(2)}</b></Typography>
            </Alert>
          )}
          <Stack spacing={1.5} mt={3}>
            <Button variant="outlined" startIcon={<Print />} onClick={() => printMutation.mutate()} disabled={printMutation.isPending}>
              Print Receipt
            </Button>
            <Button variant="contained" color="success" onClick={onSuccess} size="large">
              Done — New Order
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: '#242424' } }}>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="h6" fontWeight={700}>Payment</Typography>
          <Box textAlign="right">
            <Typography variant="caption" color="text.secondary">Order #{order.orderNumber}</Typography>
            <Typography variant="h5" fontWeight={800} color="primary">${total.toFixed(2)}</Typography>
          </Box>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        {/* Payment method selection */}
        <Typography variant="subtitle2" fontWeight={600} gutterBottom>Payment Method</Typography>
        <Grid container spacing={1} mb={3}>
          {PAYMENT_METHODS.map((m) => (
            <Grid item xs={4} sm={2} key={m.value}>
              <Paper
                onClick={() => setMethod(m.value)}
                sx={{
                  p: 1.5, textAlign: 'center', cursor: 'pointer', borderRadius: 2,
                  border: '2px solid',
                  borderColor: method === m.value ? 'primary.main' : 'rgba(255,255,255,0.08)',
                  bgcolor: method === m.value ? 'rgba(0,120,212,0.15)' : 'rgba(255,255,255,0.03)',
                  transition: 'all 0.15s',
                  '&:hover': { borderColor: 'primary.light' },
                }}
              >
                <Box sx={{ color: method === m.value ? 'primary.main' : 'text.secondary', mb: 0.5 }}>
                  {m.icon}
                </Box>
                <Typography variant="caption" fontWeight={method === m.value ? 700 : 400}>{m.label}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

        {/* Tip selection */}
        <Typography variant="subtitle2" fontWeight={600} gutterBottom>Tip</Typography>
        <Stack direction="row" spacing={1} mb={2} flexWrap="wrap" gap={1}>
          {TIP_SUGGESTIONS.map((pct) => (
            <Chip
              key={pct}
              label={pct === 0 ? 'No Tip' : `${pct}% ($${(subtotal * pct / 100).toFixed(2)})`}
              clickable
              onClick={() => { setSelectedTipPct(pct); setCustomTipPct(0); }}
              variant={selectedTipPct === pct ? 'filled' : 'outlined'}
              color={selectedTipPct === pct ? 'primary' : 'default'}
            />
          ))}
          <Chip
            label={selectedTipPct === null ? `Custom: ${customTipPct}%` : 'Custom %'}
            clickable
            onClick={() => setSelectedTipPct(null)}
            variant={selectedTipPct === null ? 'filled' : 'outlined'}
            color={selectedTipPct === null ? 'secondary' : 'default'}
          />
        </Stack>
        {selectedTipPct === null && (
          <Box px={1} mb={2}>
            <Slider value={customTipPct} onChange={(_, v) => setCustomTipPct(v as number)} min={0} max={30} step={1} marks valueLabelDisplay="on" valueLabelFormat={(v) => `${v}%`} />
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Total breakdown */}
        <Stack spacing={0.75} mb={2}>
          <Stack direction="row" justifyContent="space-between">
            <Typography color="text.secondary">Subtotal</Typography>
            <Typography>${Number(order.subtotal).toFixed(2)}</Typography>
          </Stack>
          {Number(order.discountAmount) > 0 && (
            <Stack direction="row" justifyContent="space-between">
              <Typography color="success.main">Discount</Typography>
              <Typography color="success.main">-${Number(order.discountAmount).toFixed(2)}</Typography>
            </Stack>
          )}
          <Stack direction="row" justifyContent="space-between">
            <Typography color="text.secondary">Tax</Typography>
            <Typography>${Number(order.taxAmount).toFixed(2)}</Typography>
          </Stack>
          {tipAmount > 0 && (
            <Stack direction="row" justifyContent="space-between">
              <Typography color="text.secondary">Tip ({tipPct}%)</Typography>
              <Typography>${tipAmount.toFixed(2)}</Typography>
            </Stack>
          )}
          <Divider />
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" fontWeight={800}>Total</Typography>
            <Typography variant="h5" fontWeight={800} color="primary">${total.toFixed(2)}</Typography>
          </Stack>
        </Stack>

        {/* Cash specific */}
        {method === 'CASH' && (
          <Box>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>Cash Tendered</Typography>
            <Stack direction="row" spacing={1} mb={1.5} flexWrap="wrap" gap={1}>
              {cashButtons.map((amt) => (
                <Chip key={amt} label={`$${amt}`} clickable onClick={() => setCashTendered(amt)} variant={cashTendered === amt ? 'filled' : 'outlined'} color={cashTendered === amt ? 'primary' : 'default'} />
              ))}
            </Stack>
            <TextField
              label="Cash amount"
              type="number"
              value={cashTendered}
              onChange={(e) => setCashTendered(e.target.value)}
              size="small"
              InputProps={{ startAdornment: <Typography mr={0.5}>$</Typography> }}
            />
            {method === 'CASH' && cashTendered && parseFloat(cashTendered) >= total && (
              <Alert severity="info" sx={{ mt: 1 }}>
                <Typography>Change: <b>${(parseFloat(cashTendered) - total).toFixed(2)}</b></Typography>
              </Alert>
            )}
          </Box>
        )}

        {/* Card specific */}
        {(method === 'CREDIT_CARD' || method === 'DEBIT_CARD') && (
          <Box>
            <TextField
              label="Last 4 digits (optional)"
              value={last4}
              onChange={(e) => setLast4(e.target.value.slice(0, 4))}
              size="small"
              inputProps={{ maxLength: 4, inputMode: 'numeric' }}
            />
          </Box>
        )}

        {/* Reference for other methods */}
        {(method === 'GIFT_CARD' || method === 'CHECK') && (
          <TextField
            label="Reference / Card number"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            size="small"
            fullWidth
          />
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button variant="outlined" onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          color="success"
          size="large"
          onClick={() => payMutation.mutate()}
          disabled={payMutation.isPending || (method === 'CASH' && cashTendered ? parseFloat(cashTendered) < total : false)}
          sx={{ minWidth: 180, fontSize: '1.1rem', py: 1.5 }}
        >
          {payMutation.isPending ? <CircularProgress size={24} /> : `Charge $${total.toFixed(2)}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
