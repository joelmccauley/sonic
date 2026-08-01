import React, { useState } from 'react';
import {
  Box, Grid, Typography, Stack, TextField, InputAdornment,
  Paper, Button, Skeleton,
} from '@mui/material';
import { Search, Star, Block } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { menuApi } from '@/api/menu.api';
import type { MenuItem, MenuCategory } from '@/types';

interface MenuItemCardProps {
  item: MenuItem;
  onSelect: (item: MenuItem) => void;
}

function MenuItemCard({ item, onSelect }: MenuItemCardProps) {
  const isUnavailable = !item.isAvailable || !item.isActive;

  return (
    <Paper
      onClick={() => !isUnavailable && onSelect(item)}
      sx={{
        p: 1.5, cursor: isUnavailable ? 'not-allowed' : 'pointer', height: 110, position: 'relative', overflow: 'hidden',
        borderRadius: 2.5, opacity: isUnavailable ? 0.5 : 1,
        border: '1px solid rgba(255,255,255,0.06)',
        bgcolor: 'rgba(255,255,255,0.03)',
        transition: 'all 0.15s ease',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        '&:hover': !isUnavailable ? { bgcolor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(0,120,212,0.5)' } : {},
      }}
    >
      {item.isPopular && (
        <Box sx={{ position: 'absolute', top: 6, right: 6 }}>
          <Star sx={{ fontSize: 14, color: '#ff9800' }} />
        </Box>
      )}
      {isUnavailable && (
        <Box sx={{ position: 'absolute', top: 6, left: 6 }}>
          <Block sx={{ fontSize: 14, color: 'error.main' }} />
        </Box>
      )}
      <Box>
        <Typography variant="body2" fontWeight={600} lineHeight={1.3} sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {item.name}
        </Typography>
        {item.description && (
          <Typography variant="caption" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {item.description}
          </Typography>
        )}
      </Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="body1" fontWeight={800} color="primary">
          ${Number(item.price).toFixed(2)}
        </Typography>
        {item.calories && (
          <Typography variant="caption" color="text.disabled">{item.calories} cal</Typography>
        )}
      </Stack>
    </Paper>
  );
}

interface Props {
  onItemSelect: (item: MenuItem) => void;
}

export default function MenuGrid({ onItemSelect }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const { data: categories = [], isLoading: catLoading } = useQuery({
    queryKey: ['menu-categories'],
    queryFn: () => menuApi.getCategories().then((r) => r.data),
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['menu-items', selectedCategory],
    queryFn: () => menuApi.getItems({ categoryId: selectedCategory ?? undefined }).then((r) => r.data),
  });

  const filteredItems = search
    ? items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Search */}
      <Box sx={{ px: 2, pt: 2, pb: 1 }}>
        <TextField
          fullWidth size="small"
          placeholder="Search menu..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ color: 'text.secondary' }} /></InputAdornment> }}
        />
      </Box>

      {/* Category rail */}
      <Box
        sx={{
          px: 2,
          pb: 1.25,
          display: 'flex',
          gap: 1,
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollSnapType: 'x proximity',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.16) transparent',
          '&::-webkit-scrollbar': { height: 8 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.16)', borderRadius: 999 },
        }}
      >
        <Button
          onClick={() => setSelectedCategory(null)}
          variant={selectedCategory === null ? 'contained' : 'outlined'}
          sx={{
            flexShrink: 0,
            minHeight: 44,
            minWidth: 88,
            px: 2,
            borderColor: 'rgba(255,255,255,0.12)',
            scrollSnapAlign: 'start',
          }}
        >
          All
        </Button>
        {categories.map((cat) => {
          const selected = selectedCategory === cat.id;
          return (
            <Button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              variant={selected ? 'contained' : 'outlined'}
              sx={{
                flexShrink: 0,
                minHeight: 44,
                minWidth: 132,
                px: 2,
                justifyContent: 'flex-start',
                gap: 1,
                borderColor: selected ? cat.color : 'rgba(255,255,255,0.12)',
                bgcolor: selected ? cat.color : 'rgba(255,255,255,0.02)',
                color: selected ? '#fff' : 'text.secondary',
                '&:hover': {
                  borderColor: cat.color || 'primary.main',
                  bgcolor: selected ? cat.color : 'rgba(255,255,255,0.05)',
                },
                scrollSnapAlign: 'start',
              }}
            >
              <Box component="span" sx={{ fontSize: '1rem', lineHeight: 1 }}>
                {cat.icon || '•'}
              </Box>
              <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
                {cat.name}
              </Box>
            </Button>
          );
        })}
      </Box>

      {/* Items grid */}
      <Box sx={{
        flex: 1, overflow: 'auto', px: 2, pb: 2,
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(255,255,255,0.12) transparent',
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-track': { background: 'transparent' },
        '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.12)', borderRadius: 2 },
        '&::-webkit-scrollbar-thumb:hover': { background: 'rgba(255,255,255,0.22)' },
      }}>
        {itemsLoading ? (
          <Grid container spacing={1.5}>
            {Array.from({ length: 12 }).map((_, i) => (
              <Grid item xs={6} sm={4} md={3} key={i}>
                <Skeleton variant="rounded" height={110} />
              </Grid>
            ))}
          </Grid>
        ) : filteredItems.length === 0 ? (
          <Box textAlign="center" py={6} color="text.secondary">
            <Typography>No items found</Typography>
          </Box>
        ) : (
          <Grid container spacing={1.5}>
            {filteredItems.map((item) => (
              <Grid item xs={6} sm={4} md={3} key={item.id}>
                <MenuItemCard item={item} onSelect={onItemSelect} />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    </Box>
  );
}
