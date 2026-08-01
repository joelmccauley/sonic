import React from 'react';
import { Box, Paper, Typography, Stack, Chip, Button, Divider, List, ListItem, ListItemText } from '@mui/material';
import { ArrowBack, ReceiptLong, WarningAmber, Paid, AttachMoney } from '@mui/icons-material';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { activityApi } from '@/api/activity.api';
import type { ActivityDetailMetric } from '@/api/activity.api';

const METRIC_META: Record<ActivityDetailMetric, { title: string; icon: React.ReactNode; color: string }> = {
  'needs-attention': { title: 'Needs attention', icon: <WarningAmber />, color: '#c19c00' },
  'open-checks': { title: 'Open checks', icon: <ReceiptLong />, color: '#0078d4' },
  'paid-today': { title: 'Paid today', icon: <Paid />, color: '#57a300' },
  'sales-today': { title: 'Sales today', icon: <AttachMoney />, color: '#8b5cf6' },
};

function money(value: number) {
  return `$${Number(value ?? 0).toFixed(2)}`;
}

export default function MyActivityDetailPage() {
  const navigate = useNavigate();
  const params = useParams<{ metric: ActivityDetailMetric }>();
  const metric = params.metric;

  if (!metric || !(metric in METRIC_META)) {
    return <Navigate to="/my-activity" replace />;
  }

  const { data, isLoading } = useQuery({
    queryKey: ['my-activity-detail', metric],
    queryFn: () => activityApi.getDetail(metric).then((r) => r.data),
  });

  const meta = METRIC_META[metric];

  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto', bgcolor: '#141414' }}>
      <Paper sx={{ p: 2.5, borderRadius: 3, mb: 3, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2}>
          <Stack spacing={1.25}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 38, height: 38, borderRadius: '50%', bgcolor: `${meta.color}22`, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {meta.icon}
              </Box>
              <Typography variant="h5" fontWeight={900}>{meta.title}</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">{data?.description ?? 'Loading details...'}</Typography>
            <Stack direction="row" spacing={1}>
              <Chip label={`${data?.summary.count ?? 0} items`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.08)' }} />
              <Chip label={`Total ${money(data?.summary.totalAmount ?? 0)}`} size="small" sx={{ bgcolor: `${meta.color}22`, color: meta.color }} />
            </Stack>
          </Stack>

          <Stack justifyContent="flex-start">
            <Button variant="outlined" startIcon={<ArrowBack />} onClick={() => navigate('/my-activity')}>
              Back to My Activity
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {isLoading ? (
        <Typography color="text.secondary">Loading details…</Typography>
      ) : !data || data.sections.every((section) => section.items.length === 0) ? (
        <Paper sx={{ p: 3, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Typography variant="body1" fontWeight={700}>Nothing needs action right now.</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>This metric is currently clear.</Typography>
        </Paper>
      ) : (
        <Stack spacing={2.5}>
          {data.sections.map((section) => (
            <Paper key={section.id} sx={{ borderRadius: 3, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <Typography variant="subtitle1" fontWeight={800}>{section.title}</Typography>
              </Box>
              <List disablePadding>
                {section.items.map((item, index) => (
                  <React.Fragment key={item.id}>
                    <ListItem sx={{ py: 1.25, px: 2 }}>
                      <ListItemText
                        primary={
                          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                            <Typography variant="body1" fontWeight={700}>{item.title}</Typography>
                            <Stack direction="row" spacing={1}>
                              {item.status && <Chip size="small" label={item.status.replace(/_/g, ' ')} sx={{ fontSize: '0.68rem' }} />}
                              {item.amountLabel && <Chip size="small" label={item.amountLabel} color="primary" sx={{ fontSize: '0.7rem' }} />}
                            </Stack>
                          </Stack>
                        }
                        secondary={
                          <Stack spacing={0.4} mt={0.4}>
                            <Typography variant="body2" color="text.secondary">{item.subtitle}</Typography>
                            <Stack direction="row" spacing={1.5}>
                              {item.tipLabel && <Typography variant="caption" color="text.secondary">Tip {item.tipLabel}</Typography>}
                              <Typography variant="caption" color="text.secondary">{item.timeLabel}</Typography>
                            </Stack>
                          </Stack>
                        }
                      />
                    </ListItem>
                    {index < section.items.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </Paper>
          ))}
        </Stack>
      )}
    </Box>
  );
}
