import React, { useState } from 'react';
import {
  Box, Paper, Typography, Stack, Chip, IconButton, Button, Divider,
  TextField, Badge, Tooltip, Menu, MenuItem as MuiMenuItem, CircularProgress,
  Select, FormControl, InputLabel, Dialog, DialogTitle, DialogContent, DialogActions,
  List, ListItem, ListItemText, Collapse,
} from '@mui/material';
import {
  Delete, Send, Payment, ExpandMore, ExpandLess, Note, Remove, Add,
  MoreVert, TableRestaurant, SwapHoriz, LocalOffer, Receipt, Void, Cancel,
  SplitscreenOutlined, PersonAdd,
} from '@mui/icons-material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { ordersApi } from '@/api/orders.api';
import { useOrderStore } from '@/store/orderStore';
import type { Order, OrderItem, OrderStatus } from '@/types';
import { extractError } from '@/api/client';
import { formatDistanceToNow } from 'date-fns';

interface OrderItemRowProps {
  item: OrderItem;
  orderId: number;
  onRefresh: () => void;
}

function OrderItemRow({ item, orderId, onRefresh }: OrderItemRowProps) {
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState(item.notes ?? '');
  const { enqueueSnackbar } = useSnackbar();

  const voidMutation = useMutation({
    mutationFn: (reason: string) => ordersApi.voidItem(orderId, item.id, reason),
    onSuccess: () => { enqueueSnackbar('Item voided', { variant: 'warning' }); onRefresh(); },
    onError: (e) => enqueueSnackbar(extractError(e), { variant: 'error' }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { quantity?: number; notes?: string }) => ordersApi.updateItem(orderId, item.id, data),
    onSuccess: () => onRefresh(),
  });

  if (item.status === 'VOIDED') {
    return (
      <ListItem sx={{ opacity: 0.4, textDecoration: 'line-through', py: 0.5 }}>
        <ListItemText primary={`${item.quantity}x ${item.menuItem.name}`} primaryTypographyProps={{ fontSize: '0.85rem' }} />
        <Typography variant="caption" color="error">VOID</Typography>
      </ListItem>
    );
  }

  const itemTotal = (Number(item.unitPrice) * item.quantity + item.modifiers.reduce((s, m) => s + Number(m.price), 0) * item.quantity).toFixed(2);

  return (
    <Box sx={{ borderBottom: '1px solid rgba(255,255,255,0.04)', py: 0.75 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" px={1.5}>
        <Box flex={1}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <IconButton size="small" onClick={() => updateMutation.mutate({ quantity: Math.max(1, item.quantity - 1) })} disabled={item.quantity <= 1 || item.status !== 'PENDING'}>
                <Remove sx={{ fontSize: 14 }} />
              </IconButton>
              <Typography variant="body2" fontWeight={700} sx={{ minWidth: 20, textAlign: 'center' }}>{item.quantity}</Typography>
              <IconButton size="small" onClick={() => updateMutation.mutate({ quantity: item.quantity + 1 })} disabled={item.status !== 'PENDING'}>
                <Add sx={{ fontSize: 14 }} />
              </IconButton>
            </Stack>
            <Typography variant="body2" fontWeight={500}>{item.menuItem.name}</Typography>
            {item.status !== 'PENDING' && <Chip label={item.status} size="small" color="success" sx={{ fontSize: '0.6rem', height: 16 }} />}
            {item.course > 1 && <Chip label={`Course ${item.course}`} size="small" sx={{ fontSize: '0.6rem', height: 16 }} />}
          </Stack>
          {item.modifiers.length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 7.5, display: 'block' }}>
              + {item.modifiers.map((m) => m.modifier.name).join(', ')}
            </Typography>
          )}
          {item.notes && (
            <Typography variant="caption" color="warning.main" sx={{ ml: 7.5, display: 'block' }}>
              📝 {item.notes}
            </Typography>
          )}
        </Box>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography variant="body2" fontWeight={700}>${itemTotal}</Typography>
          <Tooltip title="Add note">
            <IconButton size="small" onClick={() => setNotesOpen(!notesOpen)}>
              <Note sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
          {item.status === 'PENDING' && (
            <Tooltip title="Void item">
              <IconButton size="small" color="error" onClick={() => voidMutation.mutate('Voided by server')}>
                <Delete sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Stack>
      <Collapse in={notesOpen}>
        <Stack direction="row" spacing={1} px={1.5} pb={1} mt={0.5}>
          <TextField value={notes} onChange={(e) => setNotes(e.target.value)} size="small" placeholder="Item note..." fullWidth />
          <Button size="small" variant="outlined" onClick={() => { updateMutation.mutate({ notes }); setNotesOpen(false); }}>Save</Button>
        </Stack>
      </Collapse>
    </Box>
  );
}

interface Props {
  order: Order | null;
  onClose: () => void;
  onPay: () => void;
  onSendToKitchen: () => void;
  onAddItems: () => void;
  onRefresh: () => void;
}

export default function OrderPanel({ order, onClose, onPay, onSendToKitchen, onAddItems, onRefresh }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const [moreAnchor, setMoreAnchor] = useState<null | HTMLElement>(null);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');

  const sendMutation = useMutation({
    mutationFn: () => ordersApi.sendToKitchen(order!.id),
    onSuccess: () => {
      enqueueSnackbar('Sent to kitchen!', { variant: 'success' });
      onSendToKitchen();
    },
    onError: (e) => enqueueSnackbar(extractError(e), { variant: 'error' }),
  });

  const voidMutation = useMutation({
    mutationFn: () => ordersApi.void(order!.id, voidReason),
    onSuccess: () => { enqueueSnackbar('Order voided', { variant: 'warning' }); setVoidDialogOpen(false); onClose(); },
    onError: (e) => enqueueSnackbar(extractError(e), { variant: 'error' }),
  });

  if (!order) {
    return (
      <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2, color: 'text.secondary', p: 4 }}>
        <TableRestaurant sx={{ fontSize: 64, opacity: 0.3 }} />
        <Typography variant="h6" color="text.secondary">Select a table or start a new order</Typography>
        <Button variant="contained" onClick={() => onAddItems()}>New To-Go Order</Button>
      </Box>
    );
  }

  const activeItems = order.items.filter((i) => i.status !== 'VOIDED');
  const hasPendingItems = order.items.some((i) => i.status === 'PENDING');
  const canPay = order.status !== 'PAID' && order.status !== 'VOIDED' && activeItems.length > 0;

  const statusColor: Record<string, 'default' | 'warning' | 'success' | 'error' | 'primary'> = {
    OPEN: 'primary', SENT_TO_KITCHEN: 'warning', IN_PROGRESS: 'warning', READY: 'success', PAID: 'success', VOIDED: 'error',
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'transparent' }}>
      {/* Order header */}
      <Box sx={{ px: 2, py: 1.5, bgcolor: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box flex={1} minWidth={0}>
            <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap">
              <Typography variant="h6" fontWeight={800} noWrap>#{order.orderNumber}</Typography>
              <Chip label={order.status.replace('_', ' ')} size="small" color={statusColor[order.status]} />
              <Chip label={order.type.replace('_', ' ')} size="small" variant="outlined" />
            </Stack>
            <Stack direction="row" spacing={1.5} mt={0.25}>
              {order.table && <Typography variant="caption" color="text.secondary">Table: <b>{order.table.name}</b></Typography>}
              {order.server && <Typography variant="caption" color="text.secondary">Server: <b>{order.server.firstName}</b></Typography>}
              {order.guestCount && <Typography variant="caption" color="text.secondary">👥 {order.guestCount}</Typography>}
              <Typography variant="caption" color="text.secondary">{formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}</Typography>
            </Stack>
          </Box>
          <Stack direction="row" spacing={0.5}>
            <IconButton size="small" onClick={(e) => setMoreAnchor(e.currentTarget)}>
              <MoreVert />
            </IconButton>
            <IconButton size="small" onClick={onClose}><Cancel fontSize="small" /></IconButton>
          </Stack>
        </Stack>
      </Box>

      {/* Items */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {activeItems.length === 0 && order.items.every((i) => i.status === 'VOIDED') ? (
          <Box p={4} textAlign="center" color="text.secondary">
            <Typography>All items voided</Typography>
          </Box>
        ) : (
          <List disablePadding>
            {order.items.map((item) => (
              <OrderItemRow key={item.id} item={item} orderId={order.id} onRefresh={onRefresh} />
            ))}
          </List>
        )}
        <Box px={2} py={1}>
          <Button startIcon={<Add />} size="small" fullWidth variant="outlined" sx={{ borderStyle: 'dashed' }} onClick={onAddItems}>
            Add Items
          </Button>
        </Box>
      </Box>

      {/* Order totals */}
      <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', p: 2, bgcolor: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)' }}>
        <Stack spacing={0.75}>
          {order.discounts.length > 0 && order.discounts.map((d) => (
            <Stack key={d.id} direction="row" justifyContent="space-between">
              <Typography variant="caption" color="success.main">🏷 {d.discount.name}</Typography>
              <Typography variant="caption" color="success.main">-${Number(d.amount).toFixed(2)}</Typography>
            </Stack>
          ))}
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">Subtotal</Typography>
            <Typography variant="body2">${Number(order.subtotal).toFixed(2)}</Typography>
          </Stack>
          {Number(order.discountAmount) > 0 && (
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="success.main">Discount</Typography>
              <Typography variant="body2" color="success.main">-${Number(order.discountAmount).toFixed(2)}</Typography>
            </Stack>
          )}
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">Tax</Typography>
            <Typography variant="body2">${Number(order.taxAmount).toFixed(2)}</Typography>
          </Stack>
          {Number(order.tipAmount) > 0 && (
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">Tip</Typography>
              <Typography variant="body2">${Number(order.tipAmount).toFixed(2)}</Typography>
            </Stack>
          )}
          <Divider />
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" fontWeight={800}>Total</Typography>
            <Typography variant="h5" fontWeight={800} color="primary">${Number(order.total).toFixed(2)}</Typography>
          </Stack>
        </Stack>

        {/* Action buttons */}
        <Stack spacing={1} mt={2}>
          {hasPendingItems && (
            <Button variant="outlined" color="warning" fullWidth startIcon={<Send />} onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending}>
              {sendMutation.isPending ? <CircularProgress size={20} /> : 'Fire to Kitchen'}
            </Button>
          )}
          {canPay && (
            <Button variant="contained" color="success" fullWidth size="large" startIcon={<Payment />} onClick={onPay}
              sx={{ fontSize: '1.1rem', py: 1.5 }}>
              Charge ${Number(order.total).toFixed(2)}
            </Button>
          )}
        </Stack>
      </Box>

      {/* More menu */}
      <Menu anchorEl={moreAnchor} open={Boolean(moreAnchor)} onClose={() => setMoreAnchor(null)}>
        <MuiMenuItem onClick={() => { setMoreAnchor(null); }}>
          <SwapHoriz sx={{ mr: 1 }} fontSize="small" /> Transfer Table
        </MuiMenuItem>
        <MuiMenuItem onClick={() => { setMoreAnchor(null); }}>
          <LocalOffer sx={{ mr: 1 }} fontSize="small" /> Apply Discount
        </MuiMenuItem>
        <MuiMenuItem onClick={() => { setMoreAnchor(null); }}>
          <SplitscreenOutlined sx={{ mr: 1 }} fontSize="small" /> Split Check
        </MuiMenuItem>
        <MuiMenuItem onClick={() => { setMoreAnchor(null); }}>
          <PersonAdd sx={{ mr: 1 }} fontSize="small" /> Add Customer
        </MuiMenuItem>
        <MuiMenuItem onClick={() => { setMoreAnchor(null); }}>
          <Receipt sx={{ mr: 1 }} fontSize="small" /> Print Receipt
        </MuiMenuItem>
        <Divider />
        <MuiMenuItem sx={{ color: 'error.main' }} onClick={() => { setMoreAnchor(null); setVoidDialogOpen(true); }}>
          <Cancel sx={{ mr: 1 }} fontSize="small" /> Void Order
        </MuiMenuItem>
      </Menu>

      {/* Void dialog */}
      <Dialog open={voidDialogOpen} onClose={() => setVoidDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Void Order #{order.orderNumber}?</DialogTitle>
        <DialogContent>
          <TextField label="Reason (optional)" fullWidth value={voidReason} onChange={(e) => setVoidReason(e.target.value)} autoFocus sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVoidDialogOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => voidMutation.mutate()} disabled={voidMutation.isPending}>
            Void Order
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
