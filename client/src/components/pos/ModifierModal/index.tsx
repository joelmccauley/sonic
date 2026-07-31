import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography,
  Stack, Checkbox, FormControlLabel, Chip, Box, TextField, Divider,
  RadioGroup, Radio, FormControl, FormLabel, CircularProgress,
} from '@mui/material';
import { Add, Remove } from '@mui/icons-material';
import { useMutation } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { ordersApi } from '@/api/orders.api';
import type { MenuItem, ModifierGroup, Modifier } from '@/types';
import { extractError } from '@/api/client';

interface SelectedMod {
  modifierId: number;
  name: string;
  price: number;
}

interface Props {
  item: MenuItem | null;
  orderId: number;
  onClose: () => void;
  onAdded: () => void;
}

export default function ModifierModal({ item, orderId, onClose, onAdded }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [quantity, setQuantity] = useState(1);
  const [selectedMods, setSelectedMods] = useState<Record<number, SelectedMod[]>>({});
  const [notes, setNotes] = useState('');
  const [course, setCourse] = useState(1);

  useEffect(() => {
    if (item) {
      setQuantity(1);
      setSelectedMods({});
      setNotes('');
      setCourse(1);
    }
  }, [item?.id]);

  const addMutation = useMutation({
    mutationFn: () =>
      ordersApi.addItem(orderId, {
        menuItemId: item!.id,
        quantity,
        notes: notes || undefined,
        course,
        modifiers: Object.values(selectedMods)
          .flat()
          .map((m) => ({ modifierId: m.modifierId, price: m.price })),
      }),
    onSuccess: () => {
      enqueueSnackbar(`${item!.name} added to order`, { variant: 'success' });
      onAdded();
      onClose();
    },
    onError: (e) => enqueueSnackbar(extractError(e), { variant: 'error' }),
  });

  if (!item) return null;

  const modGroups = item.modifierGroups ?? [];

  const toggleMod = (group: ModifierGroup, mod: Modifier) => {
    setSelectedMods((prev) => {
      const groupMods = prev[group.id] ?? [];
      const exists = groupMods.find((m) => m.modifierId === mod.id);

      if (exists) {
        return { ...prev, [group.id]: groupMods.filter((m) => m.modifierId !== mod.id) };
      }

      if (!group.multiSelect) {
        return { ...prev, [group.id]: [{ modifierId: mod.id, name: mod.name, price: Number(mod.price) }] };
      }

      if (group.maxSelect && groupMods.length >= group.maxSelect) {
        enqueueSnackbar(`Max ${group.maxSelect} selections for ${group.name}`, { variant: 'warning' });
        return prev;
      }

      return { ...prev, [group.id]: [...groupMods, { modifierId: mod.id, name: mod.name, price: Number(mod.price) }] };
    });
  };

  const isModSelected = (groupId: number, modId: number) =>
    (selectedMods[groupId] ?? []).some((m) => m.modifierId === modId);

  const isValid = modGroups
    .filter((mg) => mg.modifierGroup.required)
    .every((mg) => (selectedMods[mg.modifierGroup.id]?.length ?? 0) >= mg.modifierGroup.minSelect);

  const modTotal = Object.values(selectedMods).flat().reduce((s, m) => s + m.price, 0);
  const itemTotal = (Number(item.price) + modTotal) * quantity;

  return (
    <Dialog open={!!item} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: '#242424' } }}>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="h6" fontWeight={700}>{item.name}</Typography>
            {item.description && <Typography variant="caption" color="text.secondary">{item.description}</Typography>}
          </Box>
          <Typography variant="h6" color="primary" fontWeight={800}>${Number(item.price).toFixed(2)}</Typography>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        {/* Quantity */}
        <Box mb={3}>
          <Typography variant="subtitle2" gutterBottom fontWeight={600}>Quantity</Typography>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Button variant="outlined" size="small" onClick={() => setQuantity((q) => Math.max(1, q - 1))} sx={{ minWidth: 40, p: 1 }}>
              <Remove fontSize="small" />
            </Button>
            <Typography variant="h5" fontWeight={700}>{quantity}</Typography>
            <Button variant="outlined" size="small" onClick={() => setQuantity((q) => q + 1)} sx={{ minWidth: 40, p: 1 }}>
              <Add fontSize="small" />
            </Button>
          </Stack>
        </Box>

        {/* Course */}
        <Box mb={3}>
          <FormControl component="fieldset" size="small">
            <FormLabel component="legend" sx={{ fontSize: '0.875rem', fontWeight: 600, mb: 1 }}>Course</FormLabel>
            <RadioGroup row value={course} onChange={(e) => setCourse(parseInt(e.target.value))}>
              {[1, 2, 3].map((c) => (
                <FormControlLabel key={c} value={c} control={<Radio size="small" />} label={`Course ${c}`} />
              ))}
            </RadioGroup>
          </FormControl>
        </Box>

        {/* Modifier groups */}
        {modGroups.map(({ modifierGroup: group }) => (
          <Box key={group.id} mb={3}>
            <Stack direction="row" alignItems="center" spacing={1} mb={1}>
              <Typography variant="subtitle2" fontWeight={600}>{group.name}</Typography>
              {group.required && <Chip label="Required" size="small" color="error" sx={{ fontSize: '0.65rem', height: 18 }} />}
              {group.maxSelect && <Typography variant="caption" color="text.secondary">Max {group.maxSelect}</Typography>}
            </Stack>
            <Stack spacing={0.5}>
              {group.items.map((mod) => (
                <FormControlLabel
                  key={mod.id}
                  control={
                    group.multiSelect ? (
                      <Checkbox size="small" checked={isModSelected(group.id, mod.id)} onChange={() => toggleMod(group, mod)} />
                    ) : (
                      <Radio size="small" checked={isModSelected(group.id, mod.id)} onChange={() => toggleMod(group, mod)} />
                    )
                  }
                  label={
                    <Stack direction="row" justifyContent="space-between" width="100%" alignItems="center" minWidth={200}>
                      <Typography variant="body2">{mod.name}</Typography>
                      {Number(mod.price) > 0 && (
                        <Typography variant="body2" color="primary">+${Number(mod.price).toFixed(2)}</Typography>
                      )}
                    </Stack>
                  }
                  sx={{ mx: 0, width: '100%' }}
                />
              ))}
            </Stack>
          </Box>
        ))}

        {/* Notes */}
        <TextField
          label="Special instructions (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          fullWidth
          multiline
          rows={2}
          placeholder="e.g., extra crispy, no onions..."
        />
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button variant="outlined" onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={() => addMutation.mutate()}
          disabled={addMutation.isPending || !isValid}
          sx={{ minWidth: 160 }}
        >
          {addMutation.isPending ? <CircularProgress size={20} /> : `Add — $${itemTotal.toFixed(2)}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
