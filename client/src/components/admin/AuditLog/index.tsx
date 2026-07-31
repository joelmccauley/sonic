import React, { useState } from 'react';
import {
  Box, Paper, Typography, Stack, Chip, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, CircularProgress, TextField, Select,
  MenuItem, FormControl, InputLabel, Alert, IconButton, Collapse,
} from '@mui/material';
import { Download, Refresh, ExpandMore, ExpandLess } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { format, subDays } from 'date-fns';
import type { AuditLog } from '@/types';

const ACTION_COLORS: Record<string, string> = {
  CREATE: '#4caf50', UPDATE: '#2196f3', DELETE: '#f44336',
  LOGIN: '#0078d4', LOGOUT: '#9e9e9e', VOID: '#c19c00',
  PAYMENT: '#00b7c3', DISCOUNT: '#57a300', PRINT: '#2899f5',
};

function LogRow({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false);
  const color = ACTION_COLORS[log.action] ?? '#aaa';
  return (
    <>
      <TableRow hover onClick={() => log.details && setExpanded(!expanded)} sx={{ cursor: log.details ? 'pointer' : 'default' }}>
        <TableCell><Typography variant="caption" fontFamily="monospace" color="text.secondary">{format(new Date(log.createdAt), 'MM/dd HH:mm:ss')}</Typography></TableCell>
        <TableCell>
          <Chip label={log.action} size="small" sx={{ bgcolor: color + '22', color, fontWeight: 700, fontSize: '0.65rem' }} />
        </TableCell>
        <TableCell><Typography variant="body2">{log.entity}</Typography></TableCell>
        <TableCell><Typography variant="caption">{log.entityId ?? '—'}</Typography></TableCell>
        <TableCell><Typography variant="body2">{log.user?.firstName} {log.user?.lastName}</Typography></TableCell>
        <TableCell><Typography variant="caption" color="text.secondary">{log.ipAddress ?? '—'}</Typography></TableCell>
        <TableCell align="right">
          {log.details && <IconButton size="small" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}>{expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}</IconButton>}
        </TableCell>
      </TableRow>
      {log.details && (
        <TableRow>
          <TableCell colSpan={7} sx={{ py: 0, border: 0 }}>
            <Collapse in={expanded}>
              <Box sx={{ p: 2, bgcolor: '#141414', borderRadius: 1, m: 1 }}>
                <Typography variant="caption" fontFamily="monospace" component="pre" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {JSON.stringify(log.details, null, 2)}
                </Typography>
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export default function AuditLogView() {
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['audit-logs', action, entity, startDate, endDate],
    queryFn: () => apiClient.get<{ logs: AuditLog[]; total: number }>('/audit', {
      params: { action: action || undefined, entity: entity || undefined, startDate, endDate, limit: 200 },
    }).then((r) => r.data),
  });

  const handleExport = () => {
    const params = new URLSearchParams({ action: action || '', entity: entity || '', startDate, endDate });
    window.open(`/api/audit/export?${params}`, '_blank');
  };

  const logs = (data?.logs ?? []).filter((l) =>
    !search || l.action.includes(search.toUpperCase()) || l.entity.toLowerCase().includes(search.toLowerCase()) || `${l.user?.firstName} ${l.user?.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Stack>
          <Typography variant="h5" fontWeight={700}>Audit Log</Typography>
          <Typography variant="caption" color="text.secondary">{data?.total ?? 0} total records</Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<Refresh />} onClick={() => refetch()}>Refresh</Button>
          <Button variant="outlined" startIcon={<Download />} onClick={handleExport}>Export CSV</Button>
        </Stack>
      </Stack>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2, bgcolor: '#1e1e1e' }}>
        <Stack direction="row" spacing={2} flexWrap="wrap" gap={1}>
          <TextField label="Search" value={search} onChange={(e) => setSearch(e.target.value)} size="small" sx={{ minWidth: 200 }} placeholder="Name, entity, action..." />
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Action</InputLabel>
            <Select value={action} label="Action" onChange={(e) => setAction(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              {Object.keys(ACTION_COLORS).map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Entity</InputLabel>
            <Select value={entity} label="Entity" onChange={(e) => setEntity(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              {['Order', 'Payment', 'User', 'MenuItem', 'MenuCategory', 'Table', 'Discount', 'Printer', 'Setting'].map((e) => <MenuItem key={e} value={e}>{e}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="Start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} size="small" InputLabelProps={{ shrink: true }} />
          <TextField label="End" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} size="small" InputLabelProps={{ shrink: true }} />
        </Stack>
      </Paper>

      <TableContainer component={Paper} sx={{ bgcolor: '#1e1e1e', maxHeight: 600 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell>Timestamp</TableCell>
              <TableCell>Action</TableCell>
              <TableCell>Entity</TableCell>
              <TableCell>Entity ID</TableCell>
              <TableCell>User</TableCell>
              <TableCell>IP</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} align="center"><CircularProgress sx={{ my: 2 }} /></TableCell></TableRow>
            ) : logs.length === 0 ? (
              <TableRow><TableCell colSpan={7} align="center"><Typography color="text.secondary" py={3}>No logs found</Typography></TableCell></TableRow>
            ) : logs.map((log) => <LogRow key={log.id} log={log} />)}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
