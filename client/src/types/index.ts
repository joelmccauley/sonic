// Shared TypeScript types for the SonicPOS client

export type Role = 'OWNER' | 'MANAGER' | 'CASHIER' | 'SERVER' | 'KITCHEN' | 'BARTENDER';

export type PlanTier = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';

export interface Organization {
  id: number;
  name: string;
  slug: string;
  planTier: PlanTier;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: string | null;
}

export interface PlanInfo {
  tier: PlanTier;
  name: string;
  price: number;
  tagline: string;
  maxEmployees: number | null;
  maxTables: number | null;
  features: Record<string, boolean>;
}

export type TableShape = 'RECTANGLE' | 'CIRCLE' | 'SQUARE';
export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING';

export type OrderType = 'DINE_IN' | 'TO_GO' | 'DELIVERY' | 'BAR';
export type OrderStatus = 'OPEN' | 'SENT_TO_KITCHEN' | 'IN_PROGRESS' | 'READY' | 'PAID' | 'VOIDED' | 'REFUNDED';
export type ItemStatus = 'PENDING' | 'SENT' | 'IN_PROGRESS' | 'READY' | 'DELIVERED' | 'VOIDED';
export type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'GIFT_CARD' | 'CHECK' | 'COMP';
export type DiscountType = 'PERCENTAGE' | 'FLAT' | 'COMP';
export type PrinterType = 'RECEIPT' | 'KITCHEN' | 'BAR' | 'LABEL';

export interface User {
  id: number;
  username: string;
  email?: string;
  firstName: string;
  lastName: string;
  role: Role;
  isActive: boolean;
  imageUrl?: string;
  createdAt: string;
}

export interface Table {
  id: number;
  name: string;
  capacity: number;
  section?: string;
  posX: number;
  posY: number;
  width: number;
  height: number;
  shape: TableShape;
  status: TableStatus;
  isActive: boolean;
  orders?: Partial<Order>[];
}

export interface MenuCategory {
  id: number;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
  _count?: { items: number };
}

export interface Modifier {
  id: number;
  name: string;
  price: number;
  groupId: number;
  isActive: boolean;
  sortOrder: number;
}

export interface ModifierGroup {
  id: number;
  name: string;
  required: boolean;
  multiSelect: boolean;
  minSelect: number;
  maxSelect?: number;
  items: Modifier[];
}

export interface MenuItem {
  id: number;
  name: string;
  description?: string;
  price: number;
  cost?: number;
  categoryId: number;
  category?: MenuCategory;
  imageUrl?: string;
  sku?: string;
  isActive: boolean;
  isAvailable: boolean;
  isTaxable: boolean;
  taxRate?: number;
  sortOrder: number;
  trackInventory: boolean;
  inventoryCount?: number;
  calories?: number;
  allergens?: string;
  isPopular: boolean;
  modifierGroups?: { modifierGroup: ModifierGroup; sortOrder: number }[];
}

export interface OrderItemModifier {
  id: number;
  modifierId: number;
  modifier: Modifier;
  price: number;
}

export interface OrderItem {
  id: number;
  orderId: number;
  menuItemId: number;
  menuItem: Pick<MenuItem, 'id' | 'name' | 'categoryId'>;
  quantity: number;
  unitPrice: number;
  notes?: string;
  status: ItemStatus;
  course: number;
  sentAt?: string;
  voidedAt?: string;
  voidReason?: string;
  modifiers: OrderItemModifier[];
}

export interface Payment {
  id: number;
  orderId: number;
  method: PaymentMethod;
  amount: number;
  tip: number;
  cashTendered?: number;
  changeGiven?: number;
  reference?: string;
  last4?: string;
  processedById: number;
  createdAt: string;
  isRefunded: boolean;
  refundedAt?: string;
  refundAmount?: number;
}

export interface Discount {
  id: number;
  name: string;
  type: DiscountType;
  value: number;
  code?: string;
  isActive: boolean;
  requiresPin: boolean;
  minOrder?: number;
  description?: string;
}

export interface OrderDiscount {
  id: number;
  discountId: number;
  discount: Discount;
  amount: number;
}

export interface Customer {
  id: number;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  points: number;
  notes?: string;
  createdAt: string;
}

export interface Order {
  id: number;
  orderNumber: string;
  type: OrderType;
  status: OrderStatus;
  tableId?: number;
  table?: Table;
  serverId?: number;
  server?: Pick<User, 'id' | 'firstName' | 'lastName'>;
  customerId?: number;
  customer?: Customer;
  customerName?: string;
  customerPhone?: string;
  guestCount?: number;
  notes?: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  tipAmount: number;
  total: number;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  items: OrderItem[];
  payments: Payment[];
  discounts: OrderDiscount[];
}

export interface Shift {
  id: number;
  userId: number;
  user: Pick<User, 'firstName' | 'lastName' | 'role'>;
  clockIn: string;
  clockOut?: string;
  cashDrawer?: number;
  closingCash?: number;
  notes?: string;
}

export interface Printer {
  id: number;
  name: string;
  type: PrinterType;
  ipAddress?: string;
  port?: number;
  isDefault: boolean;
  isActive: boolean;
  interface: string;
}

export interface AuditLog {
  id: number;
  userId?: number;
  user?: Pick<User, 'firstName' | 'lastName' | 'username'>;
  action: string;
  entity: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

export interface InventoryItem {
  id: number;
  menuItemId?: number | null;
  customName?: string | null;
  customSku?: string | null;
  menuItem?: MenuItem;
  quantity: number;
  unit: string;
  lowThreshold?: number | null;
  updatedAt: string;
}

export interface DailySummary {
  totalSales: number;
  totalTax: number;
  totalTips: number;
  totalDiscounts: number;
  paidOrders: number;
  openOrders: number;
  voidedOrders: number;
  paymentBreakdown: { method: PaymentMethod; _sum: { amount: number }; _count: { id: number } }[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

// Cart type for active order building
export interface CartModifier {
  modifierId: number;
  name: string;
  price: number;
}

export interface CartItem {
  tempId: string;
  menuItemId: number;
  name: string;
  unitPrice: number;
  quantity: number;
  notes?: string;
  course: number;
  modifiers: CartModifier[];
}
