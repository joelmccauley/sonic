import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';
import MenuBuilder from '@/components/admin/MenuBuilder';
import EmployeeManagement from '@/components/admin/EmployeeManagement';
import ShiftManagement from '@/components/admin/ShiftManagement';
import InventoryManagement from '@/components/admin/InventoryManagement';
import DiscountManagement from '@/components/admin/DiscountManagement';
import ReportsView from '@/components/admin/ReportsView';
import PrinterSettings from '@/components/admin/PrinterSettings';
import AuditLogView from '@/components/admin/AuditLog';
import GeneralSettings from '@/components/admin/GeneralSettings';
import TableManagement from '@/components/admin/TableManagement';
import FloorPlanEditor from '@/components/admin/FloorPlanEditor';
import BillingManagement from '@/components/admin/BillingManagement';
import CustomerManagement from '@/components/admin/CustomerManagement';

export default function AdminPage() {
  return (
    <Box sx={{ flex: 1, overflow: 'auto', bgcolor: '#141414', height: '100%' }}>
      <Routes>
        <Route index element={<Navigate to="reports" replace />} />
        <Route path="menu" element={<MenuBuilder />} />
        <Route path="floorplan" element={<FloorPlanEditor />} />
        <Route path="tables" element={<TableManagement />} />
        <Route path="employees" element={<EmployeeManagement />} />
        <Route path="shifts" element={<ShiftManagement />} />
        <Route path="inventory" element={<InventoryManagement />} />
        <Route path="discounts" element={<DiscountManagement />} />
        <Route path="customers" element={<CustomerManagement />} />
        <Route path="reports" element={<ReportsView />} />
        <Route path="printers" element={<PrinterSettings />} />
        <Route path="audit" element={<AuditLogView />} />
        <Route path="settings" element={<GeneralSettings />} />
        <Route path="billing" element={<BillingManagement />} />
      </Routes>
    </Box>
  );
}
