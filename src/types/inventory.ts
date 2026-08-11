export type PaymentMethod = 'cash' | 'card' | 'mobile_money' | 'bank_transfer' | 'credit';

export interface Product {
  id: string;
  org_id: string;
  category_id?: string | null;
  sku_barcode?: string | null;
  name: string;
  unit_of_measure: string;
  cost_price: number;
  selling_price: number;
  reorder_level: number;
  is_batch_tracked: boolean;
  metadata?: Record<string, any>;
  created_at?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  unit_price: number;
  total_price: number;
  batch_id?: string | null;
}

export interface CheckoutParams {
  cashierId: string;
  orgId: string;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  discount?: number;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
}