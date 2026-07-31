import React, { useState } from 'react';
import {
  Box, Paper, Typography, Stack, Chip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, CircularProgress, TextField,
  Select, MenuItem, FormControl, InputLabel, Avatar, Button, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Tooltip, Alert,
} from '@mui/material';
import {
  Login, Logout, Edit, AccessTime, People, Timer,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { shiftsApi } from '@/api/shifts.api';
import { employeesApi } from '@/api/employees.api';
import { useAuthStore } from '@/store/authStore';
import { format, differenceInMinutes } from 'date-fns';
import type { Shift } from '@/types';
import { extractError } from '@/api/client';

// ── helpers ────────────────────────────────────────────────────────────────

function shiftDuration(shift: Shift): string {
  const end = shift.clockOut ? new Date(shift.clockOut) : new Date();
  const mins = differenceInMinutes(end, new Date(shift.clockIn));
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function totalHours(shifts: Shift[]): string {
  const mins = shifts.reduce((acc, s) => {
    const end = s.clockOut ? new Date(s.clockOut) : new Date();
    return acc + differenceInMinutes(end, new Date(s.clockIn));
  }, 0);
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

// ── Clock In Dialog ─────────────────────────────────────────────────────────

function ClockInDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const [cash, setCash] = useState('');

  const mutation = useMutation({
    mutationFn: () => shiftsApi.clockIn(cash ? parseFloat(cash) : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      queryClient.invalidateQueries({ queryKey: ['active-shift'] });
      enqueueSnackbar('Clocked in', { variant: 'success' });
      setCash('');
      onClose();
    },
    onError: (e) => enqueueSnackbar(extractError(e), { variant: 'error' }),
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { bgcolor: '#242424' } }}>
      <DialogTitle>Clock In</DialogTitle>
      <DialogContent>
        <TextField label="Starting Cash Drawer ($)" type="number" value={cash} onChange={(e) => setCash(e.target.value)}
          fullWidth size="small" sx={{ mt: 1 }} placeholder="0.00" inputProps={{ min: 0, step: 0.01 }} />
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="success" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? <CircularProgress size={20} /> : 'Clock In'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Clock Out Dialog ────────────────────────────────────────────────────────

function ClockOutDialog({ open, onClose, shift }: { open: boolean; onClose: () => void; shift: Shift | null }) {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const [cash, setCash] = useState('');
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: () => shiftsApi.clockOut(cash ? parseFloat(cash) : undefined, notes || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      queryClient.invalidateQueries({ queryKey: ['active-shift'] });
      enqueueSnackbar('Clocked out', { variant: 'success' });
      setCash(''); setNotes('');
      onClose();
    },
    onError: (e) => enqueueSnackbar(extractError(e), { variant: 'error' }),
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { bgcolor: '#242424' } }}>
      <DialogTitle>Clock Out</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          {shift && (
            <Alert severity="info" icon={<Timer />}>
              Shift duration so far: <b>{shiftDuration(shift)}</b>
            </Alert>
          )}
          <TextField label="Ending Cash Drawer ($)" type="number" value={cash} onChange={(e) => setCash(e.target.value)}
            fullWidth size="small" placeholder="0.00" inputProps={{ min: 0, step: 0.01 }} />
          <TextField label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)}
            fullWidth size="small" multiline rows={2} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="error" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? <CircularProgress size={20} /> : 'Clock Out'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Edit Shift Dialog ───────────────────────────────────────────────────────

function EditShiftDialog({ open, onClose, shift }: { open: boolean; onClose: () => void; shift: Shift | null }) {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const [clockOut, setClockOut] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [notes, setNotes] = useState('');

  React.useEffect(() => {
    if (shift) {
      setClockOut(shift.clockOut ? format(new Date(shift.clockOut), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"));
      setClosingCash(shift.closingCash?.toString() ?? '');
      setNotes(shift.notes ?? '');
    }
  }, [shift]);

  const mutation = useMutation({
    mutationFn: () => shiftsApi.update(shift!.id, {
      clockOut: new Date(clockOut).toISOString(),
      closingCash: closingCash ? parseFloat(closingCash) : undefined,
      notes: notes || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      queryClient.invalidateQueries({ queryKey: ['active-shift'] });
      enqueueSnackbar('Shift updated', { variant: 'success' });
      onClose();
    },
    onError: (e) => enqueueSnackbar(extractError(e), { variant: 'error' }),
  });

  if (!shift) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { bgcolor: '#242424' } }}>
      <DialogTitle>Edit Shift — {shift.user?.firstName} {shift.user?.lastName}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <TextField label="Clock In" type="datetime-local" value={format(new Date(shift.clockIn), "yyyy-MM-dd'T'HH:mm")}
            fullWidth size="small" InputLabelProps={{ shrink: true }} disabled />
          <TextField label="Clock Out" type="datetime-local" value={clockOut} onChange={(e) => setClockOut(e.target.value)}
            fullWidth size="small" InputLabelProps={{ shrink: true }} />
          <TextField label="Starting Cash ($)" value={shift.cashDrawer != null ? Number(shift.cashDrawer).toFixed(2) : ''}
            fullWidth size="small" disabled />
          <TextField label="Ending Cash ($)" type="number" value={closingCash} onChange={(e) => setClosingCash(e.target.value)}
            fullWidth size="small" inputProps={{ min: 0, step: 0.01 }} />
          <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)}
            fullWidth size="small" multiline rows={2} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? <CircularProgress size={20} /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────

export default function ShiftManagement() {
  const { user: me } = useAuthStore();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const isManager = me?.role === 'OWNER' || me?.role === 'MANAGER';

  const [employeeId, setEmployeeId] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState('');
  const [clockInOpen, setClockInOpen] = useState(false);
  const [clockOutOpen, setClockOutOpen] = useState(false);
  const [editShift, setEditShift] = useState<Shift | null>(null);

  const { data: activeShift = null } = useQuery({
    queryKey: ['active-shift'],
    queryFn: () => shiftsApi.getActive().then((r) => r.data),
    refetchInterval: 60_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['shifts', employeeId, startDate, endDate],
    queryFn: () => shiftsApi.getAll({
      userId: employeeId ? parseInt(employeeId) : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }).then((r) => r.data),
    enabled: isManager,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeesApi.getAll().then((r) => r.data),
    enabled: isManager,
  });

  const shifts = data?.shifts ?? [];

  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={700}>Shift Management</Typography>
        <Stack direction="row" spacing={1}>
          {!activeShift ? (
            <Button variant="contained" color="success" startIcon={<Login />} onClick={() => setClockInOpen(true)}>
              Clock In
            </Button>
          ) : (
            <Button variant="outlined" color="error" startIcon={<Logout />} onClick={() => setClockOutOpen(true)}>
              Clock Out
            </Button>
          )}
        </Stack>
      </Stack>

      {/* My shift status */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: '#1e1e1e', border: activeShift ? '1px solid rgba(87,163,0,0.3)' : '1px solid rgba(255,255,255,0.06)' }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <AccessTime color={activeShift ? 'success' : 'disabled'} />
          {activeShift ? (
            <Box>
              <Typography variant="body2" fontWeight={600} color="success.main">Currently Clocked In</Typography>
              <Typography variant="caption" color="text.secondary">
                Since {format(new Date(activeShift.clockIn), 'h:mm a')} · {shiftDuration(activeShift)} elapsed
                {activeShift.cashDrawer != null && ` · Starting cash $${Number(activeShift.cashDrawer).toFixed(2)}`}
              </Typography>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">Not currently clocked in</Typography>
          )}
        </Stack>
      </Paper>

      {isManager && (
        <>
          {/* Stats */}
          <Stack direction="row" spacing={2} mb={3}>
            {[
              { label: 'Total Shifts', value: shifts.length, icon: <People sx={{ fontSize: 20 }} />, color: '#0078d4' },
              { label: 'Active Now', value: shifts.filter((s) => !s.clockOut).length, icon: <Timer sx={{ fontSize: 20 }} />, color: '#57a300' },
              { label: 'Total Hours', value: totalHours(shifts), icon: <AccessTime sx={{ fontSize: 20 }} />, color: '#c19c00' },
            ].map(({ label, value, icon, color }) => (
              <Paper key={label} sx={{ p: 2, bgcolor: '#1e1e1e', flex: 1 }}>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <Box sx={{ color }}>{icon}</Box>
                  <Box>
                    <Typography variant="h6" fontWeight={700}>{value}</Typography>
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                  </Box>
                </Stack>
              </Paper>
            ))}
          </Stack>

          {/* Filters */}
          <Paper sx={{ p: 2, mb: 2, bgcolor: '#1e1e1e' }}>
            <Stack direction="row" spacing={2} flexWrap="wrap">
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Employee</InputLabel>
                <Select value={employeeId} label="Employee" onChange={(e) => setEmployeeId(String(e.target.value))}>
                  <MenuItem value="">All Employees</MenuItem>
                  {employees.map((e) => (
                    <MenuItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                size="small" InputLabelProps={{ shrink: true }} />
              <TextField label="End Date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                size="small" InputLabelProps={{ shrink: true }} />
            </Stack>
          </Paper>

          {/* Table */}
          <TableContainer component={Paper} sx={{ bgcolor: '#1e1e1e' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Employee</TableCell>
                  <TableCell>Clock In</TableCell>
                  <TableCell>Clock Out</TableCell>
                  <TableCell>Duration</TableCell>
                  <TableCell>Starting Cash</TableCell>
                  <TableCell>Ending Cash</TableCell>
                  <TableCell>Notes</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={9} align="center"><CircularProgress size={28} sx={{ my: 2 }} /></TableCell></TableRow>
                ) : shifts.length === 0 ? (
                  <TableRow><TableCell colSpan={9} align="center"><Typography color="text.secondary" py={3}>No shifts found for the selected period</Typography></TableCell></TableRow>
                ) : shifts.map((shift) => (
                  <TableRow key={shift.id} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Avatar sx={{ width: 26, height: 26, fontSize: '0.7rem', bgcolor: '#0078d4' }}>
                          {shift.user?.firstName?.[0]}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.2 }}>{shift.user?.firstName} {shift.user?.lastName}</Typography>
                          <Typography variant="caption" color="text.secondary">{shift.user?.role}</Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell><Typography variant="body2">{format(new Date(shift.clockIn), 'MM/dd h:mm a')}</Typography></TableCell>
                    <TableCell><Typography variant="body2">{shift.clockOut ? format(new Date(shift.clockOut), 'MM/dd h:mm a') : '—'}</Typography></TableCell>
                    <TableCell>
                      <Typography variant="body2" color={!shift.clockOut ? 'success.main' : 'text.primary'}>{shiftDuration(shift)}</Typography>
                    </TableCell>
                    <TableCell><Typography variant="body2">{shift.cashDrawer != null ? `$${Number(shift.cashDrawer).toFixed(2)}` : '—'}</Typography></TableCell>
                    <TableCell><Typography variant="body2">{shift.closingCash != null ? `$${Number(shift.closingCash).toFixed(2)}` : '—'}</Typography></TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 140, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {shift.notes ?? '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={shift.clockOut ? 'Completed' : 'Active'} size="small" color={shift.clockOut ? 'default' : 'success'} variant="outlined" />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit shift">
                        <IconButton size="small" onClick={() => setEditShift(shift)}>
                          <Edit sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      <ClockInDialog open={clockInOpen} onClose={() => setClockInOpen(false)} />
      <ClockOutDialog open={clockOutOpen} onClose={() => setClockOutOpen(false)} shift={activeShift} />
      <EditShiftDialog open={!!editShift} onClose={() => setEditShift(null)} shift={editShift} />
    </Box>
  );
}
