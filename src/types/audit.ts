import type { UserRole } from './auth';

export type AuditModule = 'auth' | 'admin' | 'pos' | 'pharmacy' | 'susu' | 'water' | 'inventory' | 'school' | 'clinic' | 'electrical';

export interface AuditLogEntry {
  id: string;
  org_id: string;
  actor_id?: string;
  actor_email?: string;
  actor_role?: UserRole;
  module: AuditModule;
  action: string;
  target_resource?: string;
  details?: Record<string, any>;
  ip_address?: string;
  created_at: string;
}