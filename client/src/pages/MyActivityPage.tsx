import React, { useMemo } from 'react';
import { Box, Paper, Typography, Stack, Grid, Card, CardContent, Chip, Button, Avatar, Divider, List, ListItem, ListItemAvatar, ListItemText } from '@mui/material';
import { CheckCircle, Update, AddCircle, Schedule, ArrowForward, Timeline, Restaurant, ReceiptLong, LocalAtm, Inventory2, People, AccessTime, WarningAmber } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { activityApi } from '@/api/activity.api';
import type { ActivityDetailMetric } from '@/api/activity.api';

const CHART_COLORS = ['#57a300', '#0078d4', '#c19c00', '#8b5cf6'];

function money(value: number) {
  return `$${Number(value ?? 0).toFixed(2)}`;
}

function StatCard({ title, value, subtitle, icon, color, onClick }: { title: string; value: string | number; subtitle?: string; icon: React.ReactNode; color: string; onClick?: () => void }) {
  return (
    <Card
      onClick={onClick}
      sx={{
        height: '100%',
        bgcolor: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.16s ease, transform 0.16s ease',
        '&:hover': onClick ? { borderColor: `${color}88`, transform: 'translateY(-1px)' } : undefined,
      }}
    >
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
          <Box>
            <Typography variant="caption" color="text.secondary" textTransform="uppercase" letterSpacing={0.8}>{title}</Typography>
            <Typography variant="h4" fontWeight={800} color={color} mt={0.5}>{value}</Typography>
            {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
          </Box>
          <Avatar sx={{ bgcolor: `${color}22`, color, width: 44, height: 44 }}>{icon}</Avatar>
        </Stack>
      </CardContent>
    </Card>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Paper sx={{ p: 2.5, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3, height: '100%' }}>
      <Stack spacing={0.5} mb={2}>
        <Typography variant="h6" fontWeight={800}>{title}</Typography>
        {subtitle && <Typography variant="body2" color="text.secondary">{subtitle}</Typography>}
      </Stack>
      {children}
    </Paper>
  );
}

function toneColor(tone: string) {
  switch (tone) {
    case 'success': return '#57a300';
    case 'info': return '#0078d4';
    case 'warning': return '#c19c00';
    case 'error': return '#c42b1c';
    default: return '#9fb4cc';
  }
}

function toneIcon(kind: string) {
  const normalized = kind.toLowerCase();
  if (normalized.includes('payment')) return <LocalAtm fontSize="small" />;
  if (normalized.includes('order')) return <ReceiptLong fontSize="small" />;
  if (normalized.includes('shift')) return <AccessTime fontSize="small" />;
  if (normalized.includes('inventory')) return <Inventory2 fontSize="small" />;
  if (normalized.includes('employee')) return <People fontSize="small" />;
  if (normalized.includes('send') || normalized.includes('ready')) return <Restaurant fontSize="small" />;
  if (normalized.includes('create')) return <AddCircle fontSize="small" />;
  if (normalized.includes('update') || normalized.includes('transfer')) return <Update fontSize="small" />;
  return <Timeline fontSize="small" />;
}

export default function MyActivityPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['my-activity'],
    queryFn: () => activityApi.getOverview().then((r) => r.data),
  });

  const chartData = data?.workstream ?? [];
  const roleBucket = data?.role === 'OWNER' || data?.role === 'MANAGER'
    ? 'leader'
    : data?.role === 'KITCHEN' || data?.role === 'BARTENDER'
      ? 'production'
      : 'service';

  const recentLabel = useMemo(() => {
    if (!data) return '';
    return data.scopeLabel;
  }, [data]);

  const topCards = useMemo(() => {
    if (!data) return [];
    if (roleBucket === 'production') {
      return [
        { title: 'Tickets waiting', value: data.workstream.find((entry) => entry.label === 'Tickets waiting')?.value ?? 0, subtitle: 'Not started yet', icon: <ReceiptLong />, color: '#c19c00' },
        { title: 'In progress', value: data.workstream.find((entry) => entry.label === 'In progress')?.value ?? 0, subtitle: 'Being worked', icon: <Restaurant />, color: '#0078d4' },
        { title: 'Ready to bump', value: data.workstream.find((entry) => entry.label === 'Ready to bump')?.value ?? 0, subtitle: 'Waiting for service', icon: <CheckCircle />, color: '#57a300' },
        { title: 'Closed this week', value: data.summary.completed7d, subtitle: 'Completed orders', icon: <Schedule />, color: '#8b5cf6' },
      ];
    }
    if (roleBucket === 'service') {
      return [
        { title: 'Active shift', value: data.meta.activeShiftMinutes ? `${Math.floor(data.meta.activeShiftMinutes / 60)}h ${data.meta.activeShiftMinutes % 60}m` : 'Not clocked in', subtitle: 'Shift timer', icon: <AccessTime />, color: '#3f8fdf' },
        { title: 'Open checks', value: data.meta.openOrders, subtitle: 'Live orders', icon: <ReceiptLong />, color: '#0078d4', metric: 'open-checks' as ActivityDetailMetric },
        { title: 'Tips today', value: money(data.meta.totalTipsToday), subtitle: 'Processed by you', icon: <LocalAtm />, color: '#8b5cf6' },
        { title: 'Occupied tables', value: data.workstream.find((entry) => entry.label === 'Occupied tables')?.value ?? 0, subtitle: 'On the floor', icon: <People />, color: '#c19c00' },
      ];
    }
    return [
      { title: 'Paid today', value: data.meta.paidToday, subtitle: 'Closed checks', icon: <CheckCircle />, color: '#57a300', metric: 'paid-today' as ActivityDetailMetric },
      { title: 'Open checks', value: data.meta.openOrders, subtitle: 'Still running', icon: <ReceiptLong />, color: '#0078d4', metric: 'open-checks' as ActivityDetailMetric },
      { title: 'Sales today', value: money(data.meta.totalSalesToday), subtitle: 'Payments processed', icon: <LocalAtm />, color: '#8b5cf6', metric: 'sales-today' as ActivityDetailMetric },
      { title: 'Needs attention', value: data.summary.dueSoon, subtitle: 'Follow up now', icon: <WarningAmber />, color: '#c19c00', metric: 'needs-attention' as ActivityDetailMetric },
    ];
  }, [data, roleBucket]);

  const snapshotTitle = roleBucket === 'production' ? 'Station snapshot' : roleBucket === 'service' ? 'Shift snapshot' : 'Team snapshot';
  const snapshotSubtitle = roleBucket === 'production'
    ? 'Useful numbers for the current station and line.'
    : roleBucket === 'service'
      ? 'Useful numbers for the current shift and floor.'
      : 'Useful numbers for the current team and service window.';

  if (isLoading || !data) {
    return <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}><Typography color="text.secondary">Loading activity…</Typography></Box>;
  }

  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto', bgcolor: '#141414' }}>
      <Paper sx={{
        p: { xs: 2.5, md: 3 },
        mb: 3,
        borderRadius: 4,
        color: '#e8eef7',
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'linear-gradient(135deg, rgba(18,28,44,0.98) 0%, rgba(12,16,24,0.98) 55%, rgba(9,12,18,0.98) 100%)',
      }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} spacing={2}>
          <Box sx={{ maxWidth: 720 }}>
            <Chip label={recentLabel} size="small" sx={{ mb: 1.5, bgcolor: 'rgba(0,120,212,0.18)', color: '#8ecbff', fontWeight: 700 }} />
            <Typography variant="h4" fontWeight={900} mb={1} sx={{ letterSpacing: '-0.03em' }}>
              {roleBucket === 'production' ? 'Kitchen activity at a glance' : roleBucket === 'service' ? 'Floor activity at a glance' : 'Restaurant activity at a glance'}
            </Typography>
            <Typography variant="body1" color="rgba(232,238,247,0.78)">
              A live operational dashboard for your role. Track open checks, tickets, tables, payments, and what needs attention without digging through other screens.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button variant="contained" endIcon={<ArrowForward />} onClick={() => navigate('/floorview')}>
              Open Floor View
            </Button>
            <Button variant="outlined" onClick={() => navigate('/orders')}>
              View Orders
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Grid container spacing={2} mb={3}>
        {topCards.map((card) => (
          <Grid item xs={12} sm={6} lg={3} key={card.title}>
            <StatCard
              title={card.title}
              value={card.value}
              subtitle={card.subtitle}
              icon={card.icon}
              color={card.color}
              onClick={card.metric ? () => navigate(`/my-activity/details/${card.metric}`) : undefined}
            />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} lg={7}>
          <Section title="Workload mix" subtitle="A quick view of the work moving through the day.">
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={7}>
                <Box sx={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={chartData} dataKey="value" nameKey="label" innerRadius={78} outerRadius={108} paddingAngle={3}>
                        {chartData.map((entry, idx) => <Cell key={entry.label} fill={entry.color ?? CHART_COLORS[idx % CHART_COLORS.length]} />)}
                      </Pie>
                      <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              </Grid>
              <Grid item xs={12} md={5}>
                <Stack spacing={1.2}>
                  {chartData.map((entry) => (
                    <Stack key={entry.label} direction="row" spacing={1.2} alignItems="center">
                      <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: entry.color }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" fontWeight={700}>{entry.label}</Typography>
                        <Typography variant="caption" color="text.secondary">{entry.value} items</Typography>
                      </Box>
                    </Stack>
                  ))}
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', my: 0.5 }} />
                  <Typography variant="caption" color="text.secondary">
                    This widget is tuned to the role you are signed in as and reflects what matters most right now.
                  </Typography>
                </Stack>
              </Grid>
            </Grid>
          </Section>
        </Grid>
        <Grid item xs={12} lg={5}>
          <Section title={snapshotTitle} subtitle={snapshotSubtitle}>
            <Grid container spacing={2}>
              {data.focusCards.map((card) => (
                <Grid item xs={12} sm={6} key={card.title}>
                  <Paper sx={{ p: 1.75, borderRadius: 2.5, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <Typography variant="caption" color="text.secondary" textTransform="uppercase" letterSpacing={0.6}>{card.title}</Typography>
                    <Typography variant="h5" fontWeight={900} color={card.color} mt={0.25}>{card.value}</Typography>
                    {card.subtitle && <Typography variant="caption" color="text.secondary">{card.subtitle}</Typography>}
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Section>
        </Grid>
      </Grid>

      <Section title="Recent activity" subtitle="The latest operational events from your workspace.">
        <List disablePadding sx={{ maxHeight: 420, overflow: 'auto' }}>
          {data.feed.map((item, idx) => (
            <React.Fragment key={item.id}>
              <ListItem alignItems="flex-start" sx={{ px: 0, py: 1.5 }}>
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: `${toneColor(item.tone)}22`, color: toneColor(item.tone), width: 40, height: 40 }}>
                    {toneIcon(item.kind)}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={<Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                    <Typography variant="body1" fontWeight={700}>{item.title}</Typography>
                    <Chip label={item.timeLabel} size="small" sx={{ height: 22, bgcolor: 'rgba(255,255,255,0.06)', color: 'text.secondary' }} />
                  </Stack>}
                  secondary={<Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{item.subtitle}</Typography>}
                />
              </ListItem>
              {idx < data.feed.length - 1 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />}
            </React.Fragment>
          ))}
        </List>
      </Section>
    </Box>
  );
}