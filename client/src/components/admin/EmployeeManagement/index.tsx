import React, { useState } from 'react';
import {
  Box, Paper, Typography, Stack, Chip, Button, IconButton, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Select, MenuItem, FormControl,
  InputLabel, Switch, FormControlLabel, Avatar, CircularProgress, Tooltip,
} from '@mui/material';
import { Add, Edit, Lock, Block, CheckCircle } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { employeesApi } from '@/api/employees.api';
import { useAuthStore } from '@/store/authStore';
import type { User, Role } from '@/types';
import { extractError } from '@/api/client';

const ROLES: Role[] = ['OWNER', 'MANAGER', 'SERVER', 'CASHIER', 'KITCHEN', 'BARTENDER'];
const ROLE_COLORS: Record<Role, string> = {
  OWNER: '#0078d4', MANAGER: '#c42b1c', SERVER: '#0078d4',
  CASHIER: '#ff9800', KITCHEN: '#4caf50', BARTENDER: '#00bcd4',
};

function EmployeeDialog({ open, onClose, employee }: { open: boolean; onClose: () => void; employee?: User }) {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [form, setForm] = useState({
    username: employee?.username ?? '',
    email: employee?.email ?? '',
    firstName: employee?.firstName ?? '',
    lastName: employee?.lastName ?? '',
    role: (employee?.role ?? 'SERVER') as Role,
    pin: '',
    newPin: '',
    password: '',
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (employee) {
        await employeesApi.update(employee.id, {
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          role: form.role,
        });
        if (form.newPin.length === 4) {
          await employeesApi.changePin(employee.id, form.newPin);
        }
      } else {
        await employeesApi.create(form);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      enqueueSnackbar(employee ? 'Employee updated' : 'Employee created', { variant: 'success' });
      onClose();
    },
    onError: (e) => enqueueSnackbar(extractError(e), { variant: 'error' }),
  });

  const isValid =
    form.firstName &&
    form.lastName &&
    form.username &&
    (employee
      ? (form.newPin === '' || form.newPin.length === 4)
      : form.pin.length === 4 && form.password.length >= 6);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: '#242424' } }}>
      <DialogTitle>{employee ? 'Edit Employee' : 'New Employee'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <Stack direction="row" spacing={2}>
            <TextField label="First Name" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} fullWidth required />
            <TextField label="Last Name" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} fullWidth required />
          </Stack>
          <TextField label="Username" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} fullWidth required disabled={!!employee} />
          <TextField label="Email (optional)" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} fullWidth />
          <FormControl fullWidth>
            <InputLabel>Role</InputLabel>
            <Select value={form.role} label="Role" onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}>
              {ROLES.map((r) => <MenuItem key={r} value={r}><Chip label={r} size="small" sx={{ bgcolor: ROLE_COLORS[r] + '33', color: ROLE_COLORS[r] }} /></MenuItem>)}
            </Select>
          </FormControl>
          {employee ? (
            <TextField
              label="New PIN (leave blank to keep current)"
              value={form.newPin}
              onChange={(e) => setForm((f) => ({ ...f, newPin: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
              fullWidth
              inputProps={{ maxLength: 4, inputMode: 'numeric' }}
              helperText={form.newPin.length > 0 && form.newPin.length < 4 ? 'PIN must be exactly 4 digits' : 'Enter a new 4-digit PIN to change it'}
              error={form.newPin.length > 0 && form.newPin.length < 4}
            />
          ) : (
            <>
              <TextField label="PIN (4 digits)" value={form.pin} onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))} fullWidth inputProps={{ maxLength: 4, inputMode: 'numeric' }} helperText="4-digit number for quick login" required />
              <TextField label="Password (for web login)" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} fullWidth helperText="Min 6 characters" required />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => mutation.mutate()} disabled={mutation.isPending || !isValid}>
          {mutation.isPending ? <CircularProgress size={20} /> : employee ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function EmployeeManagement() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { user: me } = useAuthStore();
  const [dialog, setDialog] = useState<{ open: boolean; employee?: User }>({ open: false });

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeesApi.getAll().then((r) => r.data),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => employeesApi.toggle(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
    onError: (e) => enqueueSnackbar(extractError(e), { variant: 'error' }),
  });

  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={700}>Employee Management</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setDialog({ open: true })}>Add Employee</Button>
      </Stack>

      <TableContainer component={Paper} sx={{ bgcolor: '#1e1e1e' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Employee</TableCell>
              <TableCell>Username</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Member Since</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} align="center"><CircularProgress size={32} sx={{ my: 2 }} /></TableCell></TableRow>
            ) : employees.map((emp) => (
              <TableRow key={emp.id} sx={{ opacity: emp.isActive ? 1 : 0.5 }}>
                <TableCell>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Avatar sx={{ bgcolor: ROLE_COLORS[emp.role] ?? '#0078d4', width: 36, height: 36, fontSize: '0.875rem' }}>
                      {emp.firstName[0]}
                    </Avatar>
                    <Typography fontWeight={600}>{emp.firstName} {emp.lastName}</Typography>
                  </Stack>
                </TableCell>
                <TableCell><Typography variant="body2" color="text.secondary">@{emp.username}</Typography></TableCell>
                <TableCell>
                  <Chip label={emp.role} size="small" sx={{ bgcolor: ROLE_COLORS[emp.role] + '33', color: ROLE_COLORS[emp.role], fontWeight: 700 }} />
                </TableCell>
                <TableCell>
                  <Chip label={emp.isActive ? 'Active' : 'Disabled'} size="small" color={emp.isActive ? 'success' : 'error'} variant="outlined" />
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary">{new Date(emp.createdAt).toLocaleDateString()}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" justifyContent="flex-end" spacing={0.5}>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => setDialog({ open: true, employee: emp })}><Edit fontSize="small" /></IconButton>
                    </Tooltip>
                    {emp.id !== me?.id && (
                      <Tooltip title={emp.isActive ? 'Disable' : 'Enable'}>
                        <IconButton size="small" color={emp.isActive ? 'error' : 'success'} onClick={() => toggleMutation.mutate(emp.id)}>
                          {emp.isActive ? <Block fontSize="small" /> : <CheckCircle fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <EmployeeDialog key={dialog.employee?.id ?? 'new'} open={dialog.open} employee={dialog.employee} onClose={() => setDialog({ open: false })} />
    </Box>
  );
}
