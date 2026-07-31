import React, { useState } from 'react';
import {
  Box, Grid, Paper, Typography, Chip, Stack, IconButton, Button,
  Tooltip, Menu, MenuItem as MuiMenuItem, Select, FormControl, InputLabel,
  Badge, CircularProgress,
} from '@mui/material';
import {
  Add, People, AccessTime, TableRestaurant, MoreVert, SwapHoriz,
  FilterList, Refresh, AddCircle, Cancel,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { tablesApi } from '@/api/tables.api';
import { ordersApi } from '@/api/orders.api';
import { useOrderStore } from '@/store/orderStore';
import { useUIStore } from '@/store/uiStore';
import type { Table, Order, TableStatus, OrderType } from '@/types';
import { formatDistanceToNow } from 'date-fns';

const STATUS_COLORS: Record<TableStatus, string> = {
  AVAILABLE: '#57a300',
  OCCUPIED: '#c42b1c',
  RESERVED: '#c19c00',
  CLEANING: '#0078d4',
};

const STATUS_LABELS: Record<TableStatus, string> = {
  AVAILABLE: 'Available',
  OCCUPIED: 'Occupied',
  RESERVED: 'Reserved',
  CLEANING: 'Cleaning',
};

interface TableCardProps {
  table: Table;
  onSelect: (table: Table) => void;
  isActive: boolean;
}

function TableCard({ table, onSelect, isActive }: TableCardProps) {
  const activeOrder = table.orders?.[0];
  const statusColor = STATUS_COLORS[table.status];

  return (
    <Paper
      onClick={() => onSelect(table)}
      elevation={0}
      sx={{
        p: 2, cursor: 'pointer', height: 140, position: 'relative', overflow: 'hidden',
        borderRadius: 1,
        border: isActive ? `1px solid #0078d4` : '1px solid rgba(255,255,255,0.1)',
        bgcolor: isActive ? 'rgba(0,120,212,0.08)' : '#1e1e1e',
        borderLeft: `3px solid ${statusColor}`,
        transition: 'border-color 0.1s ease, background-color 0.1s ease',
        '&:hover': { bgcolor: '#2a2a2a', borderColor: isActive ? '#0078d4' : 'rgba(255,255,255,0.2)' },
      }}
    >
      {/* Status dot */}
      <Box sx={{ position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: '50%', bgcolor: statusColor }} />

      <Typography variant="subtitle1" fontWeight={600} sx={{ lineHeight: 1.2 }}>
        {table.name}
      </Typography>

      <Stack direction="row" alignItems="center" spacing={0.5} mt={0.5}>
        <People sx={{ fontSize: 14, color: 'text.secondary' }} />
        <Typography variant="caption" color="text.secondary">{table.capacity} seats</Typography>
        {table.section && <Chip label={table.section} size="small" sx={{ fontSize: '0.6rem', height: 16 }} />}
      </Stack>

      {activeOrder ? (
        <Box mt={1.5}>
          <Typography variant="caption" color="text.secondary" display="block">
            #{activeOrder.orderNumber}
          </Typography>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mt={0.5}>
            <Typography variant="body2" fontWeight={600} color="primary">
              ${Number(activeOrder.total ?? 0).toFixed(2)}
            </Typography>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <AccessTime sx={{ fontSize: 12, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">
                {formatDistanceToNow(new Date(activeOrder.createdAt!), { addSuffix: false })}
              </Typography>
            </Stack>
          </Stack>
          <Chip label={activeOrder.status?.replace('_', ' ')} size="small" color="warning" sx={{ mt: 0.5, fontSize: '0.7rem' }} />
        </Box>
      ) : (
        <Stack mt={2} alignItems="flex-start">
          <Typography variant="caption" sx={{ color: statusColor, fontWeight: 600 }}>{STATUS_LABELS[table.status]}</Typography>
        </Stack>
      )}
    </Paper>
  );
}

interface Props {
  onOrderSelected: (order: Order) => void;
  onNewOrder: (table?: Table) => void;
}

export default function TableLayout({ onOrderSelected, onNewOrder }: Props) {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { activeOrderId } = useOrderStore();
  const { activeSection, setActiveSection } = useUIStore();
  const [filterStatus, setFilterStatus] = useState<string>('');

  const { data: sections = [] } = useQuery({
    queryKey: ['table-sections'],
    queryFn: () => tablesApi.getSections().then((r) => r.data),
  });

  const { data: tables = [], isLoading, refetch } = useQuery({
    queryKey: ['tables', activeSection, filterStatus],
    queryFn: () => tablesApi.getAll(activeSection !== 'All' ? activeSection : undefined).then((r) => r.data),
    refetchInterval: 15_000,
  });

  const filteredTables = filterStatus
    ? tables.filter((t) => t.status === filterStatus)
    : tables;

  const handleTableSelect = (table: Table) => {
    if (table.status === 'OCCUPIED' && table.orders?.[0]) {
      // Load existing order
      const orderId = table.orders[0].id!;
      ordersApi.get(orderId).then((r) => {
        onOrderSelected(r.data);
      });
    } else {
      // Create new order for this table
      onNewOrder(table);
    }
  };

  const allSections = ['All', ...sections];

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ px: 3, py: 2, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 2, bgcolor: '#1e1e1e' }}>
        <TableRestaurant color="primary" />
        <Typography variant="h6" fontWeight={700}>Floor Plan</Typography>

        {/* Section tabs */}
        <Stack direction="row" spacing={1} ml={2}>
          {allSections.map((s) => (
            <Chip
              key={s}
              label={s}
              clickable
              onClick={() => setActiveSection(s)}
              variant={activeSection === s ? 'filled' : 'outlined'}
              color={activeSection === s ? 'primary' : 'default'}
              size="small"
            />
          ))}
        </Stack>

        <Box ml="auto" display="flex" gap={1} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} displayEmpty>
              <MuiMenuItem value="">All Status</MuiMenuItem>
              {Object.entries(STATUS_LABELS).map(([v, l]) => <MuiMenuItem key={v} value={v}>{l}</MuiMenuItem>)}
            </Select>
          </FormControl>
          <Tooltip title="Refresh">
            <IconButton onClick={() => refetch()} size="small">
              <Refresh fontSize="small" />
            </IconButton>
          </Tooltip>
          <Button variant="contained" size="small" startIcon={<Add />} onClick={() => onNewOrder()}>
            New Order
          </Button>
        </Box>
      </Box>

      {/* Stats bar */}
      <Box sx={{ px: 3, py: 1, bgcolor: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', gap: 3 }}>
        {Object.entries(STATUS_LABELS).map(([status, label]) => {
          const count = tables.filter((t) => t.status === status).length;
          return (
            <Stack key={status} direction="row" alignItems="center" spacing={0.75}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: STATUS_COLORS[status as TableStatus] }} />
              <Typography variant="caption" color="text.secondary">{label}:</Typography>
              <Typography variant="caption" fontWeight={700}>{count}</Typography>
            </Stack>
          );
        })}
      </Box>

      {/* Table grid */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        {isLoading ? (
          <Box display="flex" justifyContent="center" pt={8}>
            <CircularProgress />
          </Box>
        ) : filteredTables.length === 0 ? (
          <Box display="flex" justifyContent="center" pt={8}>
            <Typography color="text.secondary">No tables found</Typography>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {filteredTables.map((table) => (
              <Grid item key={table.id} xs={6} sm={4} md={3} lg={2}>
                <TableCard
                  table={table}
                  onSelect={handleTableSelect}
                  isActive={table.orders?.[0]?.id === activeOrderId}
                />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    </Box>
  );
}
