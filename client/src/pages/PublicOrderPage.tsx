import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, Container, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, FormControl, FormControlLabel, Grid, IconButton, InputLabel, MenuItem as MuiMenuItem,
  Paper, Radio, RadioGroup, Select, Stack, Tab, Tabs, TextField, Typography, Checkbox,
  List, ListItem, ListItemText, ListItemButton, Badge, CircularProgress, Drawer,
} from '@mui/material';
import {
  Add, Remove, ShoppingBag, LockOpen, ReceiptLong, Search, Storefront, LocalMall, ShoppingCart,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { publicOrderingApi, type PublicCheckoutInput, type PublicStorefront } from '@/api/publicOrdering.api';
import { useCustomerSessionStore } from '@/store/customerSessionStore';
import type { CartModifier, MenuItem as MenuItemType, Order, Customer } from '@/types';
import { extractError } from '@/api/client';
import { PUBLIC_ORDER_TYPE_SETTINGS } from '@/config/orderTypes';

interface CartLine {
  id: string;
  menuItemId: number;
  name: string;
  unitPrice: number;
  quantity: number;
  notes?: string;
  course: number;
  modifiers: CartModifier[];
}

interface ModifierDraftState {
  [groupId: number]: number[];
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function currency(amount: number) {
  return `$${round2(amount).toFixed(2)}`;
}

function cartItemTotal(item: CartLine) {
  const base = item.unitPrice * item.quantity;
  const mods = item.modifiers.reduce((sum, modifier) => sum + modifier.price, 0) * item.quantity;
  return round2(base + mods);
}

function orderTotal(items: CartLine[]) {
  return round2(items.reduce((sum, item) => sum + cartItemTotal(item), 0));
}

function splitCustomerName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? name.trim(), lastName: parts.slice(1).join(' ') || '' };
}

function normalizeHexColor(value: string | null | undefined, fallback: string) {
  const candidate = (value ?? '').trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(candidate) ? candidate : fallback;
}

export default function PublicOrderPage() {
  const { slug = '' } = useParams();
  const queryClient = useQueryClient();
  const { token: customerToken, customer: cachedCustomer, login: loginCustomer, logout: logoutCustomer, isAuthenticated } = useCustomerSessionStore();

  const [tab, setTab] = useState(0);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [categoryId, setCategoryId] = useState<number | 'all'>('all');
  const [checkoutName, setCheckoutName] = useState('');
  const [checkoutEmail, setCheckoutEmail] = useState('');
  const [checkoutPassword, setCheckoutPassword] = useState('');
  const [checkoutPhone, setCheckoutPhone] = useState('');
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [guestCount, setGuestCount] = useState('1');
  const [createAccount, setCreateAccount] = useState(true);
  const [emailOptIn, setEmailOptIn] = useState(true);
  const [textOptIn, setTextOptIn] = useState(true);
  const [orderType, setOrderType] = useState<'TO_GO' | 'DELIVERY' | 'DINE_IN'>('TO_GO');
  const [trackOrderNumber, setTrackOrderNumber] = useState('');
  const [trackIdentifier, setTrackIdentifier] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [dialogItem, setDialogItem] = useState<MenuItemType | null>(null);
  const [dialogQuantity, setDialogQuantity] = useState('1');
  const [dialogNotes, setDialogNotes] = useState('');
  const [modifierDraft, setModifierDraft] = useState<ModifierDraftState>({});
  const [errorMessage, setErrorMessage] = useState('');
  const [successOrder, setSuccessOrder] = useState<Order | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  const storefrontQuery = useQuery({
    queryKey: ['public-storefront', slug],
    queryFn: () => publicOrderingApi.getStorefront(slug).then((response) => response.data),
    enabled: Boolean(slug),
  });

  const customerAccountQuery = useQuery({
    queryKey: ['public-customer-account', slug, customerToken],
    queryFn: () => publicOrderingApi.getMe(slug).then((response) => response.data),
    enabled: Boolean(slug && customerToken),
  });

  const placeOrderMutation = useMutation({
    mutationFn: (payload: PublicCheckoutInput) => publicOrderingApi.placeOrder(slug, payload),
    onSuccess: (response) => {
      const { data } = response;
      loginCustomer(data.token, data.customer);
      setRecentOrders(data.recentOrders);
      setSuccessOrder(data.order);
      setCart([]);
      setCheckoutNotes('');
      setCheckoutName('');
      setCheckoutEmail('');
      setCheckoutPassword('');
      setCheckoutPhone('');
      setGuestCount('1');
      setCreateAccount(true);
      setEmailOptIn(true);
      setTextOptIn(true);
      setCartOpen(false);
      setTab(1);
      queryClient.invalidateQueries({ queryKey: ['public-customer-account', slug] });
    },
    onError: (error) => setErrorMessage(extractError(error)),
  });

  const customerLoginMutation = useMutation({
    mutationFn: () => publicOrderingApi.loginCustomer(slug, { orderNumber: trackOrderNumber, identifier: trackIdentifier }),
    onSuccess: ({ data }) => {
      loginCustomer(data.token, data.customer);
      setRecentOrders(data.recentOrders);
      setTab(1);
      queryClient.invalidateQueries({ queryKey: ['public-customer-account', slug] });
    },
    onError: (error) => setErrorMessage(extractError(error)),
  });

  const customerPasswordLoginMutation = useMutation({
    mutationFn: () => publicOrderingApi.loginCustomerWithPassword(slug, { email: loginEmail, password: loginPassword }),
    onSuccess: ({ data }) => {
      loginCustomer(data.token, data.customer);
      setRecentOrders(data.recentOrders);
      setLoginPassword('');
      setTab(1);
      queryClient.invalidateQueries({ queryKey: ['public-customer-account', slug] });
    },
    onError: (error) => setErrorMessage(extractError(error)),
  });

  const store = storefrontQuery.data?.store;
  const categories = storefrontQuery.data?.categories ?? [];
  const items = storefrontQuery.data?.items ?? [];
  const activeCategoryId = categoryId === 'all' ? null : categoryId;
  const theme = store?.storefrontTheme;
  const enabledOrderTypes = useMemo(
    () => PUBLIC_ORDER_TYPE_SETTINGS.filter(({ type }) => store?.orderTypes?.[type] !== false),
    [store?.orderTypes],
  );
  const themeColors = {
    background: normalizeHexColor(theme?.backgroundColor, '#05070d'),
    surface: normalizeHexColor(theme?.surfaceColor, '#111722'),
    surfaceAlt: normalizeHexColor(theme?.surfaceAltColor, '#0e1420'),
    primary: normalizeHexColor(theme?.primaryColor, '#7db4e8'),
    accent: normalizeHexColor(theme?.accentColor, '#1d5fae'),
    border: normalizeHexColor(theme?.borderColor, '#1f2a38'),
    mutedText: normalizeHexColor(theme?.mutedTextColor, '#9fb4cc'),
    text: normalizeHexColor(theme?.textColor, '#e8eef7'),
  };

  const filteredItems = useMemo(() => {
    if (!activeCategoryId) return items;
    return items.filter((item) => item.categoryId === activeCategoryId);
  }, [items, activeCategoryId]);

  const preferredOrderType = enabledOrderTypes.find((option) => option.type === 'TO_GO')?.type ?? enabledOrderTypes[0]?.type ?? 'TO_GO';

  useEffect(() => {
    if (!enabledOrderTypes.some((option) => option.type === orderType) && enabledOrderTypes.length > 0) {
      setOrderType(preferredOrderType);
    }
  }, [enabledOrderTypes, orderType, preferredOrderType]);

  const account = customerAccountQuery.data?.customer ?? cachedCustomer;
  const accountOrders = customerAccountQuery.data?.orders ?? recentOrders;

  const openModifierDialog = (item: MenuItemType) => {
    setDialogItem(item);
    setDialogQuantity('1');
    setDialogNotes('');
    const seed: ModifierDraftState = {};
    item.modifierGroups?.forEach((selection) => {
      const { modifierGroup } = selection;
      seed[modifierGroup.id] = modifierGroup.required && modifierGroup.items[0] ? [modifierGroup.items[0].id] : [];
    });
    setModifierDraft(seed);
  };

  const closeModifierDialog = () => {
    setDialogItem(null);
    setModifierDraft({});
    setDialogQuantity('1');
    setDialogNotes('');
  };

  const addToCart = (item: MenuItemType, modifiers: CartModifier[], quantity = 1, notes?: string) => {
    setCart((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        menuItemId: item.id,
        name: item.name,
        unitPrice: Number(item.price),
        quantity,
        notes,
        course: 1,
        modifiers,
      },
    ]);
  };

  const handleConfirmItem = () => {
    if (!dialogItem) return;
    const selectedModifiers: CartModifier[] = [];
    const violations: string[] = [];

    dialogItem.modifierGroups?.forEach((selection) => {
      const { modifierGroup } = selection;
      const selectedIds = modifierDraft[modifierGroup.id] ?? [];
      if (modifierGroup.required && selectedIds.length === 0) {
        violations.push(`${modifierGroup.name} is required`);
        return;
      }
      if (modifierGroup.maxSelect && selectedIds.length > modifierGroup.maxSelect) {
        violations.push(`${modifierGroup.name} allows at most ${modifierGroup.maxSelect} selections`);
        return;
      }
      selectedIds.forEach((modifierId) => {
        const modifier = modifierGroup.items.find((candidate) => candidate.id === modifierId);
        if (modifier) {
          selectedModifiers.push({ modifierId: modifier.id, name: modifier.name, price: Number(modifier.price) });
        }
      });
    });

    if (violations.length > 0) {
      setErrorMessage(violations[0]);
      return;
    }

    addToCart(dialogItem, selectedModifiers, parseInt(dialogQuantity, 10) || 1, dialogNotes || undefined);
    closeModifierDialog();
  };

  const submitCheckout = () => {
    setErrorMessage('');
    if (!store) return;
    if (!checkoutName.trim()) {
      setErrorMessage('Enter the customer name for the order.');
      return;
    }
    if (createAccount && !checkoutEmail.trim()) {
      setErrorMessage('Enter an email to create a returning customer account.');
      return;
    }
    if (createAccount && checkoutPassword.trim().length < 8) {
      setErrorMessage('Choose a password with at least 8 characters.');
      return;
    }
    if (cart.length === 0) {
      setErrorMessage('Add at least one item to the cart.');
      return;
    }

    placeOrderMutation.mutate({
      type: orderType,
      customerName: checkoutName,
      customerEmail: checkoutEmail || undefined,
      customerPassword: createAccount ? checkoutPassword || undefined : undefined,
      customerPhone: checkoutPhone || undefined,
      emailOptIn: createAccount ? emailOptIn : false,
      textOptIn: createAccount ? textOptIn : false,
      notes: checkoutNotes || undefined,
      guestCount: parseInt(guestCount, 10) || 1,
      items: cart.map((line) => ({
        menuItemId: line.menuItemId,
        quantity: line.quantity,
        notes: line.notes,
        course: line.course,
        modifiers: line.modifiers.map((modifier) => ({ modifierId: modifier.modifierId })),
      })),
    });
  };

  const trackedOrders = isAuthenticated ? accountOrders : recentOrders;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: themeColors.background, color: themeColors.text, pb: 6 }}>
      <Box sx={{
        bgcolor: `${themeColors.background}f0`,
        borderBottom: `1px solid ${themeColors.border}`,
        backdropFilter: 'blur(16px)',
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}>
        <Container maxWidth="xl" sx={{ py: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Box sx={{ width: 52, height: 52, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(29,95,174,0.18)', border: '1px solid rgba(120,170,230,0.18)', overflow: 'hidden' }}>
                {store?.logoUrl ? (
                  <Box
                    component="img"
                    src={store.logoUrl}
                    alt={store.name ?? 'Tenant logo'}
                    sx={{ width: '100%', height: '100%', objectFit: 'contain', p: 0.5 }}
                  />
                ) : (
                  <Storefront sx={{ color: '#7db4e8' }} />
                )}
              </Box>
              <Box>
                <Typography variant="h5" fontWeight={800}>{store?.name ?? 'Online Ordering'}</Typography>
                <Typography variant="body2" sx={{ color: themeColors.mutedText }}>Order online and track it on the same customer session.</Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip label={slug ? `/${slug}` : 'storefront'} sx={{ bgcolor: `${themeColors.primary}1f`, color: themeColors.primary, borderColor: themeColors.border }} variant="outlined" />
              {!isAuthenticated && (
                <Button
                  variant="outlined"
                  onClick={() => setTab(1)}
                  sx={{ borderColor: themeColors.border, color: themeColors.primary }}
                >
                  Returning customer sign in
                </Button>
              )}
              <Button
                variant="outlined"
                onClick={() => setCartOpen(true)}
                sx={{ borderColor: themeColors.border, color: themeColors.primary, minWidth: 0, px: 1.25 }}
                startIcon={
                  <Badge badgeContent={cart.length} color="primary" showZero>
                    <ShoppingCart fontSize="small" />
                  </Badge>
                }
              >
                {currency(orderTotal(cart))}
              </Button>
              {isAuthenticated && (
                <>
                  <Chip label={`Signed in as ${account?.firstName ?? 'customer'}`} color="success" variant="outlined" />
                  <Button
                    variant="outlined"
                    onClick={() => {
                      logoutCustomer();
                      setRecentOrders([]);
                    }}
                    sx={{ borderColor: themeColors.border, color: themeColors.primary }}
                  >
                    Sign out
                  </Button>
                </>
              )}
            </Stack>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="xl" sx={{ mt: 4 }}>
        {!slug && (
          <Alert severity="info" sx={{ mb: 2 }}>Open a tenant storefront at /order/&lt;store-slug&gt;.</Alert>
        )}
        {storefrontQuery.isLoading && (
          <Box sx={{ py: 10, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>
        )}
        {storefrontQuery.error && (
          <Alert severity="error" sx={{ mb: 2 }}>{extractError(storefrontQuery.error)}</Alert>
        )}
        {errorMessage && <Alert severity="error" sx={{ mb: 2 }}>{errorMessage}</Alert>}
        {successOrder && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Order {successOrder.orderNumber} has been placed. The kitchen will see it in the existing POS flow.
          </Alert>
        )}

        {store && (
          <Grid container spacing={3} alignItems="flex-start">
            <Grid item xs={12}>
              <Paper sx={{ bgcolor: themeColors.surfaceAlt, border: `1px solid ${themeColors.border}`, mb: 3 }}>
                <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="fullWidth" textColor="inherit" indicatorColor="primary">
                  <Tab icon={<ShoppingBag />} iconPosition="start" label="Order Online" />
                  <Tab icon={<LockOpen />} iconPosition="start" label="My Orders" />
                </Tabs>
              </Paper>

              {tab === 0 && (
                <Stack spacing={3}>
                  {!isAuthenticated && (
                    <Paper sx={{ p: 2.5, bgcolor: themeColors.surface, border: `1px solid ${themeColors.border}` }}>
                      <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={2}
                        justifyContent="space-between"
                        alignItems={{ xs: 'flex-start', md: 'center' }}
                      >
                        <Box>
                          <Typography variant="h6" fontWeight={700}>Returning customer?</Typography>
                          <Typography variant="body2" sx={{ color: themeColors.mutedText }}>
                            Sign in with your email and password to reuse your customer account on future visits.
                          </Typography>
                        </Box>
                        <Button
                          variant="contained"
                          onClick={() => setTab(1)}
                          sx={{ bgcolor: themeColors.accent, '&:hover': { bgcolor: themeColors.primary } }}
                        >
                          Sign in
                        </Button>
                      </Stack>
                    </Paper>
                  )}

                  <Paper sx={{ p: 2.5, bgcolor: themeColors.surface, border: `1px solid ${themeColors.border}` }}>
                    <Stack spacing={1.5}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }}>
                        <Typography variant="subtitle2" sx={{ color: themeColors.mutedText, minWidth: { sm: 84 } }}>
                          Categories
                        </Typography>
                        <Chip label={`Cart ${cart.length}`} sx={{ borderColor: themeColors.border, color: themeColors.primary }} variant="outlined" />
                        <Chip label={`Estimated ${currency(orderTotal(cart))}`} sx={{ borderColor: themeColors.border, color: themeColors.primary }} variant="outlined" />
                      </Stack>

                      <Box
                        sx={{
                          display: 'flex',
                          gap: 1,
                          overflowX: 'auto',
                          pb: 0.5,
                          scrollSnapType: 'x proximity',
                          '&::-webkit-scrollbar': { height: 8 },
                          '&::-webkit-scrollbar-track': { background: 'transparent' },
                          '&::-webkit-scrollbar-thumb': { background: themeColors.border, borderRadius: 999 },
                        }}
                      >
                        <Button
                          variant={categoryId === 'all' ? 'contained' : 'outlined'}
                          onClick={() => setCategoryId('all')}
                          sx={{
                            flexShrink: 0,
                            minWidth: 112,
                            minHeight: 52,
                            px: 2,
                            borderColor: themeColors.border,
                            color: categoryId === 'all' ? themeColors.text : themeColors.primary,
                            bgcolor: categoryId === 'all' ? themeColors.accent : 'transparent',
                            '&:hover': {
                              borderColor: themeColors.primary,
                              bgcolor: categoryId === 'all' ? themeColors.primary : `${themeColors.primary}12`,
                            },
                            scrollSnapAlign: 'start',
                          }}
                        >
                          All Items
                        </Button>

                        {categories.map((category) => {
                          const selected = categoryId === category.id;
                          return (
                            <Button
                              key={category.id}
                              variant={selected ? 'contained' : 'outlined'}
                              onClick={() => setCategoryId(category.id)}
                              sx={{
                                flexShrink: 0,
                                minWidth: 140,
                                minHeight: 52,
                                px: 2,
                                justifyContent: 'flex-start',
                                gap: 1,
                                borderColor: themeColors.border,
                                color: selected ? themeColors.text : themeColors.text,
                                bgcolor: selected ? themeColors.accent : themeColors.surfaceAlt,
                                '&:hover': {
                                  borderColor: category.color || themeColors.primary,
                                  bgcolor: selected ? themeColors.primary : `${themeColors.primary}12`,
                                },
                                scrollSnapAlign: 'start',
                              }}
                            >
                              <Box component="span" sx={{ fontSize: '1.1rem', lineHeight: 1 }}>
                                {category.icon || '•'}
                              </Box>
                              <Box component="span" sx={{ textAlign: 'left', lineHeight: 1.15 }}>
                                {category.name}
                              </Box>
                            </Button>
                          );
                        })}
                      </Box>
                    </Stack>
                  </Paper>

                  <Grid container spacing={2}>
                    {filteredItems.map((item) => (
                      <Grid item xs={12} md={6} key={item.id}>
                        <Card sx={{ bgcolor: themeColors.surfaceAlt, border: `1px solid ${themeColors.border}`, height: '100%' }}>
                          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            <Stack direction="row" justifyContent="space-between" spacing={2}>
                              <Box>
                                <Typography variant="h6" fontWeight={700}>{item.name}</Typography>
                                <Typography variant="body2" sx={{ color: themeColors.mutedText }}>{item.description || item.category?.name}</Typography>
                              </Box>
                              <Typography variant="h6" fontWeight={800}>{currency(Number(item.price))}</Typography>
                            </Stack>
                            {item.modifierGroups?.length ? (
                              <Typography variant="caption" sx={{ color: themeColors.mutedText }}>
                                Customizations available: {item.modifierGroups.map(({ modifierGroup }) => modifierGroup.name).join(', ')}
                              </Typography>
                            ) : null}
                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                              <Button variant="outlined" sx={{ borderColor: themeColors.border, color: themeColors.primary }} onClick={() => openModifierDialog(item)}>Customize</Button>
                              <Button variant="contained" sx={{ bgcolor: themeColors.accent, '&:hover': { bgcolor: themeColors.primary } }} onClick={() => addToCart(item, [])}>Add</Button>
                            </Stack>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Stack>
              )}

              {tab === 1 && (
                <Stack spacing={2.5}>
                  <Paper sx={{ p: 3, bgcolor: themeColors.surface, border: `1px solid ${themeColors.border}` }}>
                    <Typography variant="h6" fontWeight={700} mb={2}>Returning customer sign in</Typography>
                    <Typography variant="body2" sx={{ color: themeColors.mutedText }} mb={2}>
                      Use your email and password. If you do not have a password yet, you can still look up an older order below.
                    </Typography>
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      <Grid item xs={12} md={5}><TextField fullWidth label="Email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} /></Grid>
                      <Grid item xs={12} md={4}><TextField fullWidth label="Password" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} /></Grid>
                      <Grid item xs={12} md={3} sx={{ display: 'flex', alignItems: 'center' }}>
                        <Button
                          fullWidth
                          variant="contained"
                          onClick={() => { setErrorMessage(''); customerPasswordLoginMutation.mutate(); }}
                          disabled={customerPasswordLoginMutation.isPending || !loginEmail || !loginPassword}
                          sx={{ bgcolor: themeColors.accent, '&:hover': { bgcolor: themeColors.primary } }}
                        >
                          {customerPasswordLoginMutation.isPending ? 'Signing in...' : 'Sign in'}
                        </Button>
                      </Grid>
                    </Grid>
                    <Divider sx={{ borderColor: themeColors.border, mb: 2 }} />
                    <Typography variant="subtitle2" fontWeight={700} mb={1}>Order lookup fallback</Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={4}><TextField fullWidth label="Order number" value={trackOrderNumber} onChange={(e) => setTrackOrderNumber(e.target.value)} /></Grid>
                      <Grid item xs={12} md={4}><TextField fullWidth label="Email or phone" value={trackIdentifier} onChange={(e) => setTrackIdentifier(e.target.value)} /></Grid>
                      <Grid item xs={12} md={4} sx={{ display: 'flex', alignItems: 'center' }}>
                        <Button
                          fullWidth
                          variant="contained"
                          startIcon={<Search />}
                          onClick={() => { setErrorMessage(''); customerLoginMutation.mutate(); }}
                          disabled={customerLoginMutation.isPending || !trackOrderNumber || !trackIdentifier}
                        >
                          {customerLoginMutation.isPending ? 'Checking...' : 'View orders'}
                        </Button>
                      </Grid>
                    </Grid>
                  </Paper>

                  {isAuthenticated && account && (
                    <Paper sx={{ p: 3, bgcolor: themeColors.surface, border: `1px solid ${themeColors.border}` }}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} mb={2}>
                        <Box>
                          <Typography variant="h6" fontWeight={700}>Welcome back, {account.firstName}</Typography>
                          <Typography variant="body2" sx={{ color: themeColors.mutedText }}>You are signed in to your customer order session.</Typography>
                        </Box>
                        <Button variant="outlined" sx={{ borderColor: themeColors.border, color: themeColors.primary }} onClick={() => { logoutCustomer(); setRecentOrders([]); }}>Sign out</Button>
                      </Stack>
                      <Divider sx={{ borderColor: themeColors.border, mb: 2 }} />
                      <Stack spacing={1.5}>
                        {(trackedOrders ?? []).slice(0, 5).map((order) => (
                          <Paper key={order.id} sx={{ p: 2, bgcolor: themeColors.surfaceAlt, border: `1px solid ${themeColors.border}` }}>
                            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                              <Box>
                                <Typography fontWeight={700}>{order.orderNumber}</Typography>
                                <Typography variant="body2" sx={{ color: themeColors.mutedText }}>Placed {new Date(order.createdAt).toLocaleString()}</Typography>
                              </Box>
                              <Chip label={order.status} size="small" color={order.status === 'PAID' ? 'success' : 'default'} />
                            </Stack>
                            <Typography variant="caption" sx={{ color: themeColors.mutedText }}>
                              {order.items.map((item) => `${item.quantity}x ${item.menuItem?.name}`).join(' • ')}
                            </Typography>
                          </Paper>
                        ))}
                        {trackedOrders.length === 0 && <Typography sx={{ color: themeColors.mutedText }}>No orders found yet.</Typography>}
                      </Stack>
                    </Paper>
                  )}
                </Stack>
              )}
            </Grid>
          </Grid>
        )}
      </Container>

      <Drawer
        anchor="right"
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 460 },
            bgcolor: themeColors.surface,
            color: themeColors.text,
            borderLeft: `1px solid ${themeColors.border}`,
          },
        }}
      >
        <Box sx={{ p: { xs: 2, sm: 3 }, height: '100%', overflowY: 'auto' }}>
          <Stack spacing={2.25}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <LocalMall />
                <Typography variant="h6" fontWeight={700}>Cart & Checkout</Typography>
              </Stack>
              <Chip label={`${cart.length} items`} sx={{ borderColor: themeColors.border, color: themeColors.primary }} variant="outlined" />
            </Stack>

            <Stack spacing={1}>
              {cart.map((line) => (
                <Paper key={line.id} sx={{ p: 1.5, bgcolor: themeColors.surfaceAlt, border: `1px solid ${themeColors.border}` }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                    <Box>
                      <Typography fontWeight={700}>{line.quantity}x {line.name}</Typography>
                      {line.modifiers.length > 0 && (
                        <Typography variant="caption" sx={{ color: themeColors.mutedText }}>
                          {line.modifiers.map((modifier) => modifier.name).join(', ')}
                        </Typography>
                      )}
                    </Box>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography fontWeight={700}>{currency(cartItemTotal(line))}</Typography>
                      <IconButton size="small" onClick={() => setCart((current) => current.filter((item) => item.id !== line.id))}>
                        <Remove fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
              {cart.length === 0 && <Typography sx={{ color: themeColors.mutedText }}>Your cart is empty.</Typography>}
            </Stack>

            <Divider sx={{ borderColor: themeColors.border }} />

            <TextField label="Name" value={checkoutName} onChange={(e) => setCheckoutName(e.target.value)} fullWidth />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}><TextField label="Email" value={checkoutEmail} onChange={(e) => setCheckoutEmail(e.target.value)} fullWidth /></Grid>
              <Grid item xs={12} sm={6}><TextField label="Phone" value={checkoutPhone} onChange={(e) => setCheckoutPhone(e.target.value)} fullWidth /></Grid>
            </Grid>
            {createAccount && (
              <TextField
                label="Password"
                type="password"
                value={checkoutPassword}
                onChange={(e) => setCheckoutPassword(e.target.value)}
                helperText="Use this password to sign in on future visits."
                fullWidth
              />
            )}
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Order Type</InputLabel>
                  <Select label="Order Type" value={orderType} onChange={(e) => setOrderType(e.target.value as any)}>
                    {enabledOrderTypes.map(({ type, label }) => (
                      <MuiMenuItem key={type} value={type}>{label}</MuiMenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}><TextField label="Guests" type="number" value={guestCount} onChange={(e) => setGuestCount(e.target.value)} fullWidth /></Grid>
            </Grid>
            <TextField label="Notes" value={checkoutNotes} onChange={(e) => setCheckoutNotes(e.target.value)} multiline minRows={3} fullWidth />

            <Paper sx={{ p: 2, bgcolor: themeColors.surfaceAlt, border: `1px solid ${themeColors.border}` }}>
              <Stack spacing={1.25}>
                <FormControlLabel
                  control={<Checkbox checked={createAccount} onChange={(e) => setCreateAccount(e.target.checked)} />}
                  label="Create a customer account for this order"
                />
                <Typography variant="caption" sx={{ color: themeColors.mutedText }}>
                  This saves your details so you can track future orders and receive campaign messages.
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <FormControlLabel
                    control={<Checkbox checked={emailOptIn} onChange={(e) => setEmailOptIn(e.target.checked)} />}
                    label="Email notifications"
                  />
                  <FormControlLabel
                    control={<Checkbox checked={textOptIn} onChange={(e) => setTextOptIn(e.target.checked)} />}
                    label="Text notifications"
                  />
                </Stack>
                <Typography variant="caption" sx={{ color: themeColors.mutedText }}>
                  Email and text notifications are enabled by default. You can uncheck either one.
                </Typography>
              </Stack>
            </Paper>

            <Divider sx={{ borderColor: themeColors.border }} />
            <Stack direction="row" justifyContent="space-between">
              <Typography sx={{ color: themeColors.mutedText }}>Estimated total</Typography>
              <Typography variant="h6" fontWeight={800}>{currency(orderTotal(cart))}</Typography>
            </Stack>
            <Button
              variant="contained"
              size="large"
              startIcon={<ReceiptLong />}
              onClick={submitCheckout}
              disabled={placeOrderMutation.isPending || cart.length === 0}
              sx={{ bgcolor: themeColors.accent, '&:hover': { bgcolor: themeColors.primary } }}
            >
              {placeOrderMutation.isPending ? 'Placing order...' : 'Place order'}
            </Button>
          </Stack>
        </Box>
      </Drawer>

      <Box
        sx={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          p: 1,
          display: { xs: 'block', md: 'none' },
          zIndex: 25,
        }}
      >
        <Button
          fullWidth
          variant="contained"
          onClick={() => setCartOpen(true)}
          startIcon={<ShoppingCart />}
          sx={{
            bgcolor: themeColors.accent,
            '&:hover': { bgcolor: themeColors.primary },
            py: 1.2,
          }}
        >
          Cart ({cart.length}) • {currency(orderTotal(cart))}
        </Button>
      </Box>

      <Dialog open={Boolean(dialogItem)} onClose={closeModifierDialog} fullWidth maxWidth="sm">
        <DialogTitle>{dialogItem?.name}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Quantity" type="number" value={dialogQuantity} onChange={(e) => setDialogQuantity(e.target.value)} fullWidth />
            <TextField label="Special instructions" value={dialogNotes} onChange={(e) => setDialogNotes(e.target.value)} multiline minRows={2} fullWidth />
            {dialogItem?.modifierGroups?.map((selection) => {
              const { modifierGroup } = selection;
              return (
              <Paper key={modifierGroup.id} variant="outlined" sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.02)' }}>
                <Typography fontWeight={700} mb={1}>{modifierGroup.name}</Typography>
                {modifierGroup.multiSelect || (modifierGroup.maxSelect ?? 1) > 1 ? (
                  <List dense disablePadding>
                    {modifierGroup.items.map((modifier) => {
                      const selected = modifierDraft[modifierGroup.id] ?? [];
                      const checked = selected.includes(modifier.id);
                      return (
                        <ListItem key={modifier.id} disablePadding>
                          <ListItemButton
                            onClick={() => setModifierDraft((current) => {
                              const next = { ...current };
                              const existing = next[modifierGroup.id] ?? [];
                              if (checked) {
                                next[modifierGroup.id] = existing.filter((id) => id !== modifier.id);
                              } else {
                                if (modifierGroup.maxSelect && existing.length >= modifierGroup.maxSelect) return current;
                                next[modifierGroup.id] = [...existing, modifier.id];
                              }
                              return next;
                            })}
                          >
                            <Checkbox checked={checked} />
                            <ListItemText primary={modifier.name} secondary={modifier.price ? currency(Number(modifier.price)) : undefined} />
                          </ListItemButton>
                        </ListItem>
                      );
                    })}
                  </List>
                ) : (
                  <RadioGroup
                    value={(modifierDraft[modifierGroup.id] ?? [])[0] ?? ''}
                    onChange={(event) => setModifierDraft((current) => ({ ...current, [modifierGroup.id]: [Number(event.target.value)] }))}
                  >
                    {modifierGroup.items.map((modifier) => (
                      <FormControlLabel
                        key={modifier.id}
                        value={modifier.id}
                        control={<Radio />}
                        label={`${modifier.name}${modifier.price ? ` (+${currency(Number(modifier.price))})` : ''}`}
                      />
                    ))}
                  </RadioGroup>
                )}
              </Paper>
              );
            })}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeModifierDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleConfirmItem}>Add to cart</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
