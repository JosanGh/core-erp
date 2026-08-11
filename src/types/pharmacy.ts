import type { Product } from './inventory';

export interface DrugMetadata {
  active_ingredient?: string;
  dosage_form?: 'tablet' | 'capsule' | 'syrup' | 'injection' | 'ointment' | 'drops';
  strength?: string; // e.g. "500mg", "125mg/5ml"
  prescription_required?: boolean;
  controlled_substance?: boolean;
}

export interface InventoryBatch {
  id: string;
  org_id: string;
  product_id: string;
  batch_number: string;
  quantity_remaining: number;
  cost_price: number;
  manufacture_date?: string;
  expiry_date: string;
  created_at?: string;
}

export interface PharmacyPrescription {
  id: string;
  org_id: string;
  patient_name: string;
  patient_phone?: string;
  doctor_name: string;
  clinic_hospital?: string;
  prescription_number: string;
  status: 'pending' | 'dispensed' | 'cancelled';
  notes?: string;
  created_at: string;
  items?: PharmacyPrescriptionItem[];
}

export interface PharmacyPrescriptionItem {
  id: string;
  prescription_id: string;
  product_id: string;
  dosage_instruction: string;
  quantity_prescribed: number;
  quantity_dispensed: number;
  product?: Product;
}