/**
 * OrderBuilder — shared full-screen order-building panel.
 *
 * Renders MenuGrid (left) + OrderPanel (right) together with
 * ModifierModal and PaymentModal included.
 *
 * Intended to be shown as a Dialog overlay from any page so
 * users never have to navigate away to place or edit an order.
 */
import React, { useState, useCallback } from 'react';
import {
  Dialog, Box, Button, Typography, IconButton, Tooltip,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import { ordersApi } from '@/api/orders.api';
import { useOrderStore } from '@/store/orderStore';
import MenuGrid from '@/components/pos/MenuGrid';
import OrderPanel from '@/components/pos/OrderPanel';
import ModifierModal from '@/components/pos/ModifierModal';
import PaymentModal from '@/components/pos/PaymentModal';
import type { Order, MenuItem as MenuItemType } from '@/types';

interface Props {
  /** Whether the builder is visible */
  open: boolean;
  /** Initial order to load. When provided the builder sets it as active. */
  order: Order | null;
  /** Label shown in the top bar, e.g. "Table 4" */
  context?: string;
  /** If true, the payment modal opens immediately when the builder mounts */
  autoOpenPayment?: boolean;
  /** Called when the user closes / backs out without paying */
  onClose: () => void;
  /** Called after a successful payment */
  onPaymentSuccess?: () => void;
}

export default function OrderBuilder({ open, order, context, autoOpenPayment, onClose, onPaymentSuccess }: Props) {
  const qc = useQueryClient();
  const { setActiveOrder } = useOrderStore();

  const [activeOrder, setLocalOrder] = useState<Order | null>(order);
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItemType | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);

  // Sync when the order prop changes (e.g. after creation)
  React.useEffect(() => {
    setLocalOrder(order);
    if (open && autoOpenPayment && order) setPaymentOpen(true);
  }, [order?.id]);

  const refresh = useCallback(() => {
    if (!activeOrder) return;
    ordersApi.get(activeOrder.id).then((r) => {
      setLocalOrder(r.data);
      setActiveOrder(r.data);
    });
  }, [activeOrder?.id]);

  const handleSentToKitchen = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['tables'] });
    qc.invalidateQueries({ queryKey: ['tables-floorview'] });
    onClose();
  }, [qc, onClose]);

  const handlePaymentSuccess = () => {
    setPaymentOpen(false);
    setLocalOrder(null);
    setActiveOrder(null);
    qc.invalidateQueries({ queryKey: ['tables'] });
    qc.invalidateQueries({ queryKey: ['tables-floorview'] });
    onPaymentSuccess?.();
    onClose();
  };

  const handleClose = () => {
    // Keep order in the store so it stays "active" in POS if the user returns
    setActiveOrder(activeOrder);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullScreen
      PaperProps={{ sx: { bgcolor: '#141414', display: 'flex', flexDirection: 'column' } }}
    >
      {/* Top bar */}
      <Box sx={{
        px: 2, py: 1,
        display: 'flex', alignItems: 'center', gap: 2,
        bgcolor: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        flexShrink: 0,
      }}>
        <Tooltip title="Close order builder">
          <IconButton size="small" onClick={handleClose}>
            <ArrowBack />
          </IconButton>
        </Tooltip>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          {activeOrder
            ? <>Adding items to <b>#{activeOrder.orderNumber}</b>{context ? ` — ${context}` : activeOrder.table ? ` — Table ${activeOrder.table.name}` : ''}</>
            : 'Order Builder'}
        </Typography>
      </Box>

      {/* Body: menu left, order right */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <MenuGrid onItemSelect={(item) => setSelectedMenuItem(item)} />
        </Box>
        <Box sx={{ width: 360, borderLeft: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <OrderPanel
            order={activeOrder}
            onClose={handleClose}
            onPay={() => setPaymentOpen(true)}
            onSendToKitchen={handleSentToKitchen}
            onAddItems={() => {/* already showing menu */}}
            onRefresh={refresh}
          />
        </Box>
      </Box>

      {/* Modifier modal */}
      <ModifierModal
        item={selectedMenuItem}
        orderId={activeOrder?.id ?? 0}
        onClose={() => setSelectedMenuItem(null)}
        onAdded={refresh}
      />

      {/* Payment modal */}
      <PaymentModal
        open={paymentOpen}
        order={activeOrder}
        onClose={() => setPaymentOpen(false)}
        onSuccess={handlePaymentSuccess}
      />
    </Dialog>
  );
}
