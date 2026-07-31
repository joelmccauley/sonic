import { apiClient } from './client';
import type { InventoryItem, MenuItem } from '@/types';

export type InventoryRow = {
  id: number;
  kind: 'menu' | 'custom';
  menuItemId: number | null;
  name: string;
  sku?: string | null;
  category: { name: string } | null;
  quantity: number;
  unit: string;
  lowThreshold?: number | null;
  updatedAt: string;
};

export const inventoryApi = {
  getAll:      ()                                                    => apiClient.get<InventoryRow[]>('/inventory'),
  getLowStock: ()                                                    => apiClient.get<InventoryRow[]>('/inventory/low-stock'),
  update:      (menuItemId: number, data: { quantity?: number; unit?: string; lowThreshold?: number | null }) =>
                 apiClient.put<InventoryItem>(`/inventory/${menuItemId}`, data),
  adjust:      (menuItemId: number, adjustment: number, reason?: string) =>
                 apiClient.post<InventoryItem>('/inventory/adjust', { menuItemId, adjustment, reason }),
  createCustom: (data: { name: string; sku?: string; quantity: number; unit?: string; lowThreshold?: number | null }) =>
                 apiClient.post<InventoryRow>('/inventory/custom', data),
  updateById:   (id: number, data: { name?: string; sku?: string; quantity?: number; unit?: string; lowThreshold?: number | null }) =>
                 apiClient.put<InventoryRow>(`/inventory/item/${id}`, data),
  adjustById:   (id: number, adjustment: number, reason?: string) =>
                 apiClient.post<InventoryRow>(`/inventory/item/${id}/adjust`, { adjustment, reason }),
  deleteById:   (id: number) => apiClient.delete(`/inventory/item/${id}`),
};
