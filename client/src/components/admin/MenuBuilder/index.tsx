import React, { useState } from 'react';
import {
  Box, Grid, Paper, Typography, Stack, Chip, Button, IconButton, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions, Switch, FormControlLabel,
  InputAdornment, Tabs, Tab, Divider, CircularProgress, Alert, Tooltip, Collapse,
} from '@mui/material';
import {
  Add, Edit, Delete, ExpandMore, ExpandLess, DragIndicator, Image, ToggleOn,
  LocalOffer, Visibility, VisibilityOff, AttachMoney,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { menuApi } from '@/api/menu.api';
import type { MenuItem, MenuCategory, ModifierGroup, Modifier } from '@/types';
import { extractError } from '@/api/client';

function CategoryDialog({ open, onClose, category }: { open: boolean; onClose: () => void; category?: MenuCategory }) {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const [name, setName] = useState(category?.name ?? '');
  const [color, setColor] = useState(category?.color ?? '#1976d2');
  const [icon, setIcon] = useState(category?.icon ?? '');
  const [description, setDescription] = useState(category?.description ?? '');

  const mutation = useMutation({
    mutationFn: () => category
      ? menuApi.updateCategory(category.id, { name, color, icon, description })
      : menuApi.createCategory({ name, color, icon, description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-categories'] });
      enqueueSnackbar(category ? 'Category updated' : 'Category created', { variant: 'success' });
      onClose();
    },
    onError: (e) => enqueueSnackbar(extractError(e), { variant: 'error' }),
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { bgcolor: '#242424' } }}>
      <DialogTitle>{category ? 'Edit Category' : 'New Category'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth autoFocus />
          <TextField label="Icon (emoji)" value={icon} onChange={(e) => setIcon(e.target.value)} fullWidth placeholder="🍔" />
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="body2">Color:</Typography>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 48, height: 36, border: 'none', cursor: 'pointer', borderRadius: 4 }} />
            <Chip label={name || 'Preview'} sx={{ bgcolor: color + '33', color, fontWeight: 600 }} size="small" />
          </Stack>
          <TextField label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth multiline rows={2} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => mutation.mutate()} disabled={mutation.isPending || !name}>
          {mutation.isPending ? <CircularProgress size={20} /> : category ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function MenuItemDialog({ open, onClose, item, categories }: { open: boolean; onClose: () => void; item?: MenuItem; categories: MenuCategory[] }) {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const { data: modGroups = [] } = useQuery({ queryKey: ['modifier-groups'], queryFn: () => menuApi.getModifierGroups().then((r) => r.data) });

  const [name, setName] = useState(item?.name ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [price, setPrice] = useState(String(item?.price ?? ''));
  const [cost, setCost] = useState(String(item?.cost ?? ''));
  const [categoryId, setCategoryId] = useState<number>(item?.categoryId ?? categories[0]?.id ?? 1);
  const [isTaxable, setIsTaxable] = useState(item?.isTaxable ?? true);
  const [isPopular, setIsPopular] = useState(item?.isPopular ?? false);
  const [trackInventory, setTrackInventory] = useState(item?.trackInventory ?? false);
  const [calories, setCalories] = useState(String(item?.calories ?? ''));
  const [allergens, setAllergens] = useState(item?.allergens ?? '');
  const [selectedGroups, setSelectedGroups] = useState<number[]>(
    item?.modifierGroups?.map((mg) => mg.modifierGroup.id) ?? []
  );

  const mutation = useMutation({
    mutationFn: () => {
      const data = { name, description, price: parseFloat(price), cost: cost ? parseFloat(cost) : undefined, categoryId, isTaxable, isPopular, trackInventory, calories: calories ? parseInt(calories) : undefined, allergens: allergens || undefined, modifierGroupIds: selectedGroups };
      return item ? menuApi.updateItem(item.id, data) : menuApi.createItem(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      enqueueSnackbar(item ? 'Item updated' : 'Item created', { variant: 'success' });
      onClose();
    },
    onError: (e) => enqueueSnackbar(extractError(e), { variant: 'error' }),
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: '#242424' } }}>
      <DialogTitle>{item ? 'Edit Menu Item' : 'New Menu Item'}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} mt={0.25}>
          <Grid item xs={12}>
            <TextField label="Item Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth autoFocus required />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth multiline rows={2} />
          </Grid>
          <Grid item xs={6}>
            <TextField label="Price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} fullWidth required InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} inputProps={{ step: 0.01, min: 0 }} />
          </Grid>
          <Grid item xs={6}>
            <TextField label="Cost (optional)" type="number" value={cost} onChange={(e) => setCost(e.target.value)} fullWidth InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} inputProps={{ step: 0.01, min: 0 }} />
          </Grid>
          <Grid item xs={12}>
            <TextField select label="Category" value={categoryId} onChange={(e) => setCategoryId(parseInt(e.target.value))} fullWidth>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </TextField>
          </Grid>
          <Grid item xs={6}>
            <TextField label="Calories (optional)" type="number" value={calories} onChange={(e) => setCalories(e.target.value)} fullWidth />
          </Grid>
          <Grid item xs={6}>
            <TextField label="Allergens (optional)" value={allergens} onChange={(e) => setAllergens(e.target.value)} fullWidth placeholder="Nuts, Dairy..." />
          </Grid>
          <Grid item xs={12}>
            <Stack direction="row" spacing={2} flexWrap="wrap">
              <FormControlLabel control={<Switch checked={isTaxable} onChange={(e) => setIsTaxable(e.target.checked)} />} label="Taxable" />
              <FormControlLabel control={<Switch checked={isPopular} onChange={(e) => setIsPopular(e.target.checked)} />} label="Popular ⭐" />
              <FormControlLabel control={<Switch checked={trackInventory} onChange={(e) => setTrackInventory(e.target.checked)} />} label="Track Inventory" />
            </Stack>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>Modifier Groups</Typography>
            <Stack direction="row" flexWrap="wrap" gap={0.75}>
              {modGroups.map((g) => (
                <Chip key={g.id} label={g.name} clickable
                  variant={selectedGroups.includes(g.id) ? 'filled' : 'outlined'}
                  color={selectedGroups.includes(g.id) ? 'primary' : 'default'}
                  onClick={() => setSelectedGroups((prev) => prev.includes(g.id) ? prev.filter((id) => id !== g.id) : [...prev, g.id])}
                  size="small"
                />
              ))}
            </Stack>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => mutation.mutate()} disabled={mutation.isPending || !name || !price}>
          {mutation.isPending ? <CircularProgress size={20} /> : item ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function MenuBuilder() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [tab, setTab] = useState(0);
  const [categoryDialog, setCategoryDialog] = useState<{ open: boolean; category?: MenuCategory }>({ open: false });
  const [itemDialog, setItemDialog] = useState<{ open: boolean; item?: MenuItem }>({ open: false });
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  const { data: categories = [] } = useQuery({ queryKey: ['menu-categories'], queryFn: () => menuApi.getCategories().then((r) => r.data) });
  const { data: items = [], isLoading } = useQuery({ queryKey: ['menu-items', selectedCategory], queryFn: () => menuApi.getItems({ categoryId: selectedCategory ?? undefined }).then((r) => r.data) });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => menuApi.toggleItem(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['menu-items'] }),
  });

  const availabilityMutation = useMutation({
    mutationFn: ({ id, available }: { id: number; available: boolean }) => menuApi.setAvailability(id, available),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['menu-items'] }),
  });

  const deleteCatMutation = useMutation({
    mutationFn: (id: number) => menuApi.deleteCategory(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['menu-categories'] }); enqueueSnackbar('Category removed', { variant: 'info' }); },
  });

  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={700}>Menu Builder</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<Add />} onClick={() => setCategoryDialog({ open: true })}>Add Category</Button>
          <Button variant="contained" startIcon={<Add />} onClick={() => setItemDialog({ open: true })}>Add Item</Button>
        </Stack>
      </Stack>

      <Grid container spacing={3}>
        {/* Categories sidebar */}
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2, bgcolor: '#1e1e1e' }}>
            <Typography variant="subtitle2" fontWeight={700} mb={1.5}>Categories</Typography>
            <Stack spacing={0.75}>
              <Chip label="All Items" clickable onClick={() => setSelectedCategory(null)} variant={selectedCategory === null ? 'filled' : 'outlined'} color={selectedCategory === null ? 'primary' : 'default'} />
              {categories.map((cat) => (
                <Box key={cat.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Chip
                    label={`${cat.icon ?? ''} ${cat.name} (${cat._count?.items ?? 0})`}
                    clickable
                    onClick={() => setSelectedCategory(cat.id)}
                    variant={selectedCategory === cat.id ? 'filled' : 'outlined'}
                    size="small"
                    sx={{ flex: 1, borderColor: cat.color, color: selectedCategory === cat.id ? undefined : cat.color }}
                  />
                  <IconButton size="small" onClick={() => setCategoryDialog({ open: true, category: cat })}><Edit sx={{ fontSize: 14 }} /></IconButton>
                  <IconButton size="small" color="error" onClick={() => deleteCatMutation.mutate(cat.id)}><Delete sx={{ fontSize: 14 }} /></IconButton>
                </Box>
              ))}
            </Stack>
          </Paper>
        </Grid>

        {/* Items list */}
        <Grid item xs={12} md={9}>
          {isLoading ? <CircularProgress /> : (
            <Grid container spacing={1.5}>
              {items.map((item) => (
                <Grid item xs={12} sm={6} lg={4} key={item.id}>
                  <Paper sx={{ p: 2, bgcolor: '#1e1e1e', opacity: item.isActive ? 1 : 0.5, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box flex={1}>
                        <Stack direction="row" alignItems="center" spacing={0.75}>
                          <Typography variant="body1" fontWeight={700}>{item.name}</Typography>
                          {item.isPopular && <Typography variant="caption">⭐</Typography>}
                          {!item.isAvailable && <Chip label="86'd" size="small" color="error" sx={{ fontSize: '0.6rem', height: 16 }} />}
                        </Stack>
                        <Typography variant="h6" color="primary" fontWeight={800}>${Number(item.price).toFixed(2)}</Typography>
                        {item.category && <Chip label={item.category.name} size="small" sx={{ fontSize: '0.65rem', height: 18, mt: 0.5 }} />}
                      </Box>
                      <Stack spacing={0.5}>
                        <Tooltip title={item.isActive ? 'Disable item' : 'Enable item'}>
                          <IconButton size="small" onClick={() => toggleMutation.mutate(item.id)}>
                            {item.isActive ? <Visibility fontSize="small" color="success" /> : <VisibilityOff fontSize="small" color="error" />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={item.isAvailable ? 'Mark 86\'d' : 'Mark available'}>
                          <IconButton size="small" onClick={() => availabilityMutation.mutate({ id: item.id, available: !item.isAvailable })}>
                            <ToggleOn fontSize="small" color={item.isAvailable ? 'success' : 'disabled'} />
                          </IconButton>
                        </Tooltip>
                        <IconButton size="small" onClick={() => setItemDialog({ open: true, item })}>
                          <Edit fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Stack>
                    {item.description && <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>{item.description}</Typography>}
                    {(item.modifierGroups?.length ?? 0) > 0 && (
                      <Stack direction="row" flexWrap="wrap" gap={0.5} mt={1}>
                        {item.modifierGroups!.map((mg) => (
                          <Chip key={mg.modifierGroup.id} label={mg.modifierGroup.name} size="small" variant="outlined" sx={{ fontSize: '0.6rem', height: 16 }} />
                        ))}
                      </Stack>
                    )}
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </Grid>
      </Grid>

      <CategoryDialog open={categoryDialog.open} category={categoryDialog.category} onClose={() => setCategoryDialog({ open: false })} />
      <MenuItemDialog open={itemDialog.open} item={itemDialog.item} categories={categories} onClose={() => setItemDialog({ open: false })} />
    </Box>
  );
}
