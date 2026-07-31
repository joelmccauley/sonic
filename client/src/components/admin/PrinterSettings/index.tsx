import React, { useState } from 'react';
import {
  Box, Paper, Typography, Stack, Chip, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, FormControl, InputLabel, Select, MenuItem, CircularProgress, Alert,
} from '@mui/material';
import { Add, Edit, Wifi, CheckCircle } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { apiClient } from '@/api/client';
import type { Printer, PrinterType } from '@/types';
import { extractError } from '@/api/client';

const PRINTER_TYPES: PrinterType[] = ['RECEIPT', 'KITCHEN', 'BAR', 'LABEL'];

function PrinterDialog({ open, onClose, printer }: { open: boolean; onClose: () => void; printer?: Printer }) {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [name, setName] = useState(printer?.name ?? '');
  const [type, setType] = useState<PrinterType>(printer?.type ?? 'RECEIPT');
  const [ipAddress, setIpAddress] = useState(printer?.ipAddress ?? '');
  const [port, setPort] = useState(String(printer?.port ?? 9100));

  const mutation = useMutation({
    mutationFn: () => {
      const data = { name, type, ipAddress, port: parseInt(port) };
      return printer ? apiClient.put(`/printers/${printer.id}`, data) : apiClient.post('/printers', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['printers'] });
      enqueueSnackbar(printer ? 'Printer updated' : 'Printer added', { variant: 'success' });
      onClose();
    },
    onError: (e) => enqueueSnackbar(extractError(e), { variant: 'error' }),
  });

  const testMutation = useMutation({
    mutationFn: () => apiClient.post(`/printers/${printer!.id}/test`),
    onSuccess: () => enqueueSnackbar('Test print sent!', { variant: 'success' }),
    onError: (e) => enqueueSnackbar(`Printer test failed: ${extractError(e)}`, { variant: 'error' }),
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { bgcolor: '#242424' } }}>
      <DialogTitle>{printer ? 'Edit Printer' : 'Add Printer'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <TextField label="Printer Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth required />
          <FormControl fullWidth>
            <InputLabel>Type</InputLabel>
            <Select value={type} label="Type" onChange={(e) => setType(e.target.value as PrinterType)}>
              {PRINTER_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="IP Address" value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} fullWidth placeholder="192.168.1.100" />
          <TextField label="Port" type="number" value={port} onChange={(e) => setPort(e.target.value)} fullWidth />
          <Alert severity="info" sx={{ py: 0.5 }}>
            For WiFi thermal printers (Star, Epson), connect via TCP on port 9100
          </Alert>
          {printer && (
            <Button variant="outlined" color="info" startIcon={<Wifi />} onClick={() => testMutation.mutate()} disabled={testMutation.isPending}>
              {testMutation.isPending ? <CircularProgress size={20} /> : 'Send Test Print'}
            </Button>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => mutation.mutate()} disabled={mutation.isPending || !name || !ipAddress}>
          {mutation.isPending ? <CircularProgress size={20} /> : printer ? 'Update' : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function PrinterSettings() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [dialog, setDialog] = useState<{ open: boolean; printer?: Printer }>({ open: false });

  const { data: printers = [], isLoading } = useQuery({
    queryKey: ['printers'],
    queryFn: () => apiClient.get<Printer[]>('/printers').then((r) => r.data),
  });

  const defaultMutation = useMutation({
    mutationFn: (id: number) => apiClient.patch(`/printers/${id}/default`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['printers'] }); enqueueSnackbar('Default printer updated', { variant: 'success' }); },
  });

  const testMutation = useMutation({
    mutationFn: (id: number) => apiClient.post(`/printers/${id}/test`),
    onSuccess: () => enqueueSnackbar('Test print sent!', { variant: 'success' }),
    onError: (e) => enqueueSnackbar(`Test failed: ${extractError(e)}`, { variant: 'error' }),
  });

  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={700}>Printer Settings</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setDialog({ open: true })}>Add Printer</Button>
      </Stack>

      <Alert severity="info" sx={{ mb: 3 }}>
        SonicPOS supports WiFi thermal printers via TCP/IP. Compatible with Epson, Star Micronics, Bixolon, and most ESC/POS printers.
      </Alert>

      <TableContainer component={Paper} sx={{ bgcolor: '#1e1e1e' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>IP Address</TableCell>
              <TableCell>Port</TableCell>
              <TableCell>Default</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} align="center"><CircularProgress sx={{ my: 2 }} /></TableCell></TableRow>
            ) : printers.map((p) => (
              <TableRow key={p.id}>
                <TableCell><Typography fontWeight={600}>{p.name}</Typography></TableCell>
                <TableCell><Chip label={p.type} size="small" /></TableCell>
                <TableCell><Typography variant="body2" fontFamily="monospace">{p.ipAddress ?? '—'}</Typography></TableCell>
                <TableCell><Typography variant="body2">{p.port}</Typography></TableCell>
                <TableCell>{p.isDefault ? <CheckCircle color="success" fontSize="small" /> : <Button size="small" variant="text" onClick={() => defaultMutation.mutate(p.id)}>Set Default</Button>}</TableCell>
                <TableCell align="right">
                  <Stack direction="row" justifyContent="flex-end" spacing={0.5}>
                    <Button size="small" startIcon={<Wifi />} onClick={() => testMutation.mutate(p.id)}>Test</Button>
                    <Button size="small" startIcon={<Edit />} onClick={() => setDialog({ open: true, printer: p })}>Edit</Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <PrinterDialog open={dialog.open} printer={dialog.printer} onClose={() => setDialog({ open: false })} />
    </Box>
  );
}
