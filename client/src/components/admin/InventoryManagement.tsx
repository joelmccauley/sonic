import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Paper, Stack, Chip, IconButton, Button, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions, Tab, Tabs,
  InputAdornment, Tooltip, MenuItem as MuiMenuItem, Select, FormControl,
  InputLabel, CircularProgress, Alert, Autocomplete,
} from '@mui/material';
import {
  Edit, Add, Remove, DeleteOutline, Inventory2,
  Warning, CheckCircle, ErrorOutline, Search, Refresh,
  AddCircleOutline, WidgetsOutlined,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { inventoryApi, type InventoryRow } from '@/api/inventory.api';
import { menuApi } from '@/api/menu.api';
import type { MenuItem } from '@/types';

// ── helpers ────────────────────────────────────────────────────────────────

function stockStatus(row: InventoryRow): 'ok' | 'low' | 'out' {
  const qty = Number(row.quantity);
  if (qty <= 0) return 'out';
  if (row.lowThreshold && qty <= Number(row.lowThreshold)) return 'low';
  return 'ok';
}

const STATUS_CHIP: Record<string, { label: string; color: 'success' | 'warning' | 'error' }> = {
  ok:  { label: 'In Stock',   color: 'success' },
  low: { label: 'Low Stock',  color: 'warning' },
  out: { label: 'Out of Stock', color: 'error' },
};

// ── Edit Dialog ────────────────────────────────────────────────────────────

interface EditDialogProps {
  row: InventoryRow | null;
  onClose: () => void;
  onSave: (inventoryId: number, values: { name?: string; sku?: string; qty: number; unit: string; lowThreshold: number | null }) => void;
}

function EditDialog({ row, onClose, onSave }: EditDialogProps) {
  const [name, setName]         = useState(row?.kind === 'custom' ? row.name : '');
  const [sku, setSku]           = useState(row?.kind === 'custom' ? row.sku ?? '' : '');
  const [qty, setQty]           = useState(String(Number(row?.quantity ?? 0)));
  const [unit, setUnit]         = useState(row?.unit ?? 'units');
  const [threshold, setThreshold] = useState(row?.lowThreshold != null ? String(Number(row.lowThreshold)) : '');

  React.useEffect(() => {
    if (row) {
      setName(row.kind === 'custom' ? row.name : '');
      setSku(row.kind === 'custom' ? row.sku ?? '' : '');
      setQty(String(Number(row.quantity ?? 0)));
      setUnit(row.unit ?? 'units');
      setThreshold(row.lowThreshold != null ? String(Number(row.lowThreshold)) : '');
    }
  }, [row]);

  if (!row) return null;

  const handleSave = () => {
    const q = parseFloat(qty);
    const t = threshold !== '' ? parseFloat(threshold) : null;
    if (isNaN(q)) return;
    onSave(row.id, { name: row.kind === 'custom' ? name : undefined, sku: row.kind === 'custom' ? sku : undefined, qty: q, unit: unit || 'units', lowThreshold: t });
  };

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Edit Inventory — {row.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {row.kind === 'custom' && (
            <>
              <TextField
                label="Item Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                fullWidth
              />
              <TextField
                label="SKU (optional)"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                fullWidth
              />
            </>
          )}
          <TextField
            label="Quantity"
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            inputProps={{ min: 0, step: 0.01 }}
            fullWidth
          />
          <FormControl fullWidth>
            <InputLabel>Unit</InputLabel>
            <Select value={unit} label="Unit" onChange={(e) => setUnit(e.target.value)}>
              {['units', 'oz', 'lbs', 'kg', 'g', 'L', 'mL', 'gal', 'qt', 'pt', 'cups', 'each', 'cases'].map((u) => (
                <MuiMenuItem key={u} value={u}>{u}</MuiMenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Low Stock Threshold"
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            inputProps={{ min: 0, step: 0.01 }}
            helperText="Alert when quantity falls at or below this value"
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Adjust Dialog ──────────────────────────────────────────────────────────

interface AdjustDialogProps {
  row: InventoryRow | null;
  onClose: () => void;
  onAdjust: (inventoryId: number, adjustment: number, reason: string) => void;
}

function AdjustDialog({ row, onClose, onAdjust }: AdjustDialogProps) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  React.useEffect(() => {
    if (row) { setAmount(''); setReason(''); }
  }, [row]);

  if (!row) return null;

  const currentQty = Number(row.quantity ?? 0);
  const delta = parseFloat(amount) || 0;
  const newQty = currentQty + delta;

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Adjust Quantity — {row.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Current: <strong>{currentQty} {row.unit ?? 'units'}</strong>
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton onClick={() => setAmount((v) => String((parseFloat(v) || 0) - 1))} size="small">
              <Remove />
            </IconButton>
            <TextField
              label="Adjustment"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputProps={{ step: 0.01 }}
              size="small"
              sx={{ flex: 1 }}
              InputProps={{
                startAdornment: <InputAdornment position="start">{delta >= 0 ? '+' : ''}</InputAdornment>,
              }}
            />
            <IconButton onClick={() => setAmount((v) => String((parseFloat(v) || 0) + 1))} size="small">
              <Add />
            </IconButton>
          </Stack>
          {amount !== '' && (
            <Typography variant="body2" color={newQty < 0 ? 'error' : 'text.secondary'}>
              New quantity: <strong>{newQty.toFixed(2)} {row.unit ?? 'units'}</strong>
            </Typography>
          )}
          <TextField
            label="Reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Waste, Received shipment, Counted"
            fullWidth
            multiline
            rows={2}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={amount === '' || isNaN(delta)}
          onClick={() => onAdjust(row.id, delta, reason)}
        >
          Apply
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Add Tracking Dialog ────────────────────────────────────────────────────

interface AddTrackingDialogProps {
  open: boolean;
  trackedIds: Set<number>;
  onClose: () => void;
  onAdd: (menuItem: MenuItem, qty: number, unit: string, lowThreshold: number | null) => void;
}

interface AddCustomDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (values: { name: string; sku?: string; qty: number; unit: string; lowThreshold: number | null }) => void;
}

function AddCustomDialog({ open, onClose, onAdd }: AddCustomDialogProps) {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [qty, setQty] = useState('0');
  const [unit, setUnit] = useState('units');
  const [threshold, setThreshold] = useState('');

  React.useEffect(() => {
    if (open) {
      setName('');
      setSku('');
      setQty('0');
      setUnit('units');
      setThreshold('');
    }
  }, [open]);

  const handleSave = () => {
    const q = parseFloat(qty);
    const t = threshold !== '' ? parseFloat(threshold) : null;
    if (!name.trim() || isNaN(q)) return;
    onAdd({ name: name.trim(), sku: sku.trim() || undefined, qty: q, unit, lowThreshold: t });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Add Custom Inventory Item</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Item Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
          <TextField label="SKU (optional)" value={sku} onChange={(e) => setSku(e.target.value)} fullWidth />
          <TextField label="Initial Quantity" type="number" value={qty} onChange={(e) => setQty(e.target.value)} inputProps={{ min: 0, step: 0.01 }} fullWidth />
          <FormControl fullWidth>
            <InputLabel>Unit</InputLabel>
            <Select value={unit} label="Unit" onChange={(e) => setUnit(e.target.value)}>
              {['units', 'oz', 'lbs', 'kg', 'g', 'L', 'mL', 'gal', 'qt', 'pt', 'cups', 'each', 'cases'].map((u) => (
                <MuiMenuItem key={u} value={u}>{u}</MuiMenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField label="Low Stock Threshold (optional)" type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} inputProps={{ min: 0, step: 0.01 }} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!name.trim()} onClick={handleSave}>Add</Button>
      </DialogActions>
    </Dialog>
  );
}

function AddTrackingDialog({ open, trackedIds, onClose, onAdd }: AddTrackingDialogProps) {
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const [qty, setQty]           = useState('0');
  const [unit, setUnit]         = useState('units');
  const [threshold, setThreshold] = useState('');

  const { data: allItems = [] } = useQuery({
    queryKey: ['menu-items-all'],
    queryFn: () => menuApi.getItems().then((r) => r.data),
    enabled: open,
  });

  const untracked = allItems.filter((i) => i.isActive && !trackedIds.has(i.id));

  const handleClose = () => {
    setSelected(null); setQty('0'); setUnit('units'); setThreshold('');
    onClose();
  };

  const handleAdd = () => {
    if (!selected) return;
    const q = parseFloat(qty);
    const t = threshold !== '' ? parseFloat(threshold) : null;
    if (isNaN(q)) return;
    onAdd(selected, q, unit, t);
    handleClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Track New Item</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Autocomplete
            options={untracked}
            getOptionLabel={(o) => `${o.name} (${o.category?.name ?? ''})`}
            value={selected}
            onChange={(_, v) => setSelected(v)}
            renderInput={(params) => <TextField {...params} label="Menu Item" />}
          />
          <TextField
            label="Initial Quantity"
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            inputProps={{ min: 0, step: 0.01 }}
            fullWidth
          />
          <FormControl fullWidth>
            <InputLabel>Unit</InputLabel>
            <Select value={unit} label="Unit" onChange={(e) => setUnit(e.target.value)}>
              {['units', 'oz', 'lbs', 'kg', 'g', 'L', 'mL', 'gal', 'qt', 'pt', 'cups', 'each', 'cases'].map((u) => (
                <MuiMenuItem key={u} value={u}>{u}</MuiMenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Low Stock Threshold (optional)"
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            inputProps={{ min: 0, step: 0.01 }}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button variant="contained" disabled={!selected} onClick={handleAdd}>Add</Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function InventoryManagement() {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const [tab, setTab]               = useState<'all' | 'low'>('all');
  const [search, setSearch]         = useState('');
  const [editRow, setEditRow]       = useState<InventoryRow | null>(null);
  const [adjustRow, setAdjustRow]   = useState<InventoryRow | null>(null);
  const [addOpen, setAddOpen]       = useState(false);
  const [addCustomOpen, setAddCustomOpen] = useState(false);

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => inventoryApi.getAll().then((r) => r.data),
  });

  const updateMut = useMutation({
    mutationFn: ({ inventoryId, name, sku, qty, unit, lowThreshold }: { inventoryId: number; name?: string; sku?: string; qty: number; unit: string; lowThreshold: number | null }) =>
      inventoryApi.updateById(inventoryId, { name, sku, quantity: qty, unit, lowThreshold }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); enqueueSnackbar('Inventory updated', { variant: 'success' }); setEditRow(null); },
    onError:   () => enqueueSnackbar('Failed to update inventory', { variant: 'error' }),
  });

  const adjustMut = useMutation({
    mutationFn: ({ inventoryId, adjustment, reason }: { inventoryId: number; adjustment: number; reason: string }) =>
      inventoryApi.adjustById(inventoryId, adjustment, reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); enqueueSnackbar('Quantity adjusted', { variant: 'success' }); setAdjustRow(null); },
    onError:   () => enqueueSnackbar('Failed to adjust quantity', { variant: 'error' }),
  });

  const enableMut = useMutation({
    mutationFn: ({ menuItem, qty, unit, lowThreshold }: { menuItem: MenuItem; qty: number; unit: string; lowThreshold: number | null }) =>
      menuApi.updateItem(menuItem.id, { trackInventory: true }).then(() =>
        inventoryApi.update(menuItem.id, { quantity: qty, unit, lowThreshold: lowThreshold ?? undefined })
      ),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); enqueueSnackbar('Item added to inventory tracking', { variant: 'success' }); },
    onError:   () => enqueueSnackbar('Failed to add item', { variant: 'error' }),
  });

  const disableMut = useMutation({
    mutationFn: (menuItemId: number) => menuApi.updateItem(menuItemId, { trackInventory: false }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); enqueueSnackbar('Removed from tracking', { variant: 'success' }); },
    onError:   () => enqueueSnackbar('Failed to remove item', { variant: 'error' }),
  });

  const createCustomMut = useMutation({
    mutationFn: ({ name, sku, qty, unit, lowThreshold }: { name: string; sku?: string; qty: number; unit: string; lowThreshold: number | null }) =>
      inventoryApi.createCustom({ name, sku, quantity: qty, unit, lowThreshold }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); enqueueSnackbar('Custom inventory item added', { variant: 'success' }); },
    onError:   () => enqueueSnackbar('Failed to add custom item', { variant: 'error' }),
  });

  const deleteCustomMut = useMutation({
    mutationFn: (inventoryId: number) => inventoryApi.deleteById(inventoryId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); enqueueSnackbar('Custom inventory item removed', { variant: 'success' }); },
    onError:   () => enqueueSnackbar('Failed to remove custom item', { variant: 'error' }),
  });

  // ── summary ────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total   = rows.length;
    const lowRows = rows.filter((r) => stockStatus(r) === 'low');
    const outRows = rows.filter((r) => stockStatus(r) === 'out');
    return { total, low: lowRows.length, out: outRows.length };
  }, [rows]);

  // ── filtered rows ──────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = tab === 'low' ? rows.filter((r) => stockStatus(r) !== 'ok') : rows;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        r.name.toLowerCase().includes(q)
        || r.category?.name?.toLowerCase().includes(q)
        || r.sku?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [rows, tab, search]);

  const trackedIds = useMemo(() => new Set(rows.map((r) => r.menuItemId).filter((id): id is number => id != null)), [rows]);

  // ── render ─────────────────────────────────────────────────────────────

  const STAT_CARDS = [
    { label: 'Tracked Items',   value: stats.total, icon: <Inventory2 />,    color: '#0078d4' },
    { label: 'Low Stock',       value: stats.low,   icon: <Warning />,       color: '#f59e0b' },
    { label: 'Out of Stock',    value: stats.out,   icon: <ErrorOutline />,  color: '#ef4444' },
  ];

  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Typography variant="h5" fontWeight={700}>Inventory</Typography>
        <Stack direction="row" spacing={1}>
          <IconButton onClick={() => refetch()} size="small"><Refresh /></IconButton>
          <Button variant="outlined" startIcon={<WidgetsOutlined />} onClick={() => setAddCustomOpen(true)}>
            Custom Item
          </Button>
          <Button variant="contained" startIcon={<AddCircleOutline />} onClick={() => setAddOpen(true)}>
            Track Item
          </Button>
        </Stack>
      </Stack>

      {/* Stat cards */}
      <Stack direction="row" spacing={2} mb={3}>
        {STAT_CARDS.map((card) => (
          <Paper key={card.label} sx={{ flex: 1, p: 2, bgcolor: '#1e1e1e', borderRadius: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ color: card.color, display: 'flex' }}>{card.icon}</Box>
            <Box>
              <Typography variant="h5" fontWeight={700} lineHeight={1}>{card.value}</Typography>
              <Typography variant="caption" color="text.secondary">{card.label}</Typography>
            </Box>
          </Paper>
        ))}
      </Stack>

      {/* Tabs + search */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0 } }}>
          <Tab label="All Items" value="all" />
          <Tab
            label={
              <Stack direction="row" spacing={0.5} alignItems="center">
                <span>Needs Attention</span>
                {(stats.low + stats.out) > 0 && (
                  <Chip label={stats.low + stats.out} size="small" color="warning" sx={{ height: 18, fontSize: '0.65rem' }} />
                )}
              </Stack>
            }
            value="low"
          />
        </Tabs>
        <TextField
          size="small"
          placeholder="Search items…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
          sx={{ width: 220 }}
        />
      </Stack>

      {/* Table */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : filtered.length === 0 ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          {tab === 'low' ? 'All items are well stocked.' : 'No tracked inventory items. Click "Track Item" to get started.'}
        </Alert>
      ) : (
        <TableContainer component={Paper} sx={{ bgcolor: '#1e1e1e', borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary', borderBottom: '1px solid rgba(255,255,255,0.08)' } }}>
                <TableCell>Item</TableCell>
                <TableCell>Category</TableCell>
                <TableCell align="right">Quantity</TableCell>
                <TableCell>Unit</TableCell>
                <TableCell align="right">Low Threshold</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((row) => {
                const qty    = Number(row.quantity);
                const status = stockStatus(row);
                const chip   = STATUS_CHIP[status];
                return (
                  <TableRow
                    key={row.id}
                    sx={{
                      '& td': { borderBottom: '1px solid rgba(255,255,255,0.04)', py: 1 },
                      bgcolor: status === 'out' ? 'rgba(239,68,68,0.04)' : status === 'low' ? 'rgba(245,158,11,0.04)' : 'transparent',
                    }}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{row.name}</Typography>
                      {row.sku && <Typography variant="caption" color="text.secondary">SKU: {row.sku}</Typography>}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{row.category?.name ?? (row.kind === 'custom' ? 'Custom Inventory' : '—')}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        fontWeight={700}
                        color={status === 'out' ? 'error.main' : status === 'low' ? 'warning.main' : 'text.primary'}
                      >
                        {qty.toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{row.unit ?? '—'}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="text.secondary">
                        {row.lowThreshold != null ? Number(row.lowThreshold).toFixed(2) : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={chip.label} color={chip.color} size="small" sx={{ fontSize: '0.7rem' }} />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title="Adjust quantity">
                          <IconButton size="small" onClick={() => setAdjustRow(row)}>
                            <Add fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit inventory details">
                          <IconButton size="small" onClick={() => setEditRow(row)}>
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Remove from tracking">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => {
                              if (row.kind === 'custom') {
                                if (window.confirm(`Delete custom inventory item "${row.name}"?`)) deleteCustomMut.mutate(row.id);
                                return;
                              }
                              if (row.menuItemId && window.confirm(`Stop tracking "${row.name}"?`)) disableMut.mutate(row.menuItemId);
                            }}
                          >
                            <DeleteOutline fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Dialogs */}
      <EditDialog
        row={editRow}
        onClose={() => setEditRow(null)}
        onSave={(inventoryId, values) => updateMut.mutate({ inventoryId, ...values })}
      />
      <AdjustDialog
        row={adjustRow}
        onClose={() => setAdjustRow(null)}
        onAdjust={(inventoryId, adjustment, reason) => adjustMut.mutate({ inventoryId, adjustment, reason })}
      />
      <AddTrackingDialog
        open={addOpen}
        trackedIds={trackedIds}
        onClose={() => setAddOpen(false)}
        onAdd={(menuItem, qty, unit, lowThreshold) => enableMut.mutate({ menuItem, qty, unit, lowThreshold })}
      />
      <AddCustomDialog
        open={addCustomOpen}
        onClose={() => setAddCustomOpen(false)}
        onAdd={(values) => createCustomMut.mutate(values)}
      />
    </Box>
  );
}
