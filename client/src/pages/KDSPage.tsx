import React, { useState, useEffect } from 'react';
import {
  Box, Grid, Paper, Typography, Stack, Chip, Button, IconButton,
  Divider, Badge, CircularProgress, Alert, Select, MenuItem, FormControl,
} from '@mui/material';
import {
  Kitchen, CheckCircle, LocalFireDepartment, Refresh, DoneAll, VolumeUp,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { ordersApi } from '@/api/orders.api';
import { apiClient } from '@/api/client';
import { useOrderStore } from '@/store/orderStore';
import { useWebSocket } from '@/contexts/WebSocketContext';
import type { Order, OrderItem, ItemStatus } from '@/types';
import { formatDistanceToNow, differenceInMinutes } from 'date-fns';

const ITEM_STATUS_COLORS: Record<string, string> = {
  SENT: '#c19c00',
  IN_PROGRESS: '#0078d4',
  READY: '#57a300',
};

interface KDSTicketProps {
  order: Order;
  onItemReady: (orderId: number, itemId: number) => void;
  onOrderReady: (orderId: number) => void;
}

function KDSTicket({ order, onItemReady, onOrderReady }: KDSTicketProps) {
  const ageMinutes = differenceInMinutes(new Date(), new Date(order.updatedAt));
  const isUrgent = ageMinutes >= 10;
  const isWarning = ageMinutes >= 7;

  const urgentColor = isUrgent ? '#c42b1c' : isWarning ? '#c19c00' : 'rgba(255,255,255,0.1)';
  const allReady = order.items.every((i) => i.status === 'READY' || i.status === 'DELIVERED' || i.status === 'VOIDED');

  return (
    <Paper
      sx={{
        borderRadius: 1, overflow: 'hidden',
        border: `1px solid ${urgentColor}`,
        borderLeft: `3px solid ${urgentColor}`,
        bgcolor: '#1e1e1e',
      }}
    >
      {/* Ticket header */}
      <Box sx={{ px: 2, py: 1.5, bgcolor: isUrgent ? 'rgba(196,43,28,0.12)' : isWarning ? 'rgba(193,156,0,0.1)' : '#242424', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h6" fontWeight={800}>#{order.orderNumber}</Typography>
              <Chip label={order.type.replace('_', ' ')} size="small" variant="outlined" sx={{ fontSize: '0.65rem' }} />
              {order.table && <Chip label={`Table ${order.table.name}`} size="small" color="primary" sx={{ fontSize: '0.65rem' }} />}
            </Stack>
            {order.server && (
              <Typography variant="caption" color="text.secondary">Server: {order.server.firstName}</Typography>
            )}
          </Box>
          <Box textAlign="right">
            <Typography variant="caption" color={isUrgent ? 'error' : isWarning ? 'warning.main' : 'text.secondary'} fontWeight={isUrgent ? 700 : 400}>
              {ageMinutes}m ago
            </Typography>
            {isUrgent && <LocalFireDepartment sx={{ color: 'error.main', display: 'block', ml: 'auto' }} fontSize="small" />}
          </Box>
        </Stack>
        {order.notes && (
          <Alert severity="warning" sx={{ mt: 1, py: 0.25, fontSize: '0.75rem' }}>
            {order.notes}
          </Alert>
        )}
      </Box>

      {/* Items */}
      <Box sx={{ p: 1.5 }}>
        {order.items.map((item) => {
          if (item.status === 'VOIDED' || item.status === 'DELIVERED') return null;
          const isReady = item.status === 'READY';

          return (
            <Box
              key={item.id}
              sx={{
                p: 1.25, mb: 1, borderRadius: 1.5, cursor: 'pointer',
                bgcolor: isReady ? 'rgba(76,175,80,0.15)' : item.status === 'IN_PROGRESS' ? 'rgba(33,150,243,0.1)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${ITEM_STATUS_COLORS[item.status] ?? 'rgba(255,255,255,0.06)'}44`,
                transition: 'all 0.2s',
                '&:hover': { transform: 'scale(1.01)' },
              }}
              onClick={() => !isReady && onItemReady(order.id, item.id)}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body1" fontWeight={700} sx={{ textDecoration: isReady ? 'line-through' : 'none', opacity: isReady ? 0.6 : 1 }}>
                      {item.quantity}x {item.menuItem.name}
                    </Typography>
                    {item.course > 1 && <Chip label={`Course ${item.course}`} size="small" sx={{ fontSize: '0.6rem', height: 16 }} />}
                  </Stack>
                  {item.modifiers.length > 0 && (
                    <Typography variant="caption" color="text.secondary">
                      {item.modifiers.map((m) => `+ ${m.modifier.name}`).join(', ')}
                    </Typography>
                  )}
                  {item.notes && (
                    <Typography variant="caption" display="block" color="warning.main" fontWeight={600}>
                      ⚠ {item.notes}
                    </Typography>
                  )}
                </Box>
                <Chip
                  label={item.status}
                  size="small"
                  sx={{ bgcolor: ITEM_STATUS_COLORS[item.status] + '33', color: ITEM_STATUS_COLORS[item.status], fontWeight: 700, fontSize: '0.65rem' }}
                />
              </Stack>
            </Box>
          );
        })}
      </Box>

      {/* Footer */}
      <Box sx={{ px: 1.5, pb: 1.5 }}>
        <Button
          fullWidth
          variant={allReady ? 'contained' : 'outlined'}
          color={allReady ? 'success' : 'primary'}
          size="small"
          startIcon={allReady ? <DoneAll /> : <CheckCircle />}
          onClick={() => onOrderReady(order.id)}
        >
          {allReady ? 'Mark Order Ready' : 'All Items Ready'}
        </Button>
      </Box>
    </Paper>
  );
}

export default function KDSPage() {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const { socket, joinRoom } = useWebSocket();
  const [filter, setFilter] = useState<string>('ALL');

  useEffect(() => {
    joinRoom('kds');
  }, []);

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['kds-orders'],
    queryFn: () => ordersApi.getKDS().then((r) => r.data),
    refetchInterval: 10_000,
  });

  // Listen to real-time updates
  useEffect(() => {
    if (!socket) return;
    const handler = () => queryClient.invalidateQueries({ queryKey: ['kds-orders'] });
    socket.on('kds:new-order', handler);
    socket.on('order:update', handler);
    return () => { socket.off('kds:new-order', handler); socket.off('order:update', handler); };
  }, [socket, queryClient]);

  const itemStatusMutation = useMutation({
    mutationFn: ({ orderId, itemId, status }: { orderId: number; itemId: number; status: string }) =>
      apiClient.patch(`/orders/${orderId}/items/${itemId}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kds-orders'] }),
    onError: (e: any) => enqueueSnackbar(e.message, { variant: 'error' }),
  });

  const orderReadyMutation = useMutation({
    mutationFn: (orderId: number) => ordersApi.updateStatus(orderId, 'READY'),
    onSuccess: () => {
      enqueueSnackbar('Order marked ready!', { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['kds-orders'] });
    },
  });

  const handleItemReady = (orderId: number, itemId: number) => {
    // Cycle: SENT -> IN_PROGRESS -> READY
    const order = orders.find((o) => o.id === orderId);
    const item = order?.items.find((i) => i.id === itemId);
    if (!item) return;
    const nextStatus = item.status === 'SENT' ? 'IN_PROGRESS' : 'READY';
    itemStatusMutation.mutate({ orderId, itemId, status: nextStatus });
  };

  const filteredOrders = filter === 'ALL' ? orders : orders.filter((o) => o.type === filter);

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#111111' }}>
      {/* KDS Header */}
      <Box sx={{ px: 3, py: 2, bgcolor: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 2 }}>
        <Kitchen color="warning" sx={{ fontSize: 28 }} />
        <Typography variant="h5" fontWeight={800}>Kitchen Display</Typography>
        <Badge badgeContent={orders.length} color="error" sx={{ ml: 1 }} />

        <Box ml="auto" display="flex" gap={1} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <MenuItem value="ALL">All Orders</MenuItem>
              <MenuItem value="DINE_IN">Dine In</MenuItem>
              <MenuItem value="TO_GO">To Go</MenuItem>
              <MenuItem value="BAR">Bar</MenuItem>
            </Select>
          </FormControl>
          <IconButton onClick={() => refetch()} size="small" color="primary">
            <Refresh />
          </IconButton>
        </Box>
      </Box>

      {/* Tickets */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {isLoading ? (
          <Box display="flex" justifyContent="center" pt={8}><CircularProgress size={48} /></Box>
        ) : filteredOrders.length === 0 ? (
          <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="100%" gap={2} color="text.secondary">
            <CheckCircle sx={{ fontSize: 80, opacity: 0.3 }} />
            <Typography variant="h5">All caught up!</Typography>
            <Typography variant="body2">No active kitchen tickets</Typography>
          </Box>
        ) : (
          <Grid container spacing={2} alignItems="flex-start">
            {filteredOrders.map((order) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={order.id}>
                <KDSTicket
                  order={order}
                  onItemReady={handleItemReady}
                  onOrderReady={(id) => orderReadyMutation.mutate(id)}
                />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    </Box>
  );
}
