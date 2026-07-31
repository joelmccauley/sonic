import { apiClient } from './client';
import type { MenuItem, MenuCategory, ModifierGroup, Modifier } from '@/types';

export const menuApi = {
  getCategories: () => apiClient.get<MenuCategory[]>('/menu/categories'),
  createCategory: (data: Partial<MenuCategory>) => apiClient.post<MenuCategory>('/menu/categories', data),
  updateCategory: (id: number, data: Partial<MenuCategory>) => apiClient.put<MenuCategory>(`/menu/categories/${id}`, data),
  deleteCategory: (id: number) => apiClient.delete(`/menu/categories/${id}`),

  getItems: (params?: { categoryId?: number; available?: boolean }) =>
    apiClient.get<MenuItem[]>('/menu/items', { params }),
  getItem: (id: number) => apiClient.get<MenuItem>(`/menu/items/${id}`),
  createItem: (data: Partial<MenuItem> & { modifierGroupIds?: number[] }) =>
    apiClient.post<MenuItem>('/menu/items', data),
  updateItem: (id: number, data: Partial<MenuItem> & { modifierGroupIds?: number[] }) =>
    apiClient.put<MenuItem>(`/menu/items/${id}`, data),
  toggleItem: (id: number) => apiClient.patch<MenuItem>(`/menu/items/${id}/toggle`),
  setAvailability: (id: number, isAvailable: boolean) =>
    apiClient.patch<MenuItem>(`/menu/items/${id}/availability`, { isAvailable }),
  deleteItem: (id: number) => apiClient.delete(`/menu/items/${id}`),

  getModifierGroups: () => apiClient.get<ModifierGroup[]>('/menu/modifier-groups'),
  createModifierGroup: (data: Partial<ModifierGroup>) =>
    apiClient.post<ModifierGroup>('/menu/modifier-groups', data),
  updateModifierGroup: (id: number, data: Partial<ModifierGroup>) =>
    apiClient.put<ModifierGroup>(`/menu/modifier-groups/${id}`, data),
  deleteModifierGroup: (id: number) => apiClient.delete(`/menu/modifier-groups/${id}`),

  createModifier: (groupId: number, data: Partial<Modifier>) =>
    apiClient.post<Modifier>(`/menu/modifier-groups/${groupId}/modifiers`, data),
  updateModifier: (id: number, data: Partial<Modifier>) =>
    apiClient.put<Modifier>(`/menu/modifiers/${id}`, data),
  deleteModifier: (id: number) => apiClient.delete(`/menu/modifiers/${id}`),
};
