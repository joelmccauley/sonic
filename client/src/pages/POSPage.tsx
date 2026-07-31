import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { tablesApi } from '@/api/tables.api';
import { useOrderStore } from '@/store/orderStore';
import TableLayout from '@/components/pos/TableLayout';
import NewOrderDialog from '@/components/pos/NewOrderDialog';
import OrderBuilder from '@/components/pos/OrderBuilder';
import type { Order, Table } from '@/types';

export default function POSPage() {
  const { activeOrder, setActiveOrder } = useOrderStore();
  const location = useLocation();

  const [newOrderDialogOpen, setNewOrderDialogOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);

  const { refetch: refetchTables } = useQuery({
    queryKey: ['tables'],
    queryFn: () => tablesApi.getAll().then((r) => r.data),
  });

  const openBuilder = (order: Order) => {
    setActiveOrder(order);
    setBuilderOpen(true);
  };

  const handleTableSelect = (order: Order) => openBuilder(order);

  const handleNewOrder = (table?: Table) => {
    setSelectedTable(table ?? null);
    setNewOrderDialogOpen(true);
  };

  // Auto-open builder when navigated from Floor View after order creation
  useEffect(() => {
    const autoOrder = (location.state as any)?.autoOrder as Order | undefined;
    if (autoOrder) {
      openBuilder(autoOrder);
      window.history.replaceState({}, '');
    }
  }, []);

  // Auto-open builder + payment when navigated from Floor View for a ready order
  useEffect(() => {
    const autoOrder = (location.state as any)?.autoPayOrder as Order | undefined;
    if (autoOrder) {
      openBuilder(autoOrder);
      window.history.replaceState({}, '');
    }
  }, []);

  return (
    <Box sx={{ height: '100vh', display: 'flex', overflow: 'hidden' }}>
      <TableLayout onOrderSelected={handleTableSelect} onNewOrder={handleNewOrder} />

      {/* New order dialog */}
      <NewOrderDialog
        open={newOrderDialogOpen}
        table={selectedTable}
        onClose={() => setNewOrderDialogOpen(false)}
        onSuccess={(order) => {
          refetchTables();
          openBuilder(order);
        }}
      />

      {/* Full-screen order builder */}
      <OrderBuilder
        open={builderOpen}
        order={activeOrder}
        onClose={() => { setBuilderOpen(false); refetchTables(); }}
        onPaymentSuccess={() => { setBuilderOpen(false); setActiveOrder(null); refetchTables(); }}
      />
    </Box>
  );
}
