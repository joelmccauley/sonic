import axios from 'axios';
import { useCustomerSessionStore } from '@/store/customerSessionStore';
import type { Customer, MenuCategory, MenuItem, Order, OrderType } from '@/types';

export interface PublicStorefront {
  store: {
    id: number;
    name: string;
    slug: string;
    phone?: string | null;
    logoUrl?: string | null;
    currency: string;
    timezone: string;
    receiptFooter: string;
    orderTypes: Record<OrderType, boolean>;
    storefrontTheme: {
      backgroundColor: string;
      surfaceColor: string;
      surfaceAltColor: string;
      primaryColor: string;
      accentColor: string;
      borderColor: string;
      mutedTextColor: string;
      textColor: string;
    };
  };
  categories: MenuCategory[];
  items: MenuItem[];
}

export interface PublicOrderItemInput {
  menuItemId: number;
  quantity: number;
  notes?: string;
  course: number;
  modifiers: { modifierId: number }[];
}

export interface PublicCheckoutInput {
  type: OrderType;
  customerName: string;
  customerEmail?: string;
  customerPassword?: string;
  customerPhone?: string;
  emailOptIn?: boolean;
  textOptIn?: boolean;
  notes?: string;
  guestCount?: number;
  items: PublicOrderItemInput[];
}

export interface CustomerLoginInput {
  orderNumber: string;
  identifier: string;
}

export interface CustomerPasswordLoginInput {
  email: string;
  password: string;
}

export interface PublicCheckoutResponse {
  order: Order;
  customer: Customer;
  token: string;
  recentOrders: Order[];
}

export interface CustomerAccountResponse {
  customer: Customer;
  orders: Order[];
}

const publicClient = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

publicClient.interceptors.request.use((config) => {
  const token = useCustomerSessionStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

publicClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      useCustomerSessionStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export const publicOrderingApi = {
  getStorefront: (slug: string) => publicClient.get<PublicStorefront>(`/public/stores/${encodeURIComponent(slug)}`),
  placeOrder: (slug: string, data: PublicCheckoutInput) =>
    publicClient.post<PublicCheckoutResponse>(`/public/stores/${encodeURIComponent(slug)}/orders`, data),
  loginCustomer: (slug: string, data: CustomerLoginInput) =>
    publicClient.post<{ token: string; customer: Customer; recentOrders: Order[] }>(
      `/public/stores/${encodeURIComponent(slug)}/customer/login`,
      data
    ),
  loginCustomerWithPassword: (slug: string, data: CustomerPasswordLoginInput) =>
    publicClient.post<{ token: string; customer: Customer; recentOrders: Order[] }>(
      `/public/stores/${encodeURIComponent(slug)}/customer/password-login`,
      data
    ),
  getMe: (slug: string) => publicClient.get<CustomerAccountResponse>(`/public/stores/${encodeURIComponent(slug)}/customer/me`),
};
