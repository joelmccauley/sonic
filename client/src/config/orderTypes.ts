import type { OrderType } from '@/types';

export const ORDER_TYPE_SETTINGS = [
  { key: 'enable_dine_in', type: 'DINE_IN', label: 'Dine In', emoji: '🍽', public: true },
  { key: 'enable_to_go', type: 'TO_GO', label: 'To Go', emoji: '🛍', public: true },
  { key: 'enable_delivery', type: 'DELIVERY', label: 'Delivery', emoji: '🚚', public: true },
  { key: 'enable_bar', type: 'BAR', label: 'Bar', emoji: '🍺', public: false },
] as const satisfies ReadonlyArray<{
  key: string;
  type: OrderType;
  label: string;
  emoji: string;
  public: boolean;
}>;

export type OrderTypeSettingKey = (typeof ORDER_TYPE_SETTINGS)[number]['key'];

export const PUBLIC_ORDER_TYPE_SETTINGS = ORDER_TYPE_SETTINGS.filter(
  (option): option is Extract<(typeof ORDER_TYPE_SETTINGS)[number], { public: true }> => option.public,
);

export function isEnabledOrderType(
  values: Record<string, string>,
  key: OrderTypeSettingKey,
) {
  return values[key] !== 'false';
}
