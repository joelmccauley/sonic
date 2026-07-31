import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Chip, Stack, Divider, CircularProgress,
  IconButton, Drawer, List, ListItem, Tabs, Tab, Tooltip, Button,
  FormControl, InputLabel, Select, MenuItem as MuiMenuItem,
} from '@mui/material';
import {
  Close, AccessTime, Person, People, Refresh, AddCircleOutline, PaymentOutlined,
  ZoomIn, ZoomOut, CenterFocusStrong,
} from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { tablesApi } from '@/api/tables.api';
import { settingsApi } from '@/api/settings.api';
import { ordersApi } from '@/api/orders.api';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { useAuthStore } from '@/store/authStore';
import { formatDistanceToNow, differenceInMinutes } from 'date-fns';
import NewOrderDialog from '@/components/pos/NewOrderDialog';
import OrderBuilder from '@/components/pos/OrderBuilder';
import PaymentModal from '@/components/pos/PaymentModal';
import type { Table, TableStatus, Order } from '@/types';

// ── Constants ──────────────────────────────────────────────────────────────

const CANVAS_W = 1800;
const CANVAS_H = 1200;

const STATUS_COLOR: Record<TableStatus, string> = {
  AVAILABLE: '#57a300',
  OCCUPIED:  '#c42b1c',
  RESERVED:  '#c19c00',
  CLEANING:  '#0078d4',
};

const STATUS_LABEL: Record<TableStatus, string> = {
  AVAILABLE: 'Available',
  OCCUPIED:  'Occupied',
  RESERVED:  'Reserved',
  CLEANING:  'Cleaning',
};

const ITEM_STATUS_COLOR: Record<string, string> = {
  PENDING:     '#888888',
  SENT:        '#c19c00',
  IN_PROGRESS: '#0078d4',
  READY:       '#57a300',
  DELIVERED:   '#57a300',
  VOIDED:      '#c42b1c',
};

const STATUS_OWNER_KEY = 'sonicpos:table-status-owners';
const MANUAL_TABLE_STATUSES: TableStatus[] = ['AVAILABLE', 'RESERVED', 'CLEANING'];

interface WallSegment { id: string; x1: number; y1: number; x2: number; y2: number; thickness: number; }
interface ChairEl { id: string; x: number; y: number; }

// ── Live Clock (isolated to avoid SVG re-renders every second) ─────────────
function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <Typography variant="body2" fontFamily="'Segoe UI', monospace" color="text.secondary" sx={{ minWidth: 76, textAlign: 'right' }}>
      {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </Typography>
  );
}

// ── Floor table SVG element ────────────────────────────────────────────────
interface FloorTableProps {
  table: Table;
  selected: boolean;
  onClick: (table: Table) => void;
}

function FloorTable({ table, selected, onClick }: FloorTableProps) {
  const { posX: x, posY: y, width: w, height: h, shape, status, name, capacity } = table;
  const color = STATUS_COLOR[status];
  const cx = x + w / 2;
  const cy = y + h / 2;
  const order = table.orders?.[0];
  const isOccupied = status === 'OCCUPIED';
  const isCircle = shape === 'CIRCLE';
  const elapsed = order?.createdAt ? differenceInMinutes(new Date(), new Date(order.createdAt as string)) : null;
  const labelSize = Math.max(12, Math.min(16, w / 5));
  const subSize   = Math.max(9,  Math.min(11, w / 7));

  return (
    <g cursor="pointer" onClick={() => onClick(table)} style={{ transition: 'opacity 0.2s' }}>
      {/* Animated glow behind occupied tables */}
      {isOccupied && (
        isCircle ? (
          <ellipse className="fv-glow" cx={cx} cy={cy} rx={w / 2 + 14} ry={h / 2 + 14} fill={color} />
        ) : (
          <rect className="fv-glow" x={x - 14} y={y - 14} width={w + 28} height={h + 28} rx={12} fill={color} />
        )
      )}

      {/* Selection ring */}
      {selected && (
        isCircle ? (
          <ellipse cx={cx} cy={cy} rx={w / 2 + 7} ry={h / 2 + 7}
            fill="none" stroke="#ffffff" strokeWidth={2.5} strokeDasharray="7 4" />
        ) : (
          <rect x={x - 7} y={y - 7} width={w + 14} height={h + 14}
            rx={9} fill="none" stroke="#ffffff" strokeWidth={2.5} strokeDasharray="7 4" />
        )
      )}

      {/* Main shape */}
      {isCircle ? (
        <ellipse cx={cx} cy={cy} rx={w / 2} ry={h / 2}
          fill={`${color}22`}
          stroke={color}
          strokeWidth={selected ? 2.5 : 2}
        />
      ) : (
        <rect x={x} y={y} width={w} height={h} rx={6}
          fill={`${color}22`}
          stroke={color}
          strokeWidth={selected ? 2.5 : 2}
        />
      )}

      {/* Table name */}
      <text x={cx} y={order ? cy - 14 : cy - 4}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={labelSize} fontWeight="700" fill="#ffffff"
        style={{ fontFamily: 'Segoe UI, sans-serif', pointerEvents: 'none' }}>
        {name}
      </text>

      {/* Capacity */}
      <text x={cx} y={order ? cy - 2 : cy + 10}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={subSize} fill="rgba(255,255,255,0.5)"
        style={{ fontFamily: 'Segoe UI, sans-serif', pointerEvents: 'none' }}>
        {capacity} seats
      </text>

      {/* Order info */}
      {order && (
        <>
          <text x={cx} y={cy + 12}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={Math.max(8, Math.min(11, w / 8))} fontWeight={700} fill={color}
            style={{ fontFamily: 'Segoe UI, sans-serif', pointerEvents: 'none' }}>
            ${Number(order.total ?? 0).toFixed(0)} · #{order.orderNumber}
          </text>
          {elapsed !== null && (
            <text x={cx} y={cy + 25}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={8} fill="rgba(255,255,255,0.3)"
              style={{ fontFamily: 'Segoe UI, sans-serif', pointerEvents: 'none' }}>
              {elapsed}m ago
            </text>
          )}
        </>
      )}

      {/* Status indicator dot */}
      <circle cx={x + w - 9} cy={y + 9} r={5} fill={color} style={{ pointerEvents: 'none' }} />
    </g>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function FloorViewPage() {
  const queryClient = useQueryClient();
  const { socket, joinRoom } = useWebSocket();
  const { user } = useAuthStore();

  const [viewMode, setViewMode] = useState<'floor' | 'my'>('floor');
  const [section, setSection] = useState('All');
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const [connected, setConnected] = useState(true);
  const [walls, setWalls] = useState<WallSegment[]>([]);
  const [chairs, setChairs] = useState<ChairEl[]>([]);
  const [newOrderTable, setNewOrderTable] = useState<Table | null>(null);
  const [builderOrder, setBuilderOrder]   = useState<Order | null>(null);
  const [builderAutoPayment, setBuilderAutoPayment] = useState(false);
  const [paymentOrder, setPaymentOrder]   = useState<Order | null>(null);
  const [statusOwners, setStatusOwners] = useState<Record<number, number>>({});
  const [statusDraft, setStatusDraft] = useState<TableStatus>('AVAILABLE');
  const [statusSaving, setStatusSaving] = useState(false);

  // ── Pan + Zoom ────────────────────────────────────────────────────────────
  const [zoom, setZoom]   = useState(1);
  const [pan,  setPan]    = useState({ x: 0, y: 0 });
  const panRef = useRef<{ startX: number; startY: number; origX: number; origY: number; captured: boolean; pointerId: number } | null>(null);
  const svgBoxRef = useRef<HTMLDivElement>(null);
  const restoredViewRef = useRef(false);
  const autoFitDoneRef = useRef(false);

  const clampZoom = (z: number) => Math.min(4, Math.max(0.2, z));
  const viewPrefKey = user?.id ? `sonicpos:floorview:${user.id}` : null;

  // Restore per-user view preferences (section + zoom + pan).
  useEffect(() => {
    if (!viewPrefKey) return;
    try {
      const raw = localStorage.getItem(viewPrefKey);
      if (!raw) return;
      const pref = JSON.parse(raw) as {
        viewMode?: 'floor' | 'my';
        section?: string;
        zoom?: number;
        pan?: { x: number; y: number };
      };
      if (pref.viewMode === 'floor' || pref.viewMode === 'my') setViewMode(pref.viewMode);
      if (typeof pref.section === 'string') setSection(pref.section);
      if (typeof pref.zoom === 'number' && Number.isFinite(pref.zoom)) setZoom(clampZoom(pref.zoom));
      if (pref.pan && Number.isFinite(pref.pan.x) && Number.isFinite(pref.pan.y)) setPan({ x: pref.pan.x, y: pref.pan.y });
      restoredViewRef.current = true;
      autoFitDoneRef.current = true;
    } catch {
      // Ignore invalid persisted data.
    }
  }, [viewPrefKey]);

  // Restore shared table status ownership map.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STATUS_OWNER_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, number>;
      const clean: Record<number, number> = {};
      Object.entries(parsed).forEach(([k, v]) => {
        const id = Number(k);
        if (Number.isFinite(id) && Number.isFinite(v)) clean[id] = Number(v);
      });
      setStatusOwners(clean);
    } catch {
      // Ignore malformed persisted owner map.
    }
  }, []);

  // Persist per-user view preferences with a small debounce to avoid excessive writes.
  useEffect(() => {
    if (!viewPrefKey) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(viewPrefKey, JSON.stringify({ viewMode, section, zoom, pan }));
      } catch {
        // Ignore storage write failures.
      }
    }, 120);
    return () => clearTimeout(t);
  }, [viewPrefKey, viewMode, section, zoom, pan]);

  // Attach wheel listener as non-passive so preventDefault() works
  useEffect(() => {
    const el = svgBoxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      setZoom((z) => clampZoom(z * factor));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const handleSvgPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    // Record start position but do NOT capture yet — let table onClick fire on short taps
    panRef.current = { startX: e.clientX, startY: e.clientY, origX: pan.x, origY: pan.y, captured: false, pointerId: e.pointerId };
  }, [pan]);

  const handleSvgPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!panRef.current) return;
    const dx = e.clientX - panRef.current.startX;
    const dy = e.clientY - panRef.current.startY;
    // Only start panning once the pointer has moved past the drag threshold
    if (!panRef.current.captured) {
      if (Math.hypot(dx, dy) < 6) return;
      panRef.current.captured = true;
      (e.currentTarget as HTMLElement).setPointerCapture(panRef.current.pointerId);
    }
    setPan({ x: panRef.current.origX + dx, y: panRef.current.origY + dy });
  }, []);

  const handleSvgPointerUp = useCallback(() => { panRef.current = null; }, []);

  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  // ── Data ─────────────────────────────────────────────────────────────────
  const { data: rawTables = [], isLoading } = useQuery({
    queryKey: ['tables-floorview'],
    queryFn: () => tablesApi.getAll().then((r) => r.data),
    refetchInterval: 15_000,
  });

  const { data: sections = [] } = useQuery({
    queryKey: ['table-sections'],
    queryFn: () => tablesApi.getSections().then((r) => r.data),
  });

  // Load walls + chairs from settings
  useEffect(() => {
    settingsApi.getAll().then((r) => {
      const raw = r.data['floorplan_elements'];
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.walls))  setWalls(parsed.walls);
        if (Array.isArray(parsed.chairs)) setChairs(parsed.chairs);
      } catch { /* ignore */ }
    });
  }, []);

  // Auto-fit + center view to all tables on first load
  useEffect(() => {
    if (autoFitDoneRef.current) return;
    if (!rawTables.length || !svgBoxRef.current) return;
    const containerW = svgBoxRef.current.clientWidth  || window.innerWidth;
    const containerH = svgBoxRef.current.clientHeight || window.innerHeight;
    const padding = 60;
    const minX = Math.min(...rawTables.map((t) => t.posX));
    const minY = Math.min(...rawTables.map((t) => t.posY));
    const maxX = Math.max(...rawTables.map((t) => t.posX + t.width));
    const maxY = Math.max(...rawTables.map((t) => t.posY + t.height));
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    // Scale to fit with padding, never magnify beyond 1
    const z = Math.min(1,
      (containerW - padding * 2) / contentW,
      (containerH - padding * 2) / contentH,
    );
    // Center the content in the container
    const panX = (containerW - contentW * z) / 2 - minX * z;
    const panY = (containerH - contentH * z) / 2 - minY * z;
    setZoom(z);
    setPan({ x: panX, y: panY });
    autoFitDoneRef.current = true;
  }, [rawTables.length]);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['tables-floorview'] });
    const onOrderUpdate = (order: Order) => {
      refresh();
      if (selectedOrder?.id === order.id) setSelectedOrder(order);
    };
    const onConnect    = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on('order:update',  onOrderUpdate);
    socket.on('table:update',  refresh);
    socket.on('connect',       onConnect);
    socket.on('disconnect',    onDisconnect);
    return () => {
      socket.off('order:update',  onOrderUpdate);
      socket.off('table:update',  refresh);
      socket.off('connect',       onConnect);
      socket.off('disconnect',    onDisconnect);
    };
  }, [socket, queryClient, selectedOrder?.id]);

  // Dynamic canvas size based on actual table positions
  const canvasW = rawTables.length
    ? Math.max(CANVAS_W, ...rawTables.map((t) => t.posX + t.width  + 120))
    : CANVAS_W;
  const canvasH = rawTables.length
    ? Math.max(CANVAS_H, ...rawTables.map((t) => t.posY + t.height + 120))
    : CANVAS_H;

  // ── Table click ───────────────────────────────────────────────────────────
  const handleTableClick = useCallback(async (table: Table) => {
    setSelectedTableId(table.id);
    const orderId = table.orders?.[0]?.id;
    if (table.status === 'OCCUPIED' && orderId) {
      setOrderLoading(true);
      try {
        const { data } = await ordersApi.get(orderId as number);
        setSelectedOrder(data);
      } finally {
        setOrderLoading(false);
      }
    } else {
      setSelectedOrder(null);
    }
  }, []);

  const closeDrawer = useCallback(() => {
    setSelectedTableId(null);
    setSelectedOrder(null);
  }, []);

  const persistStatusOwners = useCallback((next: Record<number, number>) => {
    setStatusOwners(next);
    try {
      localStorage.setItem(STATUS_OWNER_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors.
    }
  }, []);

  // Prune stale ownership entries whenever table statuses refresh.
  useEffect(() => {
    if (!rawTables.length) return;
    let changed = false;
    const next = { ...statusOwners };
    for (const t of rawTables) {
      if (t.status === 'AVAILABLE' && next[t.id] !== undefined) {
        delete next[t.id];
        changed = true;
      }
    }
    if (changed) persistStatusOwners(next);
  }, [rawTables, statusOwners, persistStatusOwners]);

  useEffect(() => {
    if (!selectedTableId) return;
    const t = rawTables.find((x) => x.id === selectedTableId);
    if (t) setStatusDraft(t.status);
  }, [selectedTableId, rawTables]);

  const openPaymentForTable = useCallback(async (table: Table) => {
    const orderId = table.orders?.[0]?.id;
    if (!orderId) return;
    setOrderLoading(true);
    try {
      const { data } = await ordersApi.get(orderId as number);
      setPaymentOrder(data);
    } finally {
      setOrderLoading(false);
    }
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────
  const sectionTables = section === 'All'
    ? rawTables
    : rawTables.filter((t) => (t.section ?? 'Main') === section);

  const myTables = rawTables.filter((t) => {
    const order = t.orders?.[0] as Partial<Order> | undefined;
    if (!order || t.status !== 'OCCUPIED') return false;
    if (user?.role === 'OWNER' || user?.role === 'MANAGER') return true;
    const orderServerId = order.serverId ?? order.server?.id;
    return orderServerId === user?.id;
  });

  const myTableIds = new Set(myTables.map((t) => t.id));
  const visibleTables = viewMode === 'my'
    ? sectionTables.filter((t) => myTableIds.has(t.id))
    : sectionTables;

  const selectedTable  = rawTables.find((t) => t.id === selectedTableId) ?? null;
  const selectedStatusOwnerId = selectedTable ? statusOwners[selectedTable.id] : undefined;
  const selectedHasActiveOrder = !!selectedTable?.orders?.[0]?.id;
  const canEditSelectedStatus = !!selectedTable
    && selectedTable.status !== 'OCCUPIED'
    && (
      selectedTable.status === 'AVAILABLE'
      || selectedStatusOwnerId === undefined
      || selectedStatusOwnerId === user?.id
    );
  const occupiedCount  = rawTables.filter((t) => t.status === 'OCCUPIED').length;
  const availableCount = rawTables.filter((t) => t.status === 'AVAILABLE').length;

  const applySelectedTableStatus = useCallback(async () => {
    if (!selectedTable || !user || statusSaving) return;
    if (!canEditSelectedStatus) return;
    if (selectedTable.status === statusDraft) return;

    setStatusSaving(true);
    try {
      await tablesApi.updateStatus(selectedTable.id, statusDraft);

      const next = { ...statusOwners };
      if (statusDraft === 'AVAILABLE') {
        delete next[selectedTable.id];
      } else {
        next[selectedTable.id] = user.id;
      }
      persistStatusOwners(next);

      await queryClient.invalidateQueries({ queryKey: ['tables-floorview'] });
    } finally {
      setStatusSaving(false);
    }
  }, [selectedTable, user, statusSaving, canEditSelectedStatus, statusDraft, statusOwners, persistStatusOwners, queryClient]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', bgcolor: '#0f0f0f', overflow: 'hidden' }}>

      {/* Pulse animation for occupied tables */}
      <style>{`
        @keyframes fv-pulse { 0%, 100% { opacity: 0.12; } 50% { opacity: 0.35; } }
        .fv-glow { animation: fv-pulse 2.8s ease-in-out infinite; }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <Box sx={{
        px: 3, py: 1.5, flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 2,
        bgcolor: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <Typography variant="h6" fontWeight={800} sx={{ fontSize: '0.95rem', letterSpacing: 0.5 }}>
          Floor View
        </Typography>

        <Stack direction="row" spacing={0.5} sx={{ ml: 0.5 }}>
          <Button
            size="small"
            variant={viewMode === 'floor' ? 'contained' : 'outlined'}
            onClick={() => setViewMode('floor')}
            sx={{ minWidth: 94, fontSize: '0.7rem', py: 0.25 }}
          >
            Floor Map
          </Button>
          <Button
            size="small"
            variant={viewMode === 'my' ? 'contained' : 'outlined'}
            onClick={() => setViewMode('my')}
            sx={{ minWidth: 94, fontSize: '0.7rem', py: 0.25 }}
          >
            My Tables
          </Button>
        </Stack>

        <Chip
          label={`${occupiedCount} occupied`}
          size="small"
          sx={{ bgcolor: 'rgba(196,43,28,0.15)', color: '#ff7b6b', border: '1px solid rgba(196,43,28,0.3)', fontWeight: 700 }}
        />
        <Chip
          label={`${availableCount} available`}
          size="small"
          sx={{ bgcolor: 'rgba(87,163,0,0.15)', color: '#a3e05b', border: '1px solid rgba(87,163,0,0.3)', fontWeight: 700 }}
        />

        {(Object.entries(STATUS_COLOR) as [TableStatus, string][]).map(([status, color]) => (
          <Stack key={status} direction="row" alignItems="center" spacing={0.6}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, boxShadow: `0 0 4px ${color}88` }} />
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
              {STATUS_LABEL[status]}
            </Typography>
          </Stack>
        ))}

        <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem' }}>
          Click any table for details
        </Typography>

        <Box sx={{ flex: 1 }} />

        {/* Zoom controls */}
        {viewMode === 'floor' && (
          <Stack direction="row" alignItems="center" spacing={0.25}>
            <Tooltip title="Zoom out">
              <IconButton size="small" onClick={() => setZoom((z) => clampZoom(z / 1.25))}>
                <ZoomOut fontSize="small" />
              </IconButton>
            </Tooltip>
            <Typography
              variant="caption"
              sx={{ minWidth: 38, textAlign: 'center', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', userSelect: 'none' }}
              onClick={resetView}
            >
              {Math.round(zoom * 100)}%
            </Typography>
            <Tooltip title="Zoom in">
              <IconButton size="small" onClick={() => setZoom((z) => clampZoom(z * 1.25))}>
                <ZoomIn fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Reset view">
              <IconButton size="small" onClick={resetView}>
                <CenterFocusStrong fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        )}

        <Tooltip title="Refresh tables">
          <IconButton size="small" onClick={() => queryClient.invalidateQueries({ queryKey: ['tables-floorview'] })}>
            <Refresh fontSize="small" />
          </IconButton>
        </Tooltip>

        <LiveClock />

        <Tooltip title={connected ? 'Live — connected' : 'Reconnecting…'}>
          <Box sx={{
            width: 9, height: 9, borderRadius: '50%',
            bgcolor: connected ? '#57a300' : '#c42b1c',
            boxShadow: connected ? '0 0 8px #57a300aa' : 'none',
            flexShrink: 0,
          }} />
        </Tooltip>
      </Box>

      {/* ── Section tabs ───────────────────────────────────────────────────── */}
      {sections.length > 0 && (
        <Box sx={{
          flexShrink: 0, px: 1.5,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          bgcolor: 'rgba(255,255,255,0.015)',
        }}>
          <Tabs
            value={section}
            onChange={(_, v) => setSection(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0, fontSize: '0.75rem', textTransform: 'none' } }}
          >
            <Tab label="All" value="All" />
            {(sections as string[]).map((s) => <Tab key={s} label={s} value={s} />)}
          </Tabs>
        </Box>
      )}

      {viewMode === 'floor' ? (
      <>
      {/* ── SVG canvas ─────────────────────────────────────────────────────── */}
      <Box
        ref={svgBoxRef}
        sx={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative', cursor: panRef.current ? 'grabbing' : 'grab' }}
        onPointerDown={handleSvgPointerDown}
        onPointerMove={handleSvgPointerMove}
        onPointerUp={handleSvgPointerUp}
      >
        {isLoading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        ) : (
          <svg
            width={canvasW}
            height={canvasH}
            style={{
              display: 'block',
              transformOrigin: '0 0',
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              userSelect: 'none',
            }}
          >
            {/* Grid */}
            <defs>
              <pattern id="fv-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.025)" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width={canvasW} height={canvasH} fill="url(#fv-grid)" />

            {/* Walls */}
            {walls.map((wall) => (
              <line
                key={wall.id}
                x1={wall.x1} y1={wall.y1} x2={wall.x2} y2={wall.y2}
                stroke="rgba(200,200,200,0.35)"
                strokeWidth={wall.thickness}
                strokeLinecap="round"
                style={{ pointerEvents: 'none' }}
              />
            ))}

            {/* Chairs */}
            {chairs.map((chair) => (
              <g key={chair.id} style={{ pointerEvents: 'none' }}>
                <ellipse cx={chair.x} cy={chair.y + 3} rx={13} ry={11}
                  fill="rgba(120,80,40,0.18)" stroke="rgba(160,120,70,0.35)" strokeWidth={1.5} />
                <path
                  d={`M ${chair.x - 11},${chair.y - 3} A 11,9 0 0,1 ${chair.x + 11},${chair.y - 3}`}
                  fill="none" stroke="rgba(160,120,70,0.35)" strokeWidth={2.5} strokeLinecap="round"
                />
              </g>
            ))}

            {/* Section labels */}
            {(sections as string[]).filter((s) => s !== 'All').map((sec) => {
              const secTables = visibleTables.filter((t) => (t.section ?? 'Main') === sec);
              if (secTables.length === 0) return null;
              const minX = Math.min(...secTables.map((t) => t.posX));
              const minY = Math.min(...secTables.map((t) => t.posY));
              return (
                <text key={sec} x={minX} y={Math.max(16, minY - 14)}
                  fontSize={11} fill="rgba(255,255,255,0.18)" fontWeight={600}
                  style={{ fontFamily: 'Segoe UI, sans-serif', textTransform: 'uppercase', letterSpacing: 2, pointerEvents: 'none' }}>
                  {sec}
                </text>
              );
            })}

            {/* Tables */}
            {visibleTables.map((t) => (
              <FloorTable
                key={t.id}
                table={t}
                selected={selectedTableId === t.id}
                onClick={handleTableClick}
              />
            ))}
          </svg>
        )}
      </Box>

      </>
      ) : (
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 2.5 }}>
        <Stack direction="row" spacing={1} alignItems="center" mb={2}>
          <Chip
            size="small"
            label={`${myTables.length} active ${myTables.length === 1 ? 'table' : 'tables'}`}
            sx={{ bgcolor: 'rgba(0,120,212,0.16)', color: '#8ecbff', border: '1px solid rgba(0,120,212,0.35)' }}
          />
          <Typography variant="caption" color="text.secondary">
            Focused service view for your section
          </Typography>
        </Stack>

        {myTables.length === 0 ? (
          <Box sx={{
            border: '1px solid rgba(255,255,255,0.08)',
            bgcolor: 'rgba(255,255,255,0.02)',
            borderRadius: 2,
            p: 3,
            textAlign: 'center',
          }}>
            <Typography variant="subtitle1" fontWeight={700}>No active tables</Typography>
            <Typography variant="body2" color="text.secondary" mt={0.75}>
              Your assigned occupied tables will appear here.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 1.25 }}>
            {myTables.map((table) => {
              const order = table.orders?.[0] as Partial<Order> | undefined;
              return (
                <Box key={table.id} sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: 'rgba(196,43,28,0.08)',
                  border: '1px solid rgba(196,43,28,0.35)',
                }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="subtitle1" fontWeight={800}>{table.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {table.section ?? 'Main'} • {table.capacity} seats
                      </Typography>
                    </Box>
                    <Chip size="small" label="Occupied" sx={{ fontSize: '0.65rem' }} />
                  </Stack>

                  <Typography variant="body2" sx={{ mt: 1, fontWeight: 700 }}>
                    {order?.orderNumber ? `#${order.orderNumber}` : 'Open order'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    ${Number(order?.total ?? 0).toFixed(2)}
                  </Typography>

                  <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                    <Button size="small" variant="outlined" fullWidth onClick={() => handleTableClick(table)}>
                      Open
                    </Button>
                    <Button size="small" variant="contained" color="success" fullWidth onClick={() => openPaymentForTable(table)}>
                      Pay
                    </Button>
                  </Stack>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
      )}

      {/* ── Order detail drawer ────────────────────────────────────────────── */}
      <Drawer
        anchor="right"
        open={!!selectedTableId}
        onClose={closeDrawer}
        PaperProps={{
          sx: {
            width: 390,
            bgcolor: '#1a1a1a',
            borderLeft: '1px solid rgba(255,255,255,0.08)',
          },
        }}
      >
        {selectedTable && (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

            {/* Drawer header */}
            <Box sx={{
              px: 2.5, py: 2,
              bgcolor: `${STATUS_COLOR[selectedTable.status]}12`,
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            }}>
              <Box>
                <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: 0.5 }}>
                  {selectedTable.name}
                </Typography>
                <Stack direction="row" spacing={0.75} mt={0.75} flexWrap="wrap" gap={0.5}>
                  <Chip
                    label={STATUS_LABEL[selectedTable.status]}
                    size="small"
                    sx={{
                      bgcolor: `${STATUS_COLOR[selectedTable.status]}25`,
                      color: STATUS_COLOR[selectedTable.status],
                      border: `1px solid ${STATUS_COLOR[selectedTable.status]}55`,
                      fontWeight: 700, fontSize: '0.65rem',
                    }}
                  />
                  <Chip label={`${selectedTable.capacity} seats`} size="small" sx={{ fontSize: '0.65rem' }} />
                  {selectedTable.section && (
                    <Chip label={selectedTable.section} size="small" sx={{ fontSize: '0.65rem' }} />
                  )}
                </Stack>
              </Box>
              <IconButton onClick={closeDrawer} size="small" sx={{ mt: -0.5 }}>
                <Close fontSize="small" />
              </IconButton>
            </Box>

            {/* Table status controls */}
            <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <FormControl size="small" fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    label="Status"
                    value={statusDraft}
                    onChange={(e) => setStatusDraft(e.target.value as TableStatus)}
                    disabled={!canEditSelectedStatus || statusSaving || selectedHasActiveOrder}
                  >
                    {MANUAL_TABLE_STATUSES.map((s) => (
                      <MuiMenuItem key={s} value={s}>{STATUS_LABEL[s]}</MuiMenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button
                  variant="contained"
                  size="small"
                  onClick={applySelectedTableStatus}
                  disabled={!canEditSelectedStatus || statusSaving || selectedHasActiveOrder || statusDraft === selectedTable.status}
                >
                  {statusSaving ? 'Saving...' : 'Apply'}
                </Button>
              </Stack>

              {selectedHasActiveOrder && (
                <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.75 }}>
                  Status is controlled by the active order while this table is occupied.
                </Typography>
              )}
              {!selectedHasActiveOrder && !canEditSelectedStatus && selectedTable.status !== 'AVAILABLE' && (
                <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.75 }}>
                  This status was set by another user. Only that user can change it until it returns to Available.
                </Typography>
              )}
              {!selectedHasActiveOrder && selectedTable.status !== 'AVAILABLE' && selectedStatusOwnerId === undefined && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                  No owner is recorded for this status, so it can be updated.
                </Typography>
              )}
            </Box>

            {/* Body */}
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              {orderLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
                  <CircularProgress size={32} />
                </Box>
              ) : selectedOrder ? (
                <>
                  {/* Order summary */}
                  <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: 1 }}>
                          Order
                        </Typography>
                        <Typography variant="h5" fontWeight={800} color="primary.main">
                          #{selectedOrder.orderNumber}
                        </Typography>
                      </Box>
                      <Chip
                        label={selectedOrder.status.replace(/_/g, ' ')}
                        size="small"
                        sx={{
                          bgcolor: 'rgba(0,120,212,0.15)', color: '#60cdff',
                          border: '1px solid rgba(0,120,212,0.3)',
                          fontWeight: 700, fontSize: '0.65rem',
                        }}
                      />
                    </Stack>

                    <Stack spacing={0.75} mt={1.5}>
                      {selectedOrder.server && (
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Person sx={{ fontSize: 14, color: 'text.disabled' }} />
                          <Typography variant="caption" color="text.secondary">
                            {selectedOrder.server.firstName} {selectedOrder.server.lastName}
                          </Typography>
                        </Stack>
                      )}
                      {(selectedOrder.guestCount ?? 0) > 0 && (
                        <Stack direction="row" spacing={1} alignItems="center">
                          <People sx={{ fontSize: 14, color: 'text.disabled' }} />
                          <Typography variant="caption" color="text.secondary">
                            {selectedOrder.guestCount} {selectedOrder.guestCount === 1 ? 'guest' : 'guests'}
                          </Typography>
                        </Stack>
                      )}
                      <Stack direction="row" spacing={1} alignItems="center">
                        <AccessTime sx={{ fontSize: 14, color: 'text.disabled' }} />
                        <Typography variant="caption" color="text.secondary">
                          Opened {formatDistanceToNow(new Date(selectedOrder.createdAt), { addSuffix: true })}
                        </Typography>
                      </Stack>
                      {selectedOrder.notes && (
                        <Typography variant="caption" color="warning.main" sx={{ fontStyle: 'italic' }}>
                          📝 {selectedOrder.notes}
                        </Typography>
                      )}
                    </Stack>
                  </Box>

                  {/* Items */}
                  <Box sx={{ px: 2.5, pt: 2, pb: 1 }}>
                    <Typography variant="caption" color="text.disabled" sx={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.65rem' }}>
                      Items ({selectedOrder.items.filter((i) => i.status !== 'VOIDED').length})
                    </Typography>
                    <List disablePadding sx={{ mt: 1 }}>
                      {selectedOrder.items
                        .filter((item) => item.status !== 'VOIDED')
                        .map((item) => {
                          const lineTotal = (
                            Number(item.unitPrice) * item.quantity +
                            item.modifiers.reduce((s, m) => s + Number(m.price), 0) * item.quantity
                          ).toFixed(2);
                          const kitchenColor = ITEM_STATUS_COLOR[item.status] ?? '#888';

                          return (
                            <ListItem key={item.id} disablePadding sx={{ mb: 0.75 }}>
                              <Box sx={{
                                width: '100%', px: 1.5, py: 1,
                                bgcolor: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.06)',
                                borderLeft: `3px solid ${kitchenColor}`,
                                borderRadius: 1,
                              }}>
                                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                  <Box flex={1} minWidth={0}>
                                    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                                      <Typography variant="body2" fontWeight={600} noWrap>
                                        {item.quantity}× {item.menuItem.name}
                                      </Typography>
                                      {item.course > 1 && (
                                        <Chip label={`Course ${item.course}`} size="small" sx={{ fontSize: '0.55rem', height: 16 }} />
                                      )}
                                    </Stack>
                                    {item.modifiers.length > 0 && (
                                      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.25 }}>
                                        + {item.modifiers.map((m) => m.modifier.name).join(', ')}
                                      </Typography>
                                    )}
                                    {item.notes && (
                                      <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.25 }}>
                                        📝 {item.notes}
                                      </Typography>
                                    )}
                                    <Chip
                                      label={item.status.replace(/_/g, ' ')}
                                      size="small"
                                      sx={{
                                        mt: 0.5,
                                        fontSize: '0.55rem', height: 16, fontWeight: 700,
                                        bgcolor: `${kitchenColor}18`,
                                        color: kitchenColor,
                                        border: `1px solid ${kitchenColor}40`,
                                      }}
                                    />
                                  </Box>
                                  <Typography variant="body2" fontWeight={700} sx={{ ml: 1.5, flexShrink: 0 }}>
                                    ${lineTotal}
                                  </Typography>
                                </Stack>
                              </Box>
                            </ListItem>
                          );
                        })}
                    </List>
                  </Box>
                </>
              ) : (
                /* No order / non-occupied table */
                <Box sx={{ px: 2.5, py: 4, textAlign: 'center' }}>
                  <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: `${STATUS_COLOR[selectedTable.status]}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 1.5 }}>
                    <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: STATUS_COLOR[selectedTable.status] }} />
                  </Box>
                  <Typography variant="body1" fontWeight={600}>
                    {STATUS_LABEL[selectedTable.status]}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mt={0.5}>
                    {selectedTable.status === 'AVAILABLE' && 'This table is ready for guests.'}
                    {selectedTable.status === 'RESERVED' && 'This table is reserved.'}
                    {selectedTable.status === 'CLEANING' && 'This table is being cleaned.'}
                  </Typography>
                  {selectedTable.status === 'AVAILABLE' && (
                    <Button
                      variant="contained"
                      size="large"
                      startIcon={<AddCircleOutline />}
                      sx={{ mt: 3, px: 4, fontWeight: 700 }}
                      onClick={() => setNewOrderTable(selectedTable)}
                    >
                      Start Order
                    </Button>
                  )}
                </Box>
              )}
            </Box>

            {/* Totals footer */}
            {selectedOrder && (
              <Box sx={{
                px: 2.5, py: 2,
                borderTop: '1px solid rgba(255,255,255,0.08)',
                bgcolor: 'rgba(255,255,255,0.02)',
                flexShrink: 0,
              }}>
                <Stack spacing={0.5}>
                  {Number(selectedOrder.discountAmount) > 0 && (
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Discount</Typography>
                      <Typography variant="body2" color="warning.main">
                        −${Number(selectedOrder.discountAmount).toFixed(2)}
                      </Typography>
                    </Stack>
                  )}
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Subtotal</Typography>
                    <Typography variant="body2">${Number(selectedOrder.subtotal).toFixed(2)}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Tax</Typography>
                    <Typography variant="body2">${Number(selectedOrder.taxAmount).toFixed(2)}</Typography>
                  </Stack>
                  {Number(selectedOrder.tipAmount) > 0 && (
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Tip</Typography>
                      <Typography variant="body2">${Number(selectedOrder.tipAmount).toFixed(2)}</Typography>
                    </Stack>
                  )}
                  <Divider sx={{ my: 0.5 }} />
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle1" fontWeight={800}>Total</Typography>
                    <Typography variant="subtitle1" fontWeight={800} color="primary.main" sx={{ fontSize: '1.1rem' }}>
                      ${Number(selectedOrder.total).toFixed(2)}
                    </Typography>
                  </Stack>
                </Stack>

                {selectedOrder.status === 'READY' && (
                  <Button
                    variant="contained"
                    color="success"
                    fullWidth
                    size="large"
                    startIcon={<PaymentOutlined />}
                    sx={{ mt: 2, fontWeight: 800, fontSize: '1rem', py: 1.25 }}
                    onClick={() => setPaymentOrder(selectedOrder)}
                  >
                    Collect Payment · ${Number(selectedOrder.total).toFixed(2)}
                  </Button>
                )}
                {(selectedOrder.status === 'OPEN' || selectedOrder.status === 'SENT_TO_KITCHEN' || selectedOrder.status === 'IN_PROGRESS') && (
                  <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                    <Button
                      variant="outlined"
                      fullWidth
                      startIcon={<AddCircleOutline />}
                      onClick={() => { setBuilderOrder(selectedOrder); setBuilderAutoPayment(false); }}
                    >
                      Add Items
                    </Button>
                    <Button
                      variant="contained"
                      color="success"
                      fullWidth
                      startIcon={<PaymentOutlined />}
                      onClick={() => setPaymentOrder(selectedOrder)}
                    >
                      Pay · ${Number(selectedOrder.total).toFixed(2)}
                    </Button>
                  </Stack>
                )}
              </Box>
            )}
          </Box>
        )}
      </Drawer>

      {/* New Order dialog — opened inline from floor view */}
      <NewOrderDialog
        open={!!newOrderTable}
        table={newOrderTable}
        onClose={() => setNewOrderTable(null)}
        onSuccess={(order) => {
          setNewOrderTable(null);
          setSelectedTableId(null);
          setBuilderOrder(order);
          setBuilderAutoPayment(false);
        }}
      />

      {/* Full-screen order builder — for adding items */}
      <OrderBuilder
        open={!!builderOrder}
        order={builderOrder}
        autoOpenPayment={builderAutoPayment}
        onClose={() => { setBuilderOrder(null); setBuilderAutoPayment(false); }}
        onPaymentSuccess={() => {
          setBuilderOrder(null);
          setSelectedTableId(null);
          setSelectedOrder(null);
        }}
      />

      {/* Payment modal — opens directly on top of floor view */}
      <PaymentModal
        open={!!paymentOrder}
        order={paymentOrder}
        onClose={() => setPaymentOrder(null)}
        onSuccess={() => {
          setPaymentOrder(null);
          setSelectedTableId(null);
          setSelectedOrder(null);
          queryClient.invalidateQueries({ queryKey: ['tables-floorview'] });
        }}
      />
    </Box>
  );
}
