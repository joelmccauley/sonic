import React, { useMemo, useState } from 'react';
import {
  Box, Paper, Typography, Stack, Grid, Card, CardContent, Chip,
  CircularProgress, Alert, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Tabs, Tab, TextField,
} from '@mui/material';
import {
  TrendingUp, ReceiptLong, People, AttachMoney, Inventory2,
  Restaurant, AccessTime, PointOfSale,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import { reportsApi } from '@/api/reports.api';
import { format, subDays } from 'date-fns';

const CHART_COLORS = ['#3f8fdf', '#1d5fae', '#4caf50', '#f59e0b', '#ef4444', '#06b6d4', '#94a3b8'];

interface AnalyticsDashboard {
  meta: { start: string; end: string; dayCount: number };
  overview: {
    totalSales: number;
    paidOrders: number;
    avgCheck: number;
    totalTips: number;
    totalGuests: number;
    repeatCustomers: number;
    laborHours: number;
    inventoryValue: number;
    outOfStockItems: number;
  };
  employeePerformance: any[];
  serverTips: any[];
  shiftPerformance: any[];
  laborVsSales: any[];
  salesByDayOfWeek: any[];
  salesByServicePeriod: any[];
  coversAndGuests: any[];
  tableTurnTimes: any[];
  orderFulfillment: any[];
  kitchenTicketTimes: any[];
  voidCompRefunds: any[];
  discountPerformance: any[];
  categorySalesMix: any[];
  itemProfitability: any[];
  modifierAddOns: any[];
  inventoryConsumption: any[];
  wasteShrink: any[];
  inventoryValuation: { totalValue: number; trackedItems: number; missingCostItems: number; rows: any[] };
  customerFrequency: any[];
  channelSales: any[];
}

function money(value: number) {
  return `$${Number(value ?? 0).toFixed(2)}`;
}

function number(value: number) {
  return Number(value ?? 0).toFixed(0);
}

function decimal(value: number) {
  return Number(value ?? 0).toFixed(1);
}

function percent(value: number) {
  return `${Number(value ?? 0).toFixed(1)}%`;
}

function minutes(value: number) {
  return `${Number(value ?? 0).toFixed(0)} min`;
}

function StatCard({ title, value, subtitle, icon, color = '#3f8fdf' }: { title: string; value: string | number; subtitle?: string; icon: React.ReactNode; color?: string }) {
  return (
    <Card sx={{ bgcolor: '#111722', border: `1px solid ${color}33`, height: '100%' }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="caption" color="text.secondary" textTransform="uppercase" letterSpacing={0.7}>{title}</Typography>
            <Typography variant="h4" fontWeight={800} color={color} mt={0.5}>{value}</Typography>
            {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
          </Box>
          <Box sx={{ color, opacity: 0.8, fontSize: 40 }}>{icon}</Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function ReportSection({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Paper sx={{ p: 2.25, bgcolor: '#111722', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2.5 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" mb={1.5}>
        <Box>
          <Typography variant="h6" fontWeight={700}>{title}</Typography>
          {subtitle && <Typography variant="body2" color="text.secondary">{subtitle}</Typography>}
        </Box>
      </Stack>
      {children}
    </Paper>
  );
}

function DataTable({
  columns,
  rows,
  empty = 'No data available for this range.',
}: {
  columns: { key: string; label: string; align?: 'left' | 'right'; render?: (row: any) => React.ReactNode }[];
  rows: any[];
  empty?: string;
}) {
  if (!rows.length) return <Alert severity="info">{empty}</Alert>;
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ '& th': { fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary', borderBottom: '1px solid rgba(255,255,255,0.08)' } }}>
            {columns.map((column) => (
              <TableCell key={column.key} align={column.align ?? 'left'}>{column.label}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, idx) => (
            <TableRow key={row.id ?? row.name ?? row.item ?? row.employee ?? row.date ?? idx} sx={{ '& td': { borderBottom: '1px solid rgba(255,255,255,0.04)' } }}>
              {columns.map((column) => (
                <TableCell key={column.key} align={column.align ?? 'left'}>
                  {column.render ? column.render(row) : row[column.key]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function ReportsView() {
  const [tab, setTab] = useState(0);
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 29), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data, isLoading } = useQuery<AnalyticsDashboard>({
    queryKey: ['reports-analytics', startDate, endDate],
    queryFn: () => reportsApi.getAnalytics({ startDate, endDate }).then((r) => r.data),
  });

  const overviewCards = useMemo(() => {
    if (!data) return [];
    return [
      { title: 'Net Sales', value: money(data.overview.totalSales), icon: <AttachMoney fontSize="inherit" />, color: '#3f8fdf' },
      { title: 'Paid Orders', value: number(data.overview.paidOrders), icon: <ReceiptLong fontSize="inherit" />, color: '#4caf50' },
      { title: 'Average Check', value: money(data.overview.avgCheck), icon: <TrendingUp fontSize="inherit" />, color: '#00bcd4' },
      { title: 'Total Tips', value: money(data.overview.totalTips), icon: <PointOfSale fontSize="inherit" />, color: '#f59e0b' },
      { title: 'Guests Served', value: number(data.overview.totalGuests), icon: <People fontSize="inherit" />, color: '#ef4444' },
      { title: 'Repeat Guests', value: number(data.overview.repeatCustomers), icon: <Restaurant fontSize="inherit" />, color: '#8b5cf6' },
      { title: 'Labor Hours', value: decimal(data.overview.laborHours), icon: <AccessTime fontSize="inherit" />, color: '#22c55e' },
      { title: 'Inventory Value', value: money(data.overview.inventoryValue), icon: <Inventory2 fontSize="inherit" />, color: '#f97316' },
    ];
  }, [data]);

  if (isLoading || !data) {
    return <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto', bgcolor: 'background.default' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} spacing={2} mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={800}>Reports & Analytics</Typography>
          <Typography variant="body2" color="text.secondary">20 operational, employee, sales, inventory, and guest reports for the selected date range.</Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} size="small" InputLabelProps={{ shrink: true }} />
          <TextField label="End Date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} size="small" InputLabelProps={{ shrink: true }} />
        </Stack>
      </Stack>

      <Grid container spacing={2} mb={3}>
        {overviewCards.map((card) => (
          <Grid item xs={12} sm={6} md={3} key={card.title}>
            <StatCard {...card} />
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ mb: 3, bgcolor: '#111722', border: '1px solid rgba(255,255,255,0.06)' }}>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto">
          <Tab label="Overview" />
          <Tab label="Employees" />
          <Tab label="Service" />
          <Tab label="Menu" />
          <Tab label="Inventory" />
          <Tab label="Customers" />
        </Tabs>
      </Paper>

      {tab === 0 && (
        <Stack spacing={3}>
          <Grid container spacing={3}>
            <Grid item xs={12} lg={7}>
              <ReportSection title="Sales by Day of Week" subtitle="Report 1 of 20">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data.salesByDayOfWeek}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="weekday" tick={{ fill: '#9fb4cc' }} />
                    <YAxis tick={{ fill: '#9fb4cc' }} />
                    <Tooltip formatter={(value: number) => [money(value), 'Sales']} contentStyle={{ backgroundColor: '#0f172a', border: 'none' }} />
                    <Bar dataKey="totalSales" fill="#3f8fdf" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ReportSection>
            </Grid>
            <Grid item xs={12} lg={5}>
              <ReportSection title="Sales by Service Period" subtitle="Report 2 of 20">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={data.salesByServicePeriod} dataKey="totalSales" nameKey="period" outerRadius={100} label={({ period, percent: pct }) => `${period} ${(pct * 100).toFixed(0)}%`}>
                      {data.salesByServicePeriod.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value: number) => [money(value), 'Sales']} contentStyle={{ backgroundColor: '#0f172a', border: 'none' }} />
                  </PieChart>
                </ResponsiveContainer>
              </ReportSection>
            </Grid>
          </Grid>

          <Grid container spacing={3}>
            <Grid item xs={12} lg={6}>
              <ReportSection title="Category Sales Mix" subtitle="Report 3 of 20">
                <DataTable
                  rows={data.categorySalesMix}
                  columns={[
                    { key: 'category', label: 'Category' },
                    { key: 'quantity', label: 'Qty', align: 'right' },
                    { key: 'revenue', label: 'Revenue', align: 'right', render: (row) => money(row.revenue) },
                    { key: 'mixPercent', label: 'Mix', align: 'right', render: (row) => percent(row.mixPercent) },
                  ]}
                />
              </ReportSection>
            </Grid>
            <Grid item xs={12} lg={6}>
              <ReportSection title="Channel Sales Report" subtitle="Report 4 of 20">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={data.channelSales}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="type" tick={{ fill: '#9fb4cc' }} />
                    <YAxis tick={{ fill: '#9fb4cc' }} />
                    <Tooltip formatter={(value: number) => [money(value), 'Sales']} contentStyle={{ backgroundColor: '#0f172a', border: 'none' }} />
                    <Legend />
                    <Line type="monotone" dataKey="totalSales" stroke="#3f8fdf" strokeWidth={3} />
                    <Line type="monotone" dataKey="avgCheck" stroke="#4caf50" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </ReportSection>
            </Grid>
          </Grid>
        </Stack>
      )}

      {tab === 1 && (
        <Stack spacing={3}>
          <ReportSection title="Employee Sales Performance" subtitle="Report 5 of 20">
            <DataTable rows={data.employeePerformance} columns={[
              { key: 'employee', label: 'Employee' },
              { key: 'role', label: 'Role' },
              { key: 'totalSales', label: 'Sales', align: 'right', render: (row) => money(row.totalSales) },
              { key: 'totalOrders', label: 'Orders', align: 'right' },
              { key: 'avgCheck', label: 'Avg Check', align: 'right', render: (row) => money(row.avgCheck) },
              { key: 'totalTips', label: 'Tips', align: 'right', render: (row) => money(row.totalTips) },
              { key: 'salesPerLaborHour', label: 'Sales / Hr', align: 'right', render: (row) => money(row.salesPerLaborHour) },
            ]} />
          </ReportSection>

          <ReportSection title="Server Tip Report" subtitle="Report 6 of 20">
            <DataTable rows={data.serverTips} columns={[
              { key: 'employee', label: 'Employee' },
              { key: 'totalOrders', label: 'Orders', align: 'right' },
              { key: 'totalTips', label: 'Total Tips', align: 'right', render: (row) => money(row.totalTips) },
              { key: 'tipPercent', label: 'Tip %', align: 'right', render: (row) => percent(row.tipPercent) },
              { key: 'avgTipPerOrder', label: 'Avg Tip / Order', align: 'right', render: (row) => money(row.avgTipPerOrder) },
            ]} />
          </ReportSection>

          <ReportSection title="Shift Performance Report" subtitle="Report 7 of 20">
            <DataTable rows={data.shiftPerformance.slice(0, 25)} columns={[
              { key: 'employee', label: 'Employee' },
              { key: 'date', label: 'Date' },
              { key: 'laborHours', label: 'Hours', align: 'right', render: (row) => decimal(row.laborHours) },
              { key: 'totalSales', label: 'Sales', align: 'right', render: (row) => money(row.totalSales) },
              { key: 'totalOrders', label: 'Orders', align: 'right' },
              { key: 'avgTicketMinutes', label: 'Avg Ticket Time', align: 'right', render: (row) => minutes(row.avgTicketMinutes) },
              { key: 'salesPerHour', label: 'Sales / Hr', align: 'right', render: (row) => money(row.salesPerHour) },
            ]} />
          </ReportSection>

          <ReportSection title="Labor vs Sales Report" subtitle="Report 8 of 20">
            <DataTable rows={data.laborVsSales} columns={[
              { key: 'date', label: 'Date' },
              { key: 'weekday', label: 'Day' },
              { key: 'laborHours', label: 'Labor Hours', align: 'right', render: (row) => decimal(row.laborHours) },
              { key: 'totalSales', label: 'Sales', align: 'right', render: (row) => money(row.totalSales) },
              { key: 'totalOrders', label: 'Orders', align: 'right' },
              { key: 'salesPerLaborHour', label: 'Sales / Labor Hr', align: 'right', render: (row) => money(row.salesPerLaborHour) },
            ]} />
          </ReportSection>
        </Stack>
      )}

      {tab === 2 && (
        <Stack spacing={3}>
          <ReportSection title="Covers and Guest Count Report" subtitle="Report 9 of 20">
            <DataTable rows={data.coversAndGuests} columns={[
              { key: 'date', label: 'Date' },
              { key: 'weekday', label: 'Day' },
              { key: 'totalGuests', label: 'Guests', align: 'right' },
              { key: 'totalOrders', label: 'Orders', align: 'right' },
              { key: 'avgPartySize', label: 'Avg Party', align: 'right', render: (row) => decimal(row.avgPartySize) },
              { key: 'revenuePerGuest', label: 'Revenue / Guest', align: 'right', render: (row) => money(row.revenuePerGuest) },
            ]} />
          </ReportSection>

          <ReportSection title="Table Turn Time Report" subtitle="Report 10 of 20">
            <DataTable rows={data.tableTurnTimes} columns={[
              { key: 'table', label: 'Table' },
              { key: 'turns', label: 'Turns', align: 'right' },
              { key: 'avgTurnMinutes', label: 'Avg Turn', align: 'right', render: (row) => minutes(row.avgTurnMinutes) },
              { key: 'revenuePerTurn', label: 'Revenue / Turn', align: 'right', render: (row) => money(row.revenuePerTurn) },
              { key: 'guestsPerTurn', label: 'Guests / Turn', align: 'right', render: (row) => decimal(row.guestsPerTurn) },
            ]} />
          </ReportSection>

          <ReportSection title="Order Fulfillment Time Report" subtitle="Report 11 of 20">
            <DataTable rows={data.orderFulfillment} columns={[
              { key: 'type', label: 'Channel' },
              { key: 'totalOrders', label: 'Orders', align: 'right' },
              { key: 'avgOpenToSendMinutes', label: 'Open to Send', align: 'right', render: (row) => minutes(row.avgOpenToSendMinutes) },
              { key: 'avgOpenToCloseMinutes', label: 'Open to Close', align: 'right', render: (row) => minutes(row.avgOpenToCloseMinutes) },
              { key: 'avgSendToCloseMinutes', label: 'Send to Close', align: 'right', render: (row) => minutes(row.avgSendToCloseMinutes) },
            ]} />
          </ReportSection>

          <ReportSection title="Kitchen Ticket Time Report" subtitle="Report 12 of 20">
            <DataTable rows={data.kitchenTicketTimes} columns={[
              { key: 'item', label: 'Item' },
              { key: 'category', label: 'Category' },
              { key: 'quantity', label: 'Qty', align: 'right' },
              { key: 'avgOrderToSendMinutes', label: 'Order to Send', align: 'right', render: (row) => minutes(row.avgOrderToSendMinutes) },
              { key: 'avgSendToCloseMinutes', label: 'Send to Close', align: 'right', render: (row) => minutes(row.avgSendToCloseMinutes) },
            ]} />
          </ReportSection>

          <ReportSection title="Void / Comp / Refund Report" subtitle="Report 13 of 20">
            <DataTable rows={data.voidCompRefunds} columns={[
              { key: 'employee', label: 'Employee' },
              { key: 'voidOrders', label: 'Void Orders', align: 'right' },
              { key: 'voidItems', label: 'Void Items', align: 'right' },
              { key: 'refundCount', label: 'Refunds', align: 'right' },
              { key: 'refundAmount', label: 'Refund $', align: 'right', render: (row) => money(row.refundAmount) },
              { key: 'discountAmount', label: 'Comp / Discount $', align: 'right', render: (row) => money(row.discountAmount) },
            ]} />
          </ReportSection>

          <ReportSection title="Discount Performance Report" subtitle="Report 14 of 20">
            <DataTable rows={data.discountPerformance} columns={[
              { key: 'discount', label: 'Discount' },
              { key: 'code', label: 'Code', render: (row) => row.code ?? '—' },
              { key: 'count', label: 'Uses', align: 'right' },
              { key: 'totalAmount', label: 'Total Discount', align: 'right', render: (row) => money(row.totalAmount) },
              { key: 'avgDiscount', label: 'Avg Discount', align: 'right', render: (row) => money(row.avgDiscount) },
              { key: 'topEmployee', label: 'Top Employee' },
            ]} />
          </ReportSection>
        </Stack>
      )}

      {tab === 3 && (
        <Stack spacing={3}>
          <ReportSection title="Item Profitability Report" subtitle="Report 15 of 20">
            <DataTable rows={data.itemProfitability} columns={[
              { key: 'item', label: 'Item' },
              { key: 'category', label: 'Category' },
              { key: 'quantity', label: 'Qty', align: 'right' },
              { key: 'revenue', label: 'Revenue', align: 'right', render: (row) => money(row.revenue) },
              { key: 'cost', label: 'Est. Cost', align: 'right', render: (row) => money(row.cost) },
              { key: 'grossProfit', label: 'Gross Profit', align: 'right', render: (row) => money(row.grossProfit) },
              { key: 'marginPercent', label: 'Margin', align: 'right', render: (row) => percent(row.marginPercent) },
            ]} />
          </ReportSection>

          <ReportSection title="Modifier / Add-On Report" subtitle="Report 16 of 20">
            <DataTable rows={data.modifierAddOns} columns={[
              { key: 'modifier', label: 'Modifier' },
              { key: 'count', label: 'Qty', align: 'right' },
              { key: 'revenue', label: 'Revenue', align: 'right', render: (row) => money(row.revenue) },
              { key: 'attachmentRate', label: 'Attach Rate', align: 'right', render: (row) => percent(row.attachmentRate) },
            ]} />
          </ReportSection>

          <ReportSection title="Category Sales Mix Detail" subtitle="Report 17 of 20">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={data.categorySalesMix} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" tick={{ fill: '#9fb4cc' }} />
                <YAxis type="category" dataKey="category" width={120} tick={{ fill: '#9fb4cc' }} />
                <Tooltip formatter={(value: number) => [money(value), 'Revenue']} contentStyle={{ backgroundColor: '#0f172a', border: 'none' }} />
                <Bar dataKey="revenue" fill="#3f8fdf" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ReportSection>
        </Stack>
      )}

      {tab === 4 && (
        <Stack spacing={3}>
          <ReportSection title="Inventory Consumption Report" subtitle="Report 18 of 20">
            <DataTable rows={data.inventoryConsumption} columns={[
              { key: 'item', label: 'Item' },
              { key: 'category', label: 'Category' },
              { key: 'onHand', label: 'On Hand', align: 'right', render: (row) => decimal(row.onHand) },
              { key: 'soldQty', label: 'Sold in Range', align: 'right', render: (row) => decimal(row.soldQty) },
              { key: 'lowThreshold', label: 'Low Threshold', align: 'right', render: (row) => decimal(row.lowThreshold) },
              { key: 'projectedDaysLeft', label: 'Days Left', align: 'right', render: (row) => row.projectedDaysLeft == null ? '—' : decimal(row.projectedDaysLeft) },
              { key: 'status', label: 'Status', render: (row) => <Chip size="small" label={row.status} color={row.status === 'Out' ? 'error' : row.status === 'Low' ? 'warning' : 'success'} /> },
            ]} />
          </ReportSection>

          <ReportSection title="Waste / Spill / Shrink Report" subtitle="Report 19 of 20">
            <DataTable rows={data.wasteShrink} columns={[
              { key: 'signal', label: 'Signal' },
              { key: 'count', label: 'Count', align: 'right' },
              { key: 'amount', label: 'Impact', align: 'right', render: (row) => money(row.amount) },
              { key: 'note', label: 'Notes' },
            ]} />
          </ReportSection>

          <ReportSection title="Inventory Valuation Report" subtitle="Report 20 of 20">
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} mb={2}>
              <Chip label={`Tracked value: ${money(data.inventoryValuation.totalValue)}`} color="primary" />
              <Chip label={`Costed items: ${data.inventoryValuation.trackedItems}`} />
              <Chip label={`Missing cost: ${data.inventoryValuation.missingCostItems}`} color="warning" />
            </Stack>
            <DataTable rows={data.inventoryValuation.rows.slice(0, 25)} columns={[
              { key: 'item', label: 'Item' },
              { key: 'category', label: 'Category' },
              { key: 'onHand', label: 'On Hand', align: 'right', render: (row) => decimal(row.onHand) },
              { key: 'unitCost', label: 'Unit Cost', align: 'right', render: (row) => money(row.unitCost) },
              { key: 'inventoryValue', label: 'Inventory Value', align: 'right', render: (row) => money(row.inventoryValue) },
            ]} />
          </ReportSection>
        </Stack>
      )}

      {tab === 5 && (
        <Stack spacing={3}>
          <ReportSection title="Customer Frequency / Loyalty Report" subtitle="Guest retention and repeat spend">
            <DataTable rows={data.customerFrequency.slice(0, 40)} columns={[
              { key: 'customer', label: 'Customer' },
              { key: 'visits', label: 'Visits', align: 'right' },
              { key: 'totalSales', label: 'Total Spend', align: 'right', render: (row) => money(row.totalSales) },
              { key: 'avgCheck', label: 'Avg Check', align: 'right', render: (row) => money(row.avgCheck) },
              { key: 'totalGuests', label: 'Guests', align: 'right' },
              { key: 'repeatCustomer', label: 'Repeat', render: (row) => <Chip size="small" label={row.repeatCustomer ? 'Yes' : 'No'} color={row.repeatCustomer ? 'success' : 'default'} /> },
              { key: 'lastVisit', label: 'Last Visit', render: (row) => format(new Date(row.lastVisit), 'MMM d, yyyy') },
            ]} />
          </ReportSection>

          <ReportSection title="Channel Sales Detail" subtitle="Dine-in vs takeout vs delivery vs bar">
            <DataTable rows={data.channelSales} columns={[
              { key: 'type', label: 'Channel' },
              { key: 'totalOrders', label: 'Orders', align: 'right' },
              { key: 'totalSales', label: 'Sales', align: 'right', render: (row) => money(row.totalSales) },
              { key: 'avgCheck', label: 'Avg Check', align: 'right', render: (row) => money(row.avgCheck) },
              { key: 'totalGuests', label: 'Guests', align: 'right' },
              { key: 'revenuePerGuest', label: 'Revenue / Guest', align: 'right', render: (row) => money(row.revenuePerGuest) },
            ]} />
          </ReportSection>

          <Alert severity="info" sx={{ bgcolor: 'rgba(63,143,223,0.08)' }}>
            Labor cost, supplier receipts, and true waste variance can be made exact once wages, purchase orders, and inventory adjustment history are tracked explicitly. The current dashboard uses the best metrics available from live POS activity, orders, refunds, voids, discounts, shifts, and stock on hand.
          </Alert>
        </Stack>
      )}
    </Box>
  );
}
