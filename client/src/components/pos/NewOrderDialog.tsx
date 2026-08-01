import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, Stack, Typography, ToggleButtonGroup, ToggleButton, CircularProgress, Box,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { ordersApi } from '@/api/orders.api';
import { settingsApi } from '@/api/settings.api';
import { extractError } from '@/api/client';
import type { Table, Order, OrderType } from '@/types';
import { ORDER_TYPE_SETTINGS } from '@/config/orderTypes';

interface Props {
  open: boolean;
  table?: Table | null;
  onClose: () => void;
  /** Called with the created Order after successful creation */
  onSuccess?: (order: Order) => void;
}

export default function NewOrderDialog({ open, table, onClose, onSuccess }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.getAll().then((r) => r.data),
    enabled: open,
  });

  const enabledOrderTypes = React.useMemo(
    () => ORDER_TYPE_SETTINGS.filter(({ key }) => settings?.[key] !== 'false'),
    [settings],
  );
  const preferredOrderType = table ? 'DINE_IN' : 'TO_GO';
  const fallbackOrderType = enabledOrderTypes.find((option) => option.type === preferredOrderType)?.type ?? enabledOrderTypes[0]?.type ?? 'TO_GO';

  const [orderType, setOrderType]       = useState<OrderType>('DINE_IN');
  const [guestCount, setGuestCount]     = useState('1');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Reset state whenever the dialog opens or the table changes
  useEffect(() => {
    if (open) {
      setOrderType(fallbackOrderType);
      setGuestCount('1');
      setCustomerName('');
      setCustomerPhone('');
    }
  }, [open, table?.id, fallbackOrderType]);

  useEffect(() => {
    if (!enabledOrderTypes.some((option) => option.type === orderType) && enabledOrderTypes.length > 0) {
      setOrderType(fallbackOrderType);
    }
  }, [enabledOrderTypes, orderType, fallbackOrderType]);

  const mutation = useMutation({
    mutationFn: () =>
      ordersApi.create({
        type: orderType,
        tableId: table?.id,
        guestCount: parseInt(guestCount) || 1,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
      }),
    onSuccess: ({ data }) => {
      enqueueSnackbar(`Order ${data.orderNumber} created`, { variant: 'success' });
      qc.invalidateQueries({ queryKey: ['tables'] });
      qc.invalidateQueries({ queryKey: ['tables-floorview'] });
      onClose();
      onSuccess?.(data);
    },
    onError: (e) => enqueueSnackbar(extractError(e), { variant: 'error' }),
  });

  const handleClose = () => {
    if (mutation.isPending) return;
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { bgcolor: '#242424' } }}
    >
      <DialogTitle>
        New Order {table ? `— Table ${table.name}` : ''}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} mt={1}>
          <Box>
            <Typography variant="caption" color="text.secondary" gutterBottom display="block">
              Order Type
            </Typography>
            <ToggleButtonGroup
              value={orderType}
              exclusive
              onChange={(_, v) => v && setOrderType(v)}
              fullWidth
              size="small"
            >
              {enabledOrderTypes.map(({ type, emoji, label }) => (
                <ToggleButton key={type} value={type}>{emoji} {label}</ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
          {orderType === 'DINE_IN' && (
            <TextField
              label="Guest Count"
              type="number"
              value={guestCount}
              onChange={(e) => setGuestCount(e.target.value)}
              size="small"
              inputProps={{ min: 1, max: 50 }}
            />
          )}
          <TextField
            label="Customer Name (optional)"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            size="small"
          />
          {(orderType === 'TO_GO' || orderType === 'DELIVERY') && (
            <TextField
              label="Phone (optional)"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              size="small"
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={handleClose} disabled={mutation.isPending}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? <CircularProgress size={20} /> : 'Start Order'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
