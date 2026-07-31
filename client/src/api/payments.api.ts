import { apiClient } from './client';
import type { Payment, PaymentMethod } from '@/types';

export const paymentsApi = {
  process: (
    orderId: number,
    data: { method: PaymentMethod; amount: number; tip?: number; cashTendered?: number; reference?: string; last4?: string }
  ) => apiClient.post<{ payment: Payment; order: any; change?: number }>(`/payments/orders/${orderId}/pay`, data),

  refund: (orderId: number, paymentId: number, amount: number, reason?: string) =>
    apiClient.post(`/payments/orders/${orderId}/refund/${paymentId}`, { amount, reason }),

  getOrderPayments: (orderId: number) =>
    apiClient.get<Payment[]>(`/payments/orders/${orderId}`),

  printReceipt: (orderId: number) =>
    apiClient.post(`/payments/orders/${orderId}/print-receipt`),
};
