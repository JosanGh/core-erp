import { createContext } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import type { Profile, Organization, IndustryType, SchoolLevel } from '../types/auth';

export interface SignUpParams {
  email: string;
  password: string;
  fullName: string;
  orgName: string;
  industryType: IndustryType;
  schoolLevel?: SchoolLevel;
}

export interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  organization: Organization | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<{ error: Error | null }>;
  signUp: (data: SignUpParams) => Promise<{ error: Error | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  updateOrganization: (updates: Partial<Organization>) => Promise<void>;
  tenantMembershipValid: boolean;
  accessState: 'trial' | 'active' | 'expired' | 'suspended';
  accessEndsAt: string | null;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
