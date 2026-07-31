import React, { useState } from 'react';
import {
  Box, Paper, Typography, Stack, Chip, Button, IconButton, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, CircularProgress, Alert, LinearProgress, Tooltip,
} from '@mui/material';
import { Warning, Add, Remove, Edit } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { apiClient } from '@/api/client';
import type { InventoryItem } from '@/types';
import { extractError } from '@/api/client';

function AdjustDialog({ open, onClose, item }: { open: boolean; onClose: () => void; item: InventoryItem }) {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [isAdd, setIsAdd] = useState(true);

  const mutation = useMutation({
    mutationFn: () => apiClient.patch(`/inventory/${item.id}/adjust`, { amount: isAdd ? parseFloat(amount) : -parseFloat(amount), reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      enqueueSnackbar('Inventory adjusted', { variant: 'success' });
      onClose();
    },
    onError: (e) => enqueueSnackbar(extractError(e), { variant: 'error' }),
  });

  const newQty = (item.quantity ?? 0) + (isAdd ? parseFloat(amount || '0') : -parseFloat(amount || '0'));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { bgcolor: '#242424' } }}>
      <DialogTitle>Adjust Inventory — {item.menuItem?.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" p={1.5} sx={{ bgcolor: '#141414', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">Current Quantity</Typography>
            <Typography variant="h6" fontWeight={800}>{item.quantity} {item.unit}</Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button fullWidth variant={isAdd ? 'contained' : 'outlined'} color="success" startIcon={<Add />} onClick={() => setIsAdd(true)}>Add Stock</Button>
            <Button fullWidth variant={!isAdd ? 'contained' : 'outlined'} color="error" startIcon={<Remove />} onClick={() => setIsAdd(false)}>Remove</Button>
          </Stack>
          <TextField label="Amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} fullWidth required inputProps={{ min: 0.01, step: 0.01 }} InputProps={{ endAdornment: item.unit }} />
          <TextField label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} fullWidth placeholder="Received delivery, waste, etc." />
          {amount && (
            <Alert severity={newQty <= (item.lowThreshold ?? 0) ? 'warning' : 'info'} sx={{ py: 0.5 }}>
              New quantity: <strong>{newQty.toFixed(2)} {item.unit}</strong>
              {newQty <= (item.lowThreshold ?? 0) && ' — Below low stock threshold!'}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => mutation.mutate()} disabled={mutation.isPending || !amount}>
          {mutation.isPending ? <CircularProgress size={20} /> : 'Adjust'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function InventoryManagement() {
  const { enqueueSnackbar } = useSnackbar();
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [search, setSearch] = useState('');

  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => apiClient.get<InventoryItem[]>('/inventory').then((r) => r.data),
    refetchInterval: 30_000,
  });

  const { data: lowStock = [] } = useQuery({
    queryKey: ['inventory-low'],
    queryFn: () => apiClient.get<InventoryItem[]>('/inventory/low-stock').then((r) => r.data),
  });

  const filtered = inventory.filter((i) => !search || i.menuItem?.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={700}>Inventory Management</Typography>
        <TextField size="small" placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} sx={{ width: 220 }} />
      </Stack>

      {lowStock.length > 0 && (
        <Alert severity="warning" icon={<Warning />} sx={{ mb: 3 }}>
          <strong>{lowStock.length} items</strong> are below low stock threshold: {lowStock.map((i) => i.menuItem?.name).join(', ')}
        </Alert>
      )}

      <TableContainer component={Paper} sx={{ bgcolor: '#1e1e1e' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Item</TableCell>
              <TableCell align="right">Quantity</TableCell>
              <TableCell align="right">Low Threshold</TableCell>
              <TableCell>Stock Level</TableCell>
              <TableCell>Unit</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} align="center"><CircularProgress sx={{ my: 2 }} /></TableCell></TableRow>
            ) : filtered.map((item) => {
              const pct = item.lowThreshold ? Math.min(100, ((item.quantity ?? 0) / (item.lowThreshold * 3)) * 100) : 100;
              const isLow = item.lowThreshold && (item.quantity ?? 0) <= item.lowThreshold;
              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {isLow && <Warning color="warning" fontSize="small" />}
                      <Typography fontWeight={600}>{item.menuItem?.name ?? `Item #${item.id}`}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <Typography fontWeight={800} color={isLow ? 'warning.main' : 'text.primary'}>{item.quantity ?? 0}</Typography>
                  </TableCell>
                  <TableCell align="right"><Typography color="text.secondary">{item.lowThreshold ?? '—'}</Typography></TableCell>
                  <TableCell sx={{ minWidth: 120 }}>
                    <LinearProgress variant="determinate" value={pct} color={isLow ? 'error' : pct < 50 ? 'warning' : 'success'} sx={{ height: 8, borderRadius: 4 }} />
                  </TableCell>
                  <TableCell><Chip label={item.unit} size="small" variant="outlined" /></TableCell>
                  <TableCell align="right">
                    <Button size="small" startIcon={<Edit />} onClick={() => setAdjustItem(item)}>Adjust</Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {adjustItem && <AdjustDialog open item={adjustItem} onClose={() => setAdjustItem(null)} />}
    </Box>
  );
}
