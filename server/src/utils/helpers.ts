/** Generate an order number like ORD-20240325-0042 */
export function generateOrderNumber(prefix = 'ORD'): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `${prefix}-${dateStr}-${rand}`;
}

/** Round to 2 decimal places */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Format a Decimal/number as currency string */
export function formatCurrency(amount: number | string | { toNumber: () => number }): string {
  const num = typeof amount === 'object' ? amount.toNumber() : Number(amount);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
}

/** Calculate tip percentage */
export function calcTipAmount(subtotal: number, tipPct: number): number {
  return round2(subtotal * (tipPct / 100));
}
