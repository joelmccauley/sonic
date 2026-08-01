import { OrderType } from '@prisma/client';

export const ORDER_TYPE_SETTING_KEYS = [
  'enable_dine_in',
  'enable_to_go',
  'enable_delivery',
  'enable_bar',
] as const;

export type OrderTypeSettingKey = (typeof ORDER_TYPE_SETTING_KEYS)[number];

export const ORDER_TYPE_SETTINGS = [
  { key: 'enable_dine_in', type: OrderType.DINE_IN, label: 'Dine In' },
  { key: 'enable_to_go', type: OrderType.TO_GO, label: 'To Go' },
  { key: 'enable_delivery', type: OrderType.DELIVERY, label: 'Delivery' },
  { key: 'enable_bar', type: OrderType.BAR, label: 'Bar' },
] as const;

export function getEnabledOrderTypeMap(settings: Record<string, string | null | undefined>) {
  return {
    DINE_IN: settings.enable_dine_in !== 'false',
    TO_GO: settings.enable_to_go !== 'false',
    DELIVERY: settings.enable_delivery !== 'false',
    BAR: settings.enable_bar !== 'false',
  } as Record<OrderType, boolean>;
}

export function hasAtLeastOneEnabledOrderType(settings: Record<string, string | null | undefined>) {
  return Object.values(getEnabledOrderTypeMap(settings)).some(Boolean);
}
