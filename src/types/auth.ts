export type IndustryType =
  | 'supermarket'
  | 'water_factory'
  | 'electrical_shop'
  | 'pharmacy'
  | 'susu_finance'
  | 'school'
  | 'clinic';

export type UserRole =
  | 'owner'
  | 'admin'
  | 'manager'
  | 'cashier'
  | 'pharmacist'
  | 'doctor'
  | 'teacher'
  | 'collector'
  | 'driver';

export interface Organization {
  id: string;
  name: string;
  industry_type: IndustryType;
  created_at: string;
}

export interface Profile {
  id: string;
  org_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
}