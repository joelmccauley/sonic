import React, { useState, useRef } from 'react';
import {
  Box, Paper, Typography, Stack, Grid, Switch, FormControlLabel, TextField,
  Button, CircularProgress, Divider, Alert,
} from '@mui/material';
import { Save, Upload, DeleteOutline } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { settingsApi } from '@/api/settings.api';
import { extractError } from '@/api/client';

const SETTINGS_KEYS = [
  { key: 'restaurant_name', label: 'Restaurant Name', type: 'text' },
  { key: 'address', label: 'Address', type: 'text' },
  { key: 'phone', label: 'Phone', type: 'text' },
  { key: 'tax_rate', label: 'Tax Rate (%)', type: 'number' },
  { key: 'tip_suggestions', label: 'Tip Suggestions (comma separated, e.g. 15,18,20)', type: 'text' },
  { key: 'receipt_footer', label: 'Receipt Footer Message', type: 'text' },
  { key: 'currency_symbol', label: 'Currency Symbol', type: 'text' },
  { key: 'timezone', label: 'Timezone (e.g. America/New_York)', type: 'text' },
  { key: 'auto_print_receipt', label: 'Auto-Print Receipt', type: 'boolean' },
  { key: 'auto_fire_to_kitchen', label: 'Auto-Fire to Kitchen', type: 'boolean' },
  { key: 'require_table_for_dine_in', label: 'Require Table for Dine-In', type: 'boolean' },
  { key: 'loyalty_points_rate', label: 'Loyalty Points per Dollar', type: 'number' },
];

export default function GeneralSettings() {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.getAll().then((r) => {
      setValues(r.data);
      setLoaded(true);
      return r.data;
    }),
  });

  const mutation = useMutation({
    mutationFn: () => settingsApi.update(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      enqueueSnackbar('Settings saved', { variant: 'success' });
    },
    onError: (e) => enqueueSnackbar(extractError(e), { variant: 'error' }),
  });

  const logoMutation = useMutation({
    mutationFn: (file: File) => settingsApi.uploadLogo(file),
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['settings-public'] });
      setValues((v) => ({ ...v, logo_url: data.url }));
      setLogoPreview(null);
      enqueueSnackbar('Logo updated', { variant: 'success' });
    },
    onError: (e) => enqueueSnackbar(extractError(e), { variant: 'error' }),
  });

  const removeLogoMutation = useMutation({
    mutationFn: () => settingsApi.removeLogo(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['settings-public'] });
      setValues((v) => ({ ...v, logo_url: '' }));
      setLogoPreview(null);
      enqueueSnackbar('Logo removed — SonicPOS logo restored', { variant: 'success' });
    },
    onError: (e) => enqueueSnackbar(extractError(e), { variant: 'error' }),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoPreview(URL.createObjectURL(file));
    logoMutation.mutate(file);
  };

  const set = (key: string, val: string) => setValues((v) => ({ ...v, [key]: val }));

  const currentLogo = values['logo_url'];

  if (isLoading) return <Box sx={{ p: 3 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={700}>General Settings</Typography>
        <Button variant="contained" startIcon={<Save />} onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? <CircularProgress size={20} /> : 'Save Settings'}
        </Button>
      </Stack>

      <Paper sx={{ p: 3, bgcolor: '#1e1e1e', maxWidth: 720, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={600} mb={2}>Company Logo</Typography>
        <Stack direction="row" alignItems="center" spacing={3}>
          <Box
            sx={{
              width: 160, height: 80, border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 1, bgcolor: '#141414', display: 'flex', alignItems: 'center',
              justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
            }}
          >
            {(logoPreview || currentLogo) ? (
              <img src={logoPreview ?? currentLogo} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }} />
            ) : (
              <Typography variant="caption" color="text.disabled">No logo set</Typography>
            )}
          </Box>
          <Box>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                variant="outlined"
                startIcon={logoMutation.isPending ? <CircularProgress size={16} /> : <Upload />}
                onClick={() => fileInputRef.current?.click()}
                disabled={logoMutation.isPending || removeLogoMutation.isPending}
              >
                {logoMutation.isPending ? 'Uploading…' : 'Upload Logo'}
              </Button>
              {(logoPreview || currentLogo) && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={removeLogoMutation.isPending ? <CircularProgress size={16} /> : <DeleteOutline />}
                  onClick={() => removeLogoMutation.mutate()}
                  disabled={logoMutation.isPending || removeLogoMutation.isPending}
                >
                  {removeLogoMutation.isPending ? 'Removing…' : 'Remove'}
                </Button>
              )}
            </Stack>
            <Typography variant="caption" color="text.secondary" display="block" mt={0.75}>
              PNG, JPG, SVG or WebP · Max 5 MB
            </Typography>
          </Box>
        </Stack>
      </Paper>

      <Paper sx={{ p: 3, bgcolor: '#1e1e1e', maxWidth: 720 }}>
        <Grid container spacing={3}>
          {SETTINGS_KEYS.map(({ key, label, type }) => (
            <Grid item xs={12} sm={type === 'boolean' ? 6 : 12} key={key}>
              {type === 'boolean' ? (
                <FormControlLabel
                  control={<Switch checked={values[key] === 'true'} onChange={(e) => set(key, String(e.target.checked))} />}
                  label={label}
                />
              ) : (
                <TextField
                  label={label}
                  value={values[key] ?? ''}
                  onChange={(e) => set(key, e.target.value)}
                  type={type}
                  fullWidth
                  size="small"
                />
              )}
            </Grid>
          ))}
        </Grid>
      </Paper>
    </Box>
  );
}
