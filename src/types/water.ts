import type { Product } from './inventory';

export interface WaterProductionRun {
  id: string;
  org_id: string;
  batch_number: string;
  product_id: string;
  quantity_produced: number;
  quantity_rejected_damaged: number;
  production_line: string;
  operator_id?: string;
  production_date: string;
  notes?: string;
  product?: Product;
}

export interface WaterDispatch {
  id: string;
  org_id: string;
  dispatch_number: string;
  driver_id: string;
  vehicle_registration: string;
  status: 'draft' | 'out_for_delivery' | 'reconciled' | 'cancelled';
  total_loaded_qty: number;
  total_sold_qty: number;
  total_returned_qty: number;
  total_damaged_qty: number;
  dispatch_date: string;
  reconciled_at?: string;
  driver?: {
    full_name: string;
  };
  items?: WaterDispatchItem[];
}

export interface WaterDispatchItem {
  id: string;
  dispatch_id: string;
  product_id: string;
  loaded_qty: number;
  sold_qty: number;
  returned_qty: number;
  damaged_qty: number;
  unit_price: number;
  product?: Product;
}

export interface ContainerDamageEntry {
  id: string;
  org_id: string;
  dispatch_id?: string;
  product_id: string;
  item_type: 'empty_container' | 'damaged_sachet' | 'damaged_bottle' | 'filter_membrane';
  quantity: number;
  action_type: 'returned_empty' | 'written_off_damage' | 'refilled';
  notes?: string;
  created_at: string;
  product?: Product;
}