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
  | 'front_desk'
  | 'sales_person'
  | 'cashier'
  | 'pharmacist'
  | 'doctor'
  | 'teacher'
  | 'collector'
  | 'driver';

export type SchoolLevel = 'primary' | 'junior_high' | 'senior_high' | 'primary_to_junior_high';

export interface Organization {
  id: string;
  name: string;
  address?: string;
  industry_type: IndustryType;
  created_at: string;
  school_level?: SchoolLevel;
  trial_started_at?: string;
  trial_ends_at?: string;
  subscription_status?: 'trial' | 'active' | 'expired' | 'suspended';
}

export interface Profile {
  id: string;
  org_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
}