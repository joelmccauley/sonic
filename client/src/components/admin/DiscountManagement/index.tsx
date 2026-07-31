import React, { useState } from 'react';
import {
  Box, Paper, Typography, Stack, Chip, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Switch, FormControlLabel, Select, MenuItem, FormControl,
  InputLabel, CircularProgress, InputAdornment, Alert,
} from '@mui/material';
import { Add, Edit, ToggleOn, ToggleOff } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { discountsApi } from '@/api/discounts.api';
import type { Discount, DiscountType } from '@/types';
import { extractError } from '@/api/client';

function DiscountDialog({ open, onClose, discount }: { open: boolean; onClose: () => void; discount?: Discount }) {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [name, setName] = useState(discount?.name ?? '');
  const [type, setType] = useState<DiscountType>(discount?.type ?? 'PERCENTAGE');
  const [value, setValue] = useState(String(discount?.value ?? ''));
  const [requiresPin, setRequiresPin] = useState(discount?.requiresPin ?? false);
  const [minOrder, setMinOrder] = useState(String(discount?.minOrder ?? ''));
  const [description, setDescription] = useState(discount?.description ?? '');

  const mutation = useMutation({
    mutationFn: () => {
      const data = { name, type, value: parseFloat(value), requiresPin, minOrder: minOrder ? parseFloat(minOrder) : undefined, description };
      return discount ? discountsApi.update(discount.id, data) : discountsApi.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
      enqueueSnackbar(discount ? 'Discount updated' : 'Discount created', { variant: 'success' });
      onClose();
    },
    onError: (e) => enqueueSnackbar(extractError(e), { variant: 'error' }),
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { bgcolor: '#242424' } }}>
      <DialogTitle>{discount ? 'Edit Discount' : 'New Discount'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth required />
          <FormControl fullWidth>
            <InputLabel>Type</InputLabel>
            <Select value={type} label="Type" onChange={(e) => setType(e.target.value as DiscountType)}>
              <MenuItem value="PERCENTAGE">Percentage (%)</MenuItem>
              <MenuItem value="FLAT">Flat Amount ($)</MenuItem>
              <MenuItem value="COMP">Full Comp (100%)</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label={type === 'PERCENTAGE' ? 'Percentage' : type === 'FLAT' ? 'Amount' : 'N/A'}
            type="number" value={value} onChange={(e) => setValue(e.target.value)} fullWidth
            disabled={type === 'COMP'}
            InputProps={{ endAdornment: <InputAdornment position="end">{type === 'PERCENTAGE' ? '%' : '$'}</InputAdornment> }}
          />
          <TextField label="Minimum Order ($, optional)" type="number" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} fullWidth />
          <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth />
          <FormControlLabel control={<Switch checked={requiresPin} onChange={(e) => setRequiresPin(e.target.checked)} />} label="Requires Manager PIN" />
          {requiresPin && <Alert severity="warning" sx={{ py: 0.5 }}>Applying this discount will prompt for a manager PIN at the POS</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => mutation.mutate()} disabled={mutation.isPending || !name || (!value && type !== 'COMP')}>
          {mutation.isPending ? <CircularProgress size={20} /> : discount ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function DiscountManagement() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [dialog, setDialog] = useState<{ open: boolean; discount?: Discount }>({ open: false });

  const { data: discounts = [], isLoading } = useQuery({ queryKey: ['discounts'], queryFn: () => discountsApi.getAll().then((r) => r.data) });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => discountsApi.toggle(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['discounts'] }),
    onError: (e) => enqueueSnackbar(extractError(e), { variant: 'error' }),
  });

  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={700}>Discounts & Promos</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setDialog({ open: true })}>Add Discount</Button>
      </Stack>

      <TableContainer component={Paper} sx={{ bgcolor: '#1e1e1e' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Value</TableCell>
              <TableCell>Min Order</TableCell>
              <TableCell>Requires PIN</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} align="center"><CircularProgress sx={{ my: 2 }} /></TableCell></TableRow>
            ) : discounts.map((d) => (
              <TableRow key={d.id}>
                <TableCell><Typography fontWeight={600}>{d.name}</Typography><Typography variant="caption" color="text.secondary">{d.description}</Typography></TableCell>
                <TableCell><Chip label={d.type} size="small" /></TableCell>
                <TableCell>
                  {d.type === 'PERCENTAGE' ? `${d.value}%` : d.type === 'FLAT' ? `$${d.value}` : 'Full Comp'}
                </TableCell>
                <TableCell>{d.minOrder ? `$${d.minOrder}` : '—'}</TableCell>
                <TableCell>{d.requiresPin ? <Chip label="Yes" size="small" color="warning" /> : '—'}</TableCell>
                <TableCell><Chip label={d.isActive ? 'Active' : 'Inactive'} size="small" color={d.isActive ? 'success' : 'default'} /></TableCell>
                <TableCell align="right">
                  <Stack direction="row" justifyContent="flex-end" spacing={0.5}>
                    <Button size="small" startIcon={<Edit />} onClick={() => setDialog({ open: true, discount: d })}>Edit</Button>
                    <Button size="small" color={d.isActive ? 'error' : 'success'} onClick={() => toggleMutation.mutate(d.id)}>
                      {d.isActive ? 'Disable' : 'Enable'}
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <DiscountDialog open={dialog.open} discount={dialog.discount} onClose={() => setDialog({ open: false })} />
    </Box>
  );
}
