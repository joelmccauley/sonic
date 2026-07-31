import React, { useState } from 'react';
import {
  Box, Paper, Typography, Stack, Chip, Button, IconButton, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Select, MenuItem, FormControl,
  InputLabel, CircularProgress, Tooltip, Grid, ToggleButtonGroup, ToggleButton,
  Alert,
} from '@mui/material';
import { Add, Edit, Delete, TableRestaurant, Check } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { tablesApi } from '@/api/tables.api';
import type { Table as TableType, TableShape, TableStatus } from '@/types';
import { extractError } from '@/api/client';

const SHAPES: TableShape[] = ['RECTANGLE', 'SQUARE', 'CIRCLE'];
const SECTIONS = ['Main', 'Patio', 'Bar', 'Private', 'Outdoor', 'VIP'];

const STATUS_COLORS: Record<TableStatus, string> = {
  AVAILABLE: '#2e7d32',
  OCCUPIED: '#c62828',
  RESERVED: '#e65100',
  CLEANING: '#0277bd',
};

function TableDialog({
  open, onClose, table, existingSections,
}: {
  open: boolean;
  onClose: () => void;
  table?: TableType;
  existingSections: string[];
}) {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const [name, setName] = useState(table?.name ?? '');
  const [capacity, setCapacity] = useState(String(table?.capacity ?? 4));
  const [section, setSection] = useState(table?.section ?? 'Main');
  const [customSection, setCustomSection] = useState('');
  const [shape, setShape] = useState<TableShape>(table?.shape ?? 'RECTANGLE');
  const [useCustomSection, setUseCustomSection] = useState(
    !!table?.section && !SECTIONS.includes(table.section ?? '')
  );

  const finalSection = useCustomSection ? customSection : section;

  const mutation = useMutation({
    mutationFn: () => {
      const data = { name, capacity: parseInt(capacity), section: finalSection, shape };
      return table ? tablesApi.update(table.id, data) : tablesApi.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tables'] });
      enqueueSnackbar(table ? 'Table updated' : 'Table created', { variant: 'success' });
      onClose();
    },
    onError: (e) => enqueueSnackbar(extractError(e), { variant: 'error' }),
  });

  const isValid = name.trim() && parseInt(capacity) > 0 && finalSection.trim();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { bgcolor: '#242424' } }}>
      <DialogTitle>{table ? 'Edit Table' : 'Add Table'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <TextField
            label="Table Name / Number"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
            placeholder="e.g. T1, Table 5, Bar 2"
            autoFocus
          />

          <TextField
            label="Seats / Capacity"
            type="number"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            fullWidth
            required
            inputProps={{ min: 1, max: 30 }}
          />

          <FormControl fullWidth>
            <InputLabel>Section</InputLabel>
            <Select
              value={useCustomSection ? '__custom__' : section}
              label="Section"
              onChange={(e) => {
                if (e.target.value === '__custom__') {
                  setUseCustomSection(true);
                } else {
                  setUseCustomSection(false);
                  setSection(e.target.value as string);
                }
              }}
            >
              {[...new Set([...SECTIONS, ...existingSections])].map((s) => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
              <MenuItem value="__custom__">+ Custom section...</MenuItem>
            </Select>
          </FormControl>

          {useCustomSection && (
            <TextField
              label="Custom Section Name"
              value={customSection}
              onChange={(e) => setCustomSection(e.target.value)}
              fullWidth
              autoFocus
            />
          )}

          <Box>
            <Typography variant="caption" color="text.secondary" mb={1} display="block">Table Shape</Typography>
            <ToggleButtonGroup
              value={shape}
              exclusive
              onChange={(_, v) => v && setShape(v)}
              fullWidth
              size="small"
            >
              {SHAPES.map((s) => (
                <ToggleButton key={s} value={s} sx={{ textTransform: 'none', fontSize: '0.75rem' }}>
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => mutation.mutate()} disabled={mutation.isPending || !isValid}>
          {mutation.isPending ? <CircularProgress size={20} /> : table ? 'Update' : 'Add Table'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function BulkAddDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [count, setCount] = useState('6');
  const [capacity, setCapacity] = useState('6');
  const [section, setSection] = useState('Main');
  const [prefix, setPrefix] = useState('T');
  const [startNum, setStartNum] = useState('1');

  const mutation = useMutation({
    mutationFn: async () => {
      const n = parseInt(count);
      const start = parseInt(startNum);
      for (let i = 0; i < n; i++) {
        await tablesApi.create({
          name: `${prefix}${start + i}`,
          capacity: parseInt(capacity),
          section,
          shape: 'RECTANGLE',
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tables'] });
      enqueueSnackbar(`${count} tables created`, { variant: 'success' });
      onClose();
    },
    onError: (e) => enqueueSnackbar(extractError(e), { variant: 'error' }),
  });

  const preview = Array.from({ length: Math.min(parseInt(count) || 0, 5) }, (_, i) =>
    `${prefix}${parseInt(startNum) + i}`
  ).join(', ') + (parseInt(count) > 5 ? ` ... ${prefix}${parseInt(startNum) + parseInt(count) - 1}` : '');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { bgcolor: '#242424' } }}>
      <DialogTitle>Bulk Add Tables</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <Stack direction="row" spacing={2}>
            <TextField label="Prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} sx={{ width: 100 }} />
            <TextField label="Start #" type="number" value={startNum} onChange={(e) => setStartNum(e.target.value)} sx={{ width: 100 }} inputProps={{ min: 1 }} />
            <TextField label="Count" type="number" value={count} onChange={(e) => setCount(e.target.value)} sx={{ width: 100 }} inputProps={{ min: 1, max: 50 }} />
          </Stack>
          <TextField label="Seats per Table" type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} fullWidth inputProps={{ min: 1, max: 30 }} />
          <FormControl fullWidth>
            <InputLabel>Section</InputLabel>
            <Select value={section} label="Section" onChange={(e) => setSection(e.target.value as string)}>
              {SECTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </Select>
          </FormControl>
          {count && startNum && prefix && (
            <Alert severity="info" sx={{ py: 0.5 }}>
              Will create: <strong>{preview}</strong>
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => mutation.mutate()} disabled={mutation.isPending || !count || !capacity}>
          {mutation.isPending ? <CircularProgress size={20} /> : `Create ${count} Tables`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function TableManagement() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [dialog, setDialog] = useState<{ open: boolean; table?: TableType }>({ open: false });
  const [bulkOpen, setBulkOpen] = useState(false);
  const [sectionFilter, setSectionFilter] = useState('');

  const { data: tables = [], isLoading } = useQuery({
    queryKey: ['admin-tables'],
    queryFn: () => tablesApi.getAll().then((r) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => tablesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tables'] });
      enqueueSnackbar('Table removed', { variant: 'info' });
    },
    onError: (e) => enqueueSnackbar(extractError(e), { variant: 'error' }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: TableStatus }) => tablesApi.updateStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-tables'] }),
    onError: (e) => enqueueSnackbar(extractError(e), { variant: 'error' }),
  });

  const existingSections = [...new Set(tables.map((t) => t.section).filter(Boolean))] as string[];
  const sections = [...new Set([...SECTIONS, ...existingSections])];
  const filtered = sectionFilter ? tables.filter((t) => t.section === sectionFilter) : tables;

  // Group by section
  const bySection = filtered.reduce<Record<string, TableType[]>>((acc, t) => {
    const key = t.section ?? 'Unsectioned';
    acc[key] = [...(acc[key] ?? []), t];
    return acc;
  }, {});

  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Table Management</Typography>
          <Typography variant="caption" color="text.secondary">{tables.length} tables total</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={() => setBulkOpen(true)}>Bulk Add</Button>
          <Button variant="contained" startIcon={<Add />} onClick={() => setDialog({ open: true })}>Add Table</Button>
        </Stack>
      </Stack>

      {/* Section filter chips */}
      <Stack direction="row" spacing={1} flexWrap="wrap" mb={3}>
        <Chip label="All" clickable variant={!sectionFilter ? 'filled' : 'outlined'} color={!sectionFilter ? 'primary' : 'default'} onClick={() => setSectionFilter('')} />
        {sections.filter((s) => tables.some((t) => t.section === s)).map((s) => (
          <Chip key={s} label={s} clickable variant={sectionFilter === s ? 'filled' : 'outlined'} color={sectionFilter === s ? 'primary' : 'default'} onClick={() => setSectionFilter(s)} />
        ))}
      </Stack>

      {isLoading ? (
        <CircularProgress />
      ) : (
        Object.entries(bySection).map(([sec, secTables]) => (
          <Box key={sec} mb={4}>
            <Typography variant="h6" fontWeight={700} mb={1.5} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TableRestaurant fontSize="small" color="primary" />
              {sec}
              <Chip label={`${secTables.length} tables`} size="small" variant="outlined" />
            </Typography>
            <Grid container spacing={1.5}>
              {secTables.map((table) => (
                <Grid item xs={6} sm={4} md={3} lg={2} key={table.id}>
                  <Paper sx={{
                    p: 1.5, bgcolor: '#1e1e1e',
                    border: `1px solid ${STATUS_COLORS[table.status]}44`,
                    borderRadius: 2,
                  }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography fontWeight={800} variant="body1">{table.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{table.capacity} seats · {table.shape?.toLowerCase()}</Typography>
                      </Box>
                      <Stack direction="row" spacing={0}>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => setDialog({ open: true, table })}>
                            <Edit sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => {
                            if (table.status === 'OCCUPIED') { enqueueSnackbar('Cannot delete an occupied table', { variant: 'warning' }); return; }
                            deleteMutation.mutate(table.id);
                          }}>
                            <Delete sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Stack>
                    <Box mt={1}>
                      <FormControl fullWidth size="small">
                        <Select
                          value={table.status}
                          onChange={(e) => statusMutation.mutate({ id: table.id, status: e.target.value as TableStatus })}
                          sx={{ fontSize: '0.72rem', color: STATUS_COLORS[table.status], '& .MuiOutlinedInput-notchedOutline': { borderColor: STATUS_COLORS[table.status] + '66' } }}
                        >
                          <MenuItem value="AVAILABLE" sx={{ color: STATUS_COLORS.AVAILABLE }}>Available</MenuItem>
                          <MenuItem value="RESERVED" sx={{ color: STATUS_COLORS.RESERVED }}>Reserved</MenuItem>
                          <MenuItem value="CLEANING" sx={{ color: STATUS_COLORS.CLEANING }}>Cleaning</MenuItem>
                          <MenuItem value="OCCUPIED" disabled sx={{ color: STATUS_COLORS.OCCUPIED }}>Occupied</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Box>
        ))
      )}

      <TableDialog
        open={dialog.open}
        table={dialog.table}
        existingSections={existingSections}
        onClose={() => setDialog({ open: false })}
      />
      <BulkAddDialog open={bulkOpen} onClose={() => setBulkOpen(false)} />
    </Box>
  );
}
