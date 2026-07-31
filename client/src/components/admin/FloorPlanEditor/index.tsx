import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, IconButton, Stack, TextField, ToggleButton,
  ToggleButtonGroup, Tooltip, Typography, Select, MenuItem as MuiMenuItem,
  FormControl, InputLabel,
} from '@mui/material';
import {
  Delete, Edit, Save, GridOn, GridOff, ZoomIn, ZoomOut,
  RadioButtonUnchecked, CropSquare, TableRestaurant, Refresh,
  DragIndicator, Visibility, ContentCopy, HorizontalRule, EventSeat,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { tablesApi } from '@/api/tables.api';
import { settingsApi } from '@/api/settings.api';
import type { Table, TableShape, TableStatus } from '@/types';

// ── Constants ──────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<TableStatus, string> = {
  AVAILABLE: '#57a300',
  OCCUPIED:  '#c42b1c',
  RESERVED:  '#c19c00',
  CLEANING:  '#0078d4',
};

const GRID_SIZE = 20;
const MIN_SIZE  = 40;

type Mode = 'select' | 'add-square' | 'add-circle' | 'add-wall' | 'add-chair' | 'view';

interface ResizeHandle { dir: string; cx: number; cy: number }
interface WallSegment { id: string; x1: number; y1: number; x2: number; y2: number; thickness: number; }
interface ChairEl { id: string; x: number; y: number; }

// ── Snap to grid ──────────────────────────────────────────────────────────
function snap(v: number) {
  return Math.round(v / GRID_SIZE) * GRID_SIZE;
}

// ── Table shape renderer (SVG) ──────────────────────────────────────────
interface TableShapeProps {
  table: Table;
  selected: boolean;
  multiSelected: boolean;
  mode: Mode;
  zoom: number;
  onPointerDown: (e: React.PointerEvent, id: number) => void;
  onResizeHandleDown: (e: React.PointerEvent, id: number, dir: string) => void;
  onDoubleClick: (id: number) => void;
}

function TableShapeEl({ table, selected, multiSelected, mode, onPointerDown, onResizeHandleDown, onDoubleClick }: TableShapeProps) {
  const { posX: x, posY: y, width: w, height: h, shape, status, name, capacity } = table;
  const fillColor = STATUS_COLOR[status];
  const order = table.orders?.[0];
  const cx = x + w / 2;
  const cy = y + h / 2;
  const interactive = mode === 'select';
  const isHighlighted = selected || multiSelected;

  const handles: ResizeHandle[] = [
    { dir: 'nw', cx: x,         cy: y },
    { dir: 'ne', cx: x + w,     cy: y },
    { dir: 'sw', cx: x,         cy: y + h },
    { dir: 'se', cx: x + w,     cy: y + h },
    { dir: 'n',  cx: cx,        cy: y },
    { dir: 's',  cx: cx,        cy: y + h },
    { dir: 'w',  cx: x,         cy: cy },
    { dir: 'e',  cx: x + w,     cy: cy },
  ];

  const cursorForMode = mode === 'select' ? 'grab' : mode === 'view' ? 'default' : 'crosshair';

  return (
    <g data-fp="table" onPointerDown={(e) => interactive && onPointerDown(e, table.id)} onDoubleClick={() => interactive && onDoubleClick(table.id)}>
      {/* Main shape */}
      {shape === 'CIRCLE' ? (
        <ellipse
          cx={cx} cy={cy} rx={w / 2} ry={h / 2}
          fill={`${fillColor}22`}
          stroke={isHighlighted ? (multiSelected && !selected ? '#7ec8e3' : '#0078d4') : fillColor}
          strokeWidth={isHighlighted ? 2.5 : 1.5}
          cursor={cursorForMode}
        />
      ) : (
        <rect
          x={x} y={y} width={w} height={h}
          rx={shape === 'SQUARE' ? 6 : 4}
          fill={`${fillColor}22`}
          stroke={isHighlighted ? (multiSelected && !selected ? '#7ec8e3' : '#0078d4') : fillColor}
          strokeWidth={isHighlighted ? 2.5 : 1.5}
          cursor={cursorForMode}
        />
      )}

      {/* Table name */}
      <text
        x={cx} y={cy - (order ? 8 : 4)}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={Math.max(11, Math.min(14, w / 5))}
        fontWeight="700"
        fill="#ffffff"
        pointerEvents="none"
        style={{ fontFamily: 'Segoe UI, sans-serif' }}
      >
        {name}
      </text>

      {/* Capacity */}
      <text
        x={cx} y={cy + (order ? 4 : 10)}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={Math.max(9, Math.min(11, w / 7))}
        fill="rgba(255,255,255,0.55)"
        pointerEvents="none"
        style={{ fontFamily: 'Segoe UI, sans-serif' }}
      >
        {capacity} seats
      </text>

      {/* Order info if occupied */}
      {order && (
        <text
          x={cx} y={cy + 17}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={Math.max(8, Math.min(10, w / 8))}
          fill="#0078d4"
          pointerEvents="none"
          style={{ fontFamily: 'Segoe UI, sans-serif', fontWeight: 700 }}
        >
          ${Number(order.total ?? 0).toFixed(0)} • #{order.orderNumber}
        </text>
      )}

      {/* Status indicator dot */}
      <circle cx={x + w - 7} cy={y + 7} r={4} fill={fillColor} pointerEvents="none" />

      {/* Resize handles (only in select mode when individually selected) */}
      {selected && mode === 'select' && handles.map((h) => (
        <rect
          key={h.dir}
          x={h.cx - 5} y={h.cy - 5} width={10} height={10}
          rx={2}
          fill="#0078d4"
          stroke="#fff"
          strokeWidth={1.5}
          cursor={`${h.dir}-resize`}
          onPointerDown={(e) => { e.stopPropagation(); onResizeHandleDown(e, table.id, h.dir); }}
        />
      ))}
    </g>
  );
}

// ── Edit Table Dialog ──────────────────────────────────────────────────────
interface EditDialogProps {
  table: Table | null;
  onClose: () => void;
  onSave: (updates: Partial<Table>) => void;
}

function EditTableDialog({ table, onClose, onSave }: EditDialogProps) {
  const [name, setName]         = useState(table?.name ?? '');
  const [capacity, setCapacity] = useState(String(table?.capacity ?? 4));
  const [section, setSection]   = useState(table?.section ?? '');
  const [status, setStatus]     = useState<TableStatus>(table?.status ?? 'AVAILABLE');
  const [shape, setShape]       = useState<TableShape>(table?.shape ?? 'SQUARE');

  if (!table) return null;
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { bgcolor: '#242424' } }}>
      <DialogTitle>Edit Table</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <TextField label="Table Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth size="small" />
          <TextField label="Capacity" type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} fullWidth size="small" inputProps={{ min: 1, max: 50 }} />
          <TextField label="Section" value={section} onChange={(e) => setSection(e.target.value)} fullWidth size="small" placeholder="Main, Bar, Patio…" />
          <FormControl size="small" fullWidth>
            <InputLabel>Shape</InputLabel>
            <Select value={shape} label="Shape" onChange={(e) => setShape(e.target.value as TableShape)}>
              <MuiMenuItem value="SQUARE">Square</MuiMenuItem>
              <MuiMenuItem value="CIRCLE">Round</MuiMenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>Status</InputLabel>
            <Select value={status} label="Status" onChange={(e) => setStatus(e.target.value as TableStatus)}>
              <MuiMenuItem value="AVAILABLE">Available</MuiMenuItem>
              <MuiMenuItem value="OCCUPIED">Occupied</MuiMenuItem>
              <MuiMenuItem value="RESERVED">Reserved</MuiMenuItem>
              <MuiMenuItem value="CLEANING">Cleaning</MuiMenuItem>
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => { onSave({ name, capacity: parseInt(capacity) || 4, section, status, shape }); onClose(); }}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main FloorPlanEditor ───────────────────────────────────────────────────
export default function FloorPlanEditor() {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const [mode, setMode]               = useState<Mode>('select');
  const [wallThickness, setWallThickness] = useState(6);
  const [selectedId, setSelectedId]             = useState<number | null>(null);
  const [selectedIds, setSelectedIds]           = useState<Set<number>>(new Set());
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [showGrid, setShowGrid]       = useState(true);
  const [zoom, setZoom]               = useState(1);
  const [activeSection, setActiveSection] = useState<string>('All');
  const [editingTable, setEditingTable]   = useState<Table | null>(null);
  const [walls, setWalls]           = useState<WallSegment[]>([]);
  const [chairs, setChairs]         = useState<ChairEl[]>([]);
  const [pendingWall, setPendingWall] = useState<{ x: number; y: number } | null>(null);
  const [floorplanDirty, setFloorplanDirty] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState<Record<number, Partial<Table>>>({});

  const svgRef         = useRef<SVGSVGElement>(null);
  const dragRef        = useRef<{ ids: number[]; startX: number; startY: number; origPositions: Record<number, {x: number; y: number}> } | null>(null);
  const resizeRef      = useRef<{ id: number; dir: string; startX: number; startY: number; orig: Pick<Table,'posX','posY','width','height'> } | null>(null);
  const multiResizeRef = useRef<{ dir: string; startX: number; startY: number; origBbox: { x: number; y: number; w: number; h: number }; origTables: Record<number, { posX: number; posY: number; width: number; height: number }> } | null>(null);
  const chairDragRef   = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const marqueeRef     = useRef<{ startX: number; startY: number } | null>(null);
  const marqueeElRef   = useRef<SVGRectElement>(null);
  const previewLineRef = useRef<SVGLineElement>(null);
  const modeRef        = useRef<Mode>(mode);
  const pendingWallRef = useRef(pendingWall);
  // Keep refs current on every render for use in non-reactive callbacks
  modeRef.current      = mode;
  pendingWallRef.current = pendingWall;

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: rawTables = [], refetch } = useQuery({
    queryKey: ['tables-floorplan'],
    queryFn: () => tablesApi.getAll().then((r) => r.data),
    refetchInterval: 20_000,
  });

  // ── Load walls + chairs from settings ────────────────────────────────────
  useEffect(() => {
    settingsApi.getAll().then((r) => {
      const raw = r.data['floorplan_elements'];
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed.walls))  setWalls(parsed.walls);
          if (Array.isArray(parsed.chairs)) setChairs(parsed.chairs);
        } catch { /* ignore corrupt data */ }
      }
    });
  }, []);

  // Merge unsaved changes into display data
  const tables: Table[] = rawTables.map((t) =>
    unsavedChanges[t.id] ? { ...t, ...unsavedChanges[t.id] } : t
  );

  const sections = ['All', ...Array.from(new Set(rawTables.map((t) => t.section ?? 'Main'))).sort()];
  const visibleTables = activeSection === 'All' ? tables : tables.filter((t) => (t.section ?? 'Main') === activeSection);

  // Derived selection lists (must be before any useCallback that references them)
  const selectedTablesList = tables.filter((t) => selectedIds.has(t.id));
  const selectionBbox = selectedTablesList.length > 1 ? (() => {
    const bx  = Math.min(...selectedTablesList.map((t) => t.posX));
    const by  = Math.min(...selectedTablesList.map((t) => t.posY));
    const bx2 = Math.max(...selectedTablesList.map((t) => t.posX + t.width));
    const by2 = Math.max(...selectedTablesList.map((t) => t.posY + t.height));
    return { x: bx, y: by, w: bx2 - bx, h: by2 - by };
  })() : null;

  // ── Mutations ────────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Table> }) => tablesApi.update(id, data),
  });
  const createMutation = useMutation({
    mutationFn: (data: Partial<Table>) => tablesApi.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tables-floorplan'] }); queryClient.invalidateQueries({ queryKey: ['tables'] }); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => tablesApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tables-floorplan'] }); queryClient.invalidateQueries({ queryKey: ['tables'] }); },
  });

  // ── Local geometry update (unsaved) ──────────────────────────────────────
  const applyLocal = useCallback((id: number, patch: Partial<Table>) => {
    setUnsavedChanges((prev) => ({ ...prev, [id]: { ...(prev[id] ?? {}), ...patch } }));
  }, []);

  // ── Save all pending changes ──────────────────────────────────────────────
  const saveAll = async () => {
    const entries = Object.entries(unsavedChanges);
    if (entries.length === 0 && !floorplanDirty) { enqueueSnackbar('No changes to save', { variant: 'info' }); return; }
    try {
      const promises: Promise<any>[] = entries.map(([id, data]) => updateMutation.mutateAsync({ id: Number(id), data }));
      if (floorplanDirty) {
        promises.push(settingsApi.update({ floorplan_elements: JSON.stringify({ walls, chairs }) }));
      }
      await Promise.all(promises);
      setUnsavedChanges({});
      setFloorplanDirty(false);
      queryClient.invalidateQueries({ queryKey: ['tables-floorplan'] });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      enqueueSnackbar('Floor plan saved', { variant: 'success' });
    } catch {
      enqueueSnackbar('Failed to save some changes', { variant: 'error' });
    }
  };

  // ── SVG coordinate helpers ────────────────────────────────────────────────
  const svgPoint = useCallback((e: PointerEvent | React.PointerEvent): { x: number; y: number } => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom,
    };
  }, [zoom]);

  // ── Pointer: canvas interactions ──────────────────────────────────────────
  const handleCanvasPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const target = e.target as Element;

    if (mode === 'select') {
      if (target.closest('[data-fp]')) return;
      // Clear selection and start marquee on bare canvas
      if (!e.shiftKey) {
        setSelectedId(null);
        setSelectedIds(new Set());
        setSelectedElementId(null);
      }
      const { x, y } = svgPoint(e);
      marqueeRef.current = { startX: x, startY: y };
      if (marqueeElRef.current) {
        marqueeElRef.current.setAttribute('x', String(x));
        marqueeElRef.current.setAttribute('y', String(y));
        marqueeElRef.current.setAttribute('width', '0');
        marqueeElRef.current.setAttribute('height', '0');
        marqueeElRef.current.style.display = '';
      }
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      return;
    }

    // In add-* modes: block only if clicking a table
    if (target.closest('[data-fp="table"]')) return;

    const { x, y } = svgPoint(e);
    const sx = snap(x);
    const sy = snap(y);

    if (mode === 'add-wall') {
      const pw = pendingWallRef.current;
      if (!pw) {
        setPendingWall({ x: sx, y: sy });
      } else {
        if (Math.hypot(sx - pw.x, sy - pw.y) > 5) {
          setWalls((prev) => [...prev, { id: `w${Date.now()}`, x1: pw.x, y1: pw.y, x2: sx, y2: sy, thickness: wallThickness }]);
          setFloorplanDirty(true);
        }
        setPendingWall({ x: sx, y: sy }); // chain: next wall starts here
      }
      return;
    }

    if (mode === 'add-chair') {
      setChairs((prev) => [...prev, { id: `c${Date.now()}`, x: sx, y: sy }]);
      setFloorplanDirty(true);
      return;
    }

    if (mode === 'add-square' || mode === 'add-circle') {
      const shape: TableShape = mode === 'add-circle' ? 'CIRCLE' : 'SQUARE';
      const tableNum = rawTables.length + 1;
      createMutation.mutate({
        name: `T${tableNum}`, capacity: 4,
        section: activeSection === 'All' ? 'Main' : activeSection,
        posX: snap(x - 60), posY: snap(y - 40),
        width: 120, height: 80, shape, status: 'AVAILABLE',
      });
      setMode('select');
    }
  }, [mode, svgPoint, wallThickness, rawTables.length, activeSection, createMutation]);

  // ── Right-click on canvas: end wall chain ─────────────────────────────────
  const handleContextMenu = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (modeRef.current === 'add-wall') { e.preventDefault(); setPendingWall(null); }
  }, []);

  // ── Chair: select + drag ──────────────────────────────────────────────────
  const handleChairPointerDown = useCallback((e: React.PointerEvent, id: string) => {
    if (mode !== 'select') return;
    e.stopPropagation();
    setSelectedElementId(id);
    setSelectedId(null);
    setSelectedIds(new Set());
    const { x, y } = svgPoint(e);
    setChairs((prev) => {
      const ch = prev.find((c) => c.id === id);
      if (ch) chairDragRef.current = { id, startX: x, startY: y, origX: ch.x, origY: ch.y };
      return prev;
    });
    (e.target as Element).setPointerCapture(e.pointerId);
  }, [mode, svgPoint]);

  // ── Drag: move table(s) ───────────────────────────────────────────────────
  const handleTablePointerDown = useCallback((e: React.PointerEvent, id: number) => {
    if (mode !== 'select') return;
    e.stopPropagation();
    setSelectedElementId(null);

    // Shift-click: toggle in multi-selection
    if (e.shiftKey) {
      setSelectedId(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
      return;
    }

    // Regular click on an already-multi-selected table: start group drag
    // Regular click elsewhere: switch to single selection
    setSelectedIds((prev) => {
      const inMulti = prev.has(id) && prev.size > 1;
      if (!inMulti) {
        setSelectedId(id);
        return new Set();
      }
      // Keep multi-selection, fall through to drag setup below
      return prev;
    });
    setSelectedId((prevId) => {
      // If already individually selected, keep it; otherwise use multi-group drag
      return prevId === id ? id : (selectedIds.has(id) && selectedIds.size > 1 ? null : id);
    });

    const { x, y } = svgPoint(e);
    // Build origPositions for all affected tables
    const affectedIds = selectedIds.has(id) && selectedIds.size > 1
      ? Array.from(selectedIds)
      : [id];
    const origPositions: Record<number, { x: number; y: number }> = {};
    affectedIds.forEach((tid) => {
      const tbl = tables.find((t) => t.id === tid);
      if (tbl) origPositions[tid] = { x: tbl.posX, y: tbl.posY };
    });
    dragRef.current = { ids: affectedIds, startX: x, startY: y, origPositions };
    (e.target as Element).setPointerCapture(e.pointerId);
  }, [mode, svgPoint, tables, selectedIds]);

  // ── Double-click: open edit dialog ───────────────────────────────────────
  const handleTableDoubleClick = useCallback((id: number) => {
    const tbl = tables.find((t) => t.id === id) ?? null;
    setEditingTable(tbl);
  }, [tables]);

  // ── Multi-select bounding box resize ──────────────────────────────────
  const handleMultiBBoxResizeDown = useCallback((e: React.PointerEvent, dir: string) => {
    if (!selectionBbox) return;
    e.stopPropagation();
    const { x, y } = svgPoint(e);
    const origTables: Record<number, { posX: number; posY: number; width: number; height: number }> = {};
    selectedTablesList.forEach((t) => {
      origTables[t.id] = { posX: t.posX, posY: t.posY, width: t.width, height: t.height };
    });
    multiResizeRef.current = { dir, startX: x, startY: y, origBbox: { ...selectionBbox }, origTables };
    (e.target as Element).setPointerCapture(e.pointerId);
  }, [svgPoint, selectionBbox, selectedTablesList]);

  // ── Resize: handle pointer down ───────────────────────────────────────────
  const handleResizeHandleDown = useCallback((e: React.PointerEvent, id: number, dir: string) => {
    e.stopPropagation();
    const { x, y } = svgPoint(e);
    const tbl = tables.find((t) => t.id === id)!;
    resizeRef.current = { id, dir, startX: x, startY: y, orig: { posX: tbl.posX, posY: tbl.posY, width: tbl.width, height: tbl.height } };
    (e.target as Element).setPointerCapture(e.pointerId);
  }, [svgPoint, tables]);

  // ── Pointer move ──────────────────────────────────────────────────────────
  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const { x, y } = svgPoint(e);

    // Update wall preview line directly in DOM (no React re-render)
    if (previewLineRef.current) {
      const pw = pendingWallRef.current;
      if (modeRef.current === 'add-wall' && pw) {
        previewLineRef.current.setAttribute('x1', String(pw.x));
        previewLineRef.current.setAttribute('y1', String(pw.y));
        previewLineRef.current.setAttribute('x2', String(x));
        previewLineRef.current.setAttribute('y2', String(y));
        previewLineRef.current.style.display = '';
      } else {
        previewLineRef.current.style.display = 'none';
      }
    }

    // Marquee: update selection rect in DOM
    if (marqueeRef.current && marqueeElRef.current) {
      const mx = Math.min(x, marqueeRef.current.startX);
      const my = Math.min(y, marqueeRef.current.startY);
      const mw = Math.abs(x - marqueeRef.current.startX);
      const mh = Math.abs(y - marqueeRef.current.startY);
      marqueeElRef.current.setAttribute('x', String(mx));
      marqueeElRef.current.setAttribute('y', String(my));
      marqueeElRef.current.setAttribute('width', String(mw));
      marqueeElRef.current.setAttribute('height', String(mh));
      return;
    }

    if (chairDragRef.current) {
      const { id, startX, startY, origX, origY } = chairDragRef.current;
      setChairs((prev) => prev.map((c) => c.id === id
        ? { ...c, x: snap(Math.max(0, origX + x - startX)), y: snap(Math.max(0, origY + y - startY)) }
        : c));
      setFloorplanDirty(true);
      return;
    }

    if (multiResizeRef.current) {
      const { dir, startX, startY, origBbox, origTables } = multiResizeRef.current;
      const dx = x - startX;
      const dy = y - startY;
      let nbx = origBbox.x, nby = origBbox.y, nbw = origBbox.w, nbh = origBbox.h;

      if (dir.includes('e')) nbw = Math.max(MIN_SIZE * 2, origBbox.w + dx);
      if (dir.includes('s')) nbh = Math.max(MIN_SIZE * 2, origBbox.h + dy);
      if (dir.includes('w')) { nbw = Math.max(MIN_SIZE * 2, origBbox.w - dx); nbx = origBbox.x + origBbox.w - nbw; }
      if (dir.includes('n')) { nbh = Math.max(MIN_SIZE * 2, origBbox.h - dy); nby = origBbox.y + origBbox.h - nbh; }

      const scaleX = nbw / origBbox.w;
      const scaleY = nbh / origBbox.h;

      Object.entries(origTables).forEach(([idStr, orig]) => {
        const tid = Number(idStr);
        const relX = (orig.posX - origBbox.x) / origBbox.w;
        const relY = (orig.posY - origBbox.y) / origBbox.h;
        applyLocal(tid, {
          posX:   snap(Math.max(0, nbx + relX * nbw)),
          posY:   snap(Math.max(0, nby + relY * nbh)),
          width:  snap(Math.max(MIN_SIZE, orig.width  * scaleX)),
          height: snap(Math.max(MIN_SIZE, orig.height * scaleY)),
        });
      });
      return;
    }

    if (dragRef.current) {
      const { ids, startX, startY, origPositions } = dragRef.current;
      const dx = x - startX;
      const dy = y - startY;
      ids.forEach((id) => {
        const orig = origPositions[id];
        if (orig) applyLocal(id, { posX: snap(Math.max(0, orig.x + dx)), posY: snap(Math.max(0, orig.y + dy)) });
      });
      return;
    }

    if (resizeRef.current) {
      const { id, dir, startX, startY, orig } = resizeRef.current;
      const dx = x - startX;
      const dy = y - startY;
      let { posX, posY, width, height } = orig;

      if (dir.includes('e')) width  = snap(Math.max(MIN_SIZE, orig.width  + dx));
      if (dir.includes('s')) height = snap(Math.max(MIN_SIZE, orig.height + dy));
      if (dir.includes('w')) { const newW = snap(Math.max(MIN_SIZE, orig.width - dx)); posX = orig.posX + (orig.width - newW); width = newW; }
      if (dir.includes('n')) { const newH = snap(Math.max(MIN_SIZE, orig.height - dy)); posY = orig.posY + (orig.height - newH); height = newH; }

      applyLocal(id, { posX, posY, width, height });
    }
  }, [svgPoint, applyLocal]);

  const handlePointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    // Finalise marquee: select all tables whose centre is inside the rect
    if (marqueeRef.current && marqueeElRef.current) {
      const rx = parseFloat(marqueeElRef.current.getAttribute('x') ?? '0');
      const ry = parseFloat(marqueeElRef.current.getAttribute('y') ?? '0');
      const rw = parseFloat(marqueeElRef.current.getAttribute('width') ?? '0');
      const rh = parseFloat(marqueeElRef.current.getAttribute('height') ?? '0');
      if (rw > 4 || rh > 4) {
        const inside = visibleTables
          .filter((t) => {
            const cx = t.posX + t.width / 2;
            const cy = t.posY + t.height / 2;
            return cx >= rx && cx <= rx + rw && cy >= ry && cy <= ry + rh;
          })
          .map((t) => t.id);
        if (inside.length > 0) {
          setSelectedIds(new Set(inside));
          setSelectedId(null);
          setSelectedElementId(null);
        }
      }
      marqueeElRef.current.style.display = 'none';
      marqueeRef.current = null;
    }
    dragRef.current      = null;
    resizeRef.current    = null;
    multiResizeRef.current = null;
    chairDragRef.current = null;
  }, [visibleTables]);

  // ── Delete selected (table(s), wall, or chair) ────────────────────────────
  const deleteSelected = () => {
    const multiIds = Array.from(selectedIds);
    if (multiIds.length > 1) {
      multiIds.forEach((id) => deleteMutation.mutate(id));
      setSelectedIds(new Set());
      enqueueSnackbar(`${multiIds.length} tables deleted`, { variant: 'warning' });
    } else if (selectedId) {
      deleteMutation.mutate(selectedId, {
        onSuccess: () => { setSelectedId(null); enqueueSnackbar('Table deleted', { variant: 'warning' }); },
      });
    } else if (selectedElementId) {
      if (selectedElementId.startsWith('w')) setWalls((prev) => prev.filter((w) => w.id !== selectedElementId));
      else setChairs((prev) => prev.filter((c) => c.id !== selectedElementId));
      setFloorplanDirty(true);
      setSelectedElementId(null);
      enqueueSnackbar('Deleted', { variant: 'warning' });
    }
  };

  // ── Duplicate selected ────────────────────────────────────────────────────
  const duplicateSelected = () => {
    const multiIds = Array.from(selectedIds);
    if (multiIds.length > 1) {
      multiIds.forEach((id) => {
        const tbl = tables.find((t) => t.id === id);
        if (tbl) createMutation.mutate({ ...tbl, id: undefined as any, name: `${tbl.name}b`, posX: tbl.posX + 20, posY: tbl.posY + 20 });
      });
    } else {
      const tbl = tables.find((t) => t.id === selectedId);
      if (!tbl) return;
      createMutation.mutate({ ...tbl, id: undefined as any, name: `${tbl.name}b`, posX: tbl.posX + 20, posY: tbl.posY + 20 });
    }
  };

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && !(e.target as HTMLElement).matches('input,textarea')) {
        deleteSelected();
      }
      if (e.key === 'Escape') { setMode('select'); setSelectedId(null); setSelectedIds(new Set()); setSelectedElementId(null); setPendingWall(null); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') { e.preventDefault(); setSelectedIds(new Set(visibleTables.map((t) => t.id))); setSelectedId(null); }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); saveAll(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, selectedIds, selectedElementId, unsavedChanges, floorplanDirty, visibleTables]);

  const hasPending    = Object.keys(unsavedChanges).length > 0 || floorplanDirty;
  const selectedTable = tables.find((t) => t.id === selectedId);
  const selectedWall  = walls.find((w) => w.id === selectedElementId);
  const selectedChair = chairs.find((c) => c.id === selectedElementId);
  const multiCount    = selectedIds.size;

  // ── Canvas size: fit all tables + padding ────────────────────────────────
  const canvasW = Math.max(1200, ...visibleTables.map((t) => t.posX + t.width + 80));
  const canvasH = Math.max(800,  ...visibleTables.map((t) => t.posY + t.height + 80));

  // ── SVG grid pattern ──────────────────────────────────────────────────────
  const gridPattern = (
    <defs>
      <pattern id="grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
        <path d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
      </pattern>
    </defs>
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#111' }}>
      {/* ── Toolbar ── */}
      <Box sx={{ px: 2, py: 1, bgcolor: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <TableRestaurant color="primary" />
        <Typography variant="subtitle1" fontWeight={800} sx={{ mr: 1 }}>Floor Plan Editor</Typography>

        <Divider orientation="vertical" flexItem />

        {/* Mode toggle — Tables */}
        <ToggleButtonGroup value={mode} exclusive onChange={(_, v) => { if (v) { setMode(v); if (v !== 'add-wall') setPendingWall(null); } }} size="small">
          <ToggleButton value="select">
            <Tooltip title="Select / Move"><DragIndicator fontSize="small" /></Tooltip>
          </ToggleButton>
          <ToggleButton value="add-square">
            <Tooltip title="Add Square Table"><CropSquare fontSize="small" /></Tooltip>
          </ToggleButton>
          <ToggleButton value="add-circle">
            <Tooltip title="Add Round Table"><RadioButtonUnchecked fontSize="small" /></Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>

        {/* Mode toggle — Room elements */}
        <ToggleButtonGroup value={mode} exclusive onChange={(_, v) => { if (v) { setMode(v); if (v !== 'add-wall') setPendingWall(null); } }} size="small">
          <ToggleButton value="add-wall">
            <Tooltip title="Draw Wall — click to start, click to extend, right-click to end"><HorizontalRule fontSize="small" /></Tooltip>
          </ToggleButton>
          <ToggleButton value="add-chair">
            <Tooltip title="Place Chair"><EventSeat fontSize="small" /></Tooltip>
          </ToggleButton>
          <ToggleButton value="view">
            <Tooltip title="View Mode (live status)"><Visibility fontSize="small" /></Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>

        {/* Wall thickness (only when wall tool active) */}
        {mode === 'add-wall' && (
          <>
            <Divider orientation="vertical" flexItem />
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>Wall:</Typography>
              <ToggleButtonGroup value={wallThickness} exclusive onChange={(_, v) => v && setWallThickness(v)} size="small">
                <ToggleButton value={3}  sx={{ px: 1, py: 0.25, fontSize: '0.7rem' }}>Thin</ToggleButton>
                <ToggleButton value={6}  sx={{ px: 1, py: 0.25, fontSize: '0.7rem' }}>Med</ToggleButton>
                <ToggleButton value={12} sx={{ px: 1, py: 0.25, fontSize: '0.7rem' }}>Thick</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          </>
        )}

        <Divider orientation="vertical" flexItem />

        {/* Selection actions */}
        {mode === 'select' && (selectedId || selectedElementId || multiCount > 0) && (
          <>
            {(selectedId || multiCount > 1) && (
              <>
                {selectedId && multiCount === 0 && (
                  <Tooltip title="Edit table details"><IconButton size="small" onClick={() => setEditingTable(selectedTable ?? null)}><Edit fontSize="small" /></IconButton></Tooltip>
                )}
                <Tooltip title={multiCount > 1 ? `Duplicate ${multiCount} tables` : 'Duplicate'}>
                  <IconButton size="small" onClick={duplicateSelected}><ContentCopy fontSize="small" /></IconButton>
                </Tooltip>
              </>
            )}
            <Tooltip title={multiCount > 1 ? `Delete ${multiCount} tables (Del)` : 'Delete (Del)'}>
              <IconButton size="small" color="error" onClick={deleteSelected}><Delete fontSize="small" /></IconButton>
            </Tooltip>
            <Divider orientation="vertical" flexItem />
          </>
        )}

        {/* Section filter */}
        <Stack direction="row" spacing={0.5}>
          {sections.map((s) => (
            <Chip
              key={s} label={s} size="small" clickable
              variant={activeSection === s ? 'filled' : 'outlined'}
              color={activeSection === s ? 'primary' : 'default'}
              onClick={() => setActiveSection(s)}
              sx={{ fontSize: '0.72rem' }}
            />
          ))}
        </Stack>

        <Box flex={1} />

        {/* Grid toggle */}
        <Tooltip title={showGrid ? 'Hide grid' : 'Show grid'}>
          <IconButton size="small" onClick={() => setShowGrid((g) => !g)}>
            {showGrid ? <GridOn fontSize="small" /> : <GridOff fontSize="small" />}
          </IconButton>
        </Tooltip>

        {/* Zoom */}
        <Tooltip title="Zoom out"><IconButton size="small" onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}><ZoomOut fontSize="small" /></IconButton></Tooltip>
        <Typography variant="caption" sx={{ minWidth: 36, textAlign: 'center' }}>{Math.round(zoom * 100)}%</Typography>
        <Tooltip title="Zoom in"><IconButton size="small" onClick={() => setZoom((z) => Math.min(2, z + 0.1))}><ZoomIn fontSize="small" /></IconButton></Tooltip>

        <Tooltip title="Refresh live data"><IconButton size="small" onClick={() => refetch()}><Refresh fontSize="small" /></IconButton></Tooltip>

        <Divider orientation="vertical" flexItem />

        <Button
          variant={hasPending ? 'contained' : 'outlined'}
          color={hasPending ? 'primary' : 'inherit'}
          size="small"
          startIcon={<Save />}
          onClick={saveAll}
          disabled={!hasPending}
        >
          {hasPending ? 'Save Changes' : 'Saved'}
        </Button>
      </Box>

      {/* ── Legend bar ── */}
      <Box sx={{ px: 2, py: 0.5, display: 'flex', gap: 2, alignItems: 'center', bgcolor: 'rgba(255,255,255,0.01)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        {Object.entries(STATUS_COLOR).map(([status, color]) => (
          <Stack key={status} direction="row" alignItems="center" spacing={0.5}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color }} />
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
              {status.charAt(0) + status.slice(1).toLowerCase().replace('_', ' ')}
            </Typography>
            <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.7rem' }}>
              {visibleTables.filter((t) => t.status === status).length}
            </Typography>
          </Stack>
        ))}
        {hasPending && (
          <Chip label="Unsaved changes" size="small" color="warning" sx={{ ml: 'auto', fontSize: '0.65rem' }} />
        )}
        {mode === 'add-wall' && (
          <Chip label={pendingWall ? 'Click to add next point — right-click to end' : 'Click canvas to start a wall'} size="small" color="info" sx={{ ml: 'auto', fontSize: '0.65rem' }} />
        )}
        {mode === 'add-chair' && (
          <Chip label="Click anywhere to place a chair" size="small" color="info" sx={{ ml: 'auto', fontSize: '0.65rem' }} />
        )}
        {(mode === 'add-square' || mode === 'add-circle') && (
          <Chip label={`Click canvas to place ${mode === 'add-circle' ? 'round' : 'square'} table`} size="small" color="info" sx={{ ml: 'auto', fontSize: '0.65rem' }} />
        )}
        {selectedTable && mode === 'select' && multiCount === 0 && (
          <Box sx={{ ml: 'auto' }}>
            <Typography variant="caption" color="text.secondary">
              Table: <b>{selectedTable.name}</b> — {selectedTable.width}×{selectedTable.height} at ({selectedTable.posX},{selectedTable.posY})
            </Typography>
          </Box>
        )}
        {multiCount > 0 && mode === 'select' && (
          <Box sx={{ ml: 'auto' }}>
            <Typography variant="caption" color="text.secondary">
              <b>{multiCount}</b> tables selected — drag to move, Del to delete, Shift+click to toggle
            </Typography>
          </Box>
        )}
        {selectedWall && mode === 'select' && (
          <Box sx={{ ml: 'auto' }}>
            <Typography variant="caption" color="text.secondary">Wall selected — Delete to remove</Typography>
          </Box>
        )}
        {selectedChair && mode === 'select' && (
          <Box sx={{ ml: 'auto' }}>
            <Typography variant="caption" color="text.secondary">Chair selected — drag to move, Delete to remove</Typography>
          </Box>
        )}
      </Box>

      {/* ── Canvas ── */}
      <Box sx={{ flex: 1, overflow: 'auto', position: 'relative', cursor: mode === 'select' || mode === 'view' ? 'default' : 'crosshair' }}>
        <Box
          sx={{
            transformOrigin: 'top left',
            transform: `scale(${zoom})`,
            width: canvasW, height: canvasH,
            display: 'inline-block',
          }}
        >
          <svg
            ref={svgRef}
            width={canvasW}
            height={canvasH}
            onPointerDown={handleCanvasPointerDown}
            onContextMenu={handleContextMenu}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{ display: 'block', userSelect: 'none' }}
          >
            {gridPattern}
            {showGrid && <rect width="100%" height="100%" fill="url(#grid)" />}

            {/* ── Walls ── */}
            {walls.map((wall) => (
              <line
                key={wall.id}
                data-fp="element"
                x1={wall.x1} y1={wall.y1}
                x2={wall.x2} y2={wall.y2}
                stroke={selectedElementId === wall.id ? '#0078d4' : '#888'}
                strokeWidth={selectedElementId === wall.id ? wall.thickness + 2 : wall.thickness}
                strokeLinecap="round"
                cursor={mode === 'select' ? 'pointer' : 'default'}
                onPointerDown={(e) => {
                  if (mode !== 'select') return;
                  e.stopPropagation();
                  setSelectedElementId(wall.id);
                  setSelectedId(null);
                }}
              />
            ))}

            {/* Wall endpoint dots */}
            {mode === 'select' && walls.map((wall) => (
              <g key={`ep-${wall.id}`} pointerEvents="none">
                <circle cx={wall.x1} cy={wall.y1} r={wall.thickness / 2 + 1} fill="#888" />
                <circle cx={wall.x2} cy={wall.y2} r={wall.thickness / 2 + 1} fill="#888" />
              </g>
            ))}

            {/* In-progress wall preview line (DOM-managed, no React re-render on move) */}
            <line ref={previewLineRef} stroke="#0078d4" strokeWidth={wallThickness} strokeDasharray="10 5" strokeLinecap="round" pointerEvents="none" style={{ display: 'none' }} />

            {/* Marquee selection rect */}
            <rect ref={marqueeElRef} fill="rgba(0,120,212,0.08)" stroke="#0078d4" strokeWidth={1} strokeDasharray="6 3" pointerEvents="none" style={{ display: 'none' }} />

            {/* Pending wall start indicator */}
            {pendingWall && (
              <g pointerEvents="none">
                <circle cx={pendingWall.x} cy={pendingWall.y} r={wallThickness / 2 + 4} fill="#0078d4" opacity={0.9} />
                <circle cx={pendingWall.x} cy={pendingWall.y} r={wallThickness / 2 + 9} fill="none" stroke="#0078d4" strokeWidth={1.5} opacity={0.4} strokeDasharray="4 3" />
              </g>
            )}

            {/* ── Chairs ── */}
            {chairs.map((chair) => {
              const sel = selectedElementId === chair.id;
              return (
                <g
                  key={chair.id}
                  data-fp="element"
                  onPointerDown={(e) => handleChairPointerDown(e, chair.id)}
                  cursor={mode === 'select' ? 'grab' : 'default'}
                >
                  {/* Seat */}
                  <ellipse
                    cx={chair.x} cy={chair.y + 3} rx={13} ry={11}
                    fill={sel ? 'rgba(0,120,212,0.25)' : 'rgba(120,80,40,0.3)'}
                    stroke={sel ? '#0078d4' : '#a07848'}
                    strokeWidth={sel ? 2 : 1.5}
                  />
                  {/* Backrest arc */}
                  <path
                    d={`M ${chair.x - 11},${chair.y - 3} A 11,9 0 0,1 ${chair.x + 11},${chair.y - 3}`}
                    fill="none"
                    stroke={sel ? '#0078d4' : '#a07848'}
                    strokeWidth={sel ? 3.5 : 3}
                    strokeLinecap="round"
                  />
                </g>
              );
            })}

            {/* ── Section labels ── */}
            {sections.filter((s) => s !== 'All').map((sec) => {
              const sectionTables = visibleTables.filter((t) => (t.section ?? 'Main') === sec);
              if (sectionTables.length === 0) return null;
              const minX = Math.min(...sectionTables.map((t) => t.posX));
              const minY = Math.min(...sectionTables.map((t) => t.posY));
              return (
                <text key={sec} x={minX} y={minY - 14} fontSize={11} fill="rgba(255,255,255,0.2)" fontWeight={600} style={{ fontFamily: 'Segoe UI, sans-serif', textTransform: 'uppercase', letterSpacing: 2 }}>
                  {sec}
                </text>
              );
            })}

            {/* ── Tables ── */}
            {visibleTables.map((t) => (
              <TableShapeEl
                key={t.id}
                table={t}
                selected={selectedId === t.id}
                multiSelected={selectedIds.has(t.id)}
                mode={mode}
                zoom={zoom}
                onPointerDown={handleTablePointerDown}
                onResizeHandleDown={handleResizeHandleDown}
                onDoubleClick={handleTableDoubleClick}
              />
            ))}

            {/* ── Multi-select bounding box + resize handles ── */}
            {selectionBbox && mode === 'select' && (() => {
              const PAD = 10;
              const bx = selectionBbox.x - PAD;
              const by = selectionBbox.y - PAD;
              const bw = selectionBbox.w + PAD * 2;
              const bh = selectionBbox.h + PAD * 2;
              const dirs = [
                { dir: 'nw', cx: bx,        cy: by        },
                { dir: 'n',  cx: bx + bw/2, cy: by        },
                { dir: 'ne', cx: bx + bw,   cy: by        },
                { dir: 'e',  cx: bx + bw,   cy: by + bh/2 },
                { dir: 'se', cx: bx + bw,   cy: by + bh   },
                { dir: 's',  cx: bx + bw/2, cy: by + bh   },
                { dir: 'sw', cx: bx,        cy: by + bh   },
                { dir: 'w',  cx: bx,        cy: by + bh/2 },
              ];
              return (
                <g>
                  <rect
                    x={bx} y={by} width={bw} height={bh}
                    fill="none" stroke="#0078d4" strokeWidth={1.5}
                    strokeDasharray="8 4" rx={4} pointerEvents="none"
                  />
                  {dirs.map(({ dir, cx, cy }) => (
                    <rect
                      key={dir}
                      x={cx - 5} y={cy - 5} width={10} height={10}
                      rx={2}
                      fill="#0078d4" stroke="#fff" strokeWidth={1.5}
                      cursor={`${dir}-resize`}
                      onPointerDown={(e) => handleMultiBBoxResizeDown(e, dir)}
                    />
                  ))}
                </g>
              );
            })()}
          </svg>
        </Box>
      </Box>

      {/* ── Edit dialog ── */}
      {editingTable && (
        <EditTableDialog
          table={editingTable}
          onClose={() => setEditingTable(null)}
          onSave={(updates) => {
            applyLocal(editingTable.id, updates);
            enqueueSnackbar('Changes staged — click Save to persist', { variant: 'info' });
          }}
        />
      )}
    </Box>
  );
}
