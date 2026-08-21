import { supabase } from './supabase';
import type { AuditLogEntry, AuditModule } from '../types/audit';
import type { UserRole } from '../types/auth';

const LOCAL_AUDIT_KEY = 'core-erp-local-audit-log';

interface LogAuditParams {
  orgId: string;
  module: AuditModule;
  action: string;
  targetResource?: string;
  details?: Record<string, any>;
  actorId?: string;
  actorEmail?: string;
  actorRole?: UserRole;
}

export const logAuditEvent = async ({
  orgId,
  module,
  action,
  targetResource,
  details = {},
  actorId,
  actorEmail,
  actorRole,
}: LogAuditParams): Promise<void> => {
  const localEntry: AuditLogEntry = {
    id: crypto.randomUUID(),
    org_id: orgId,
    actor_id: actorId,
    actor_email: actorEmail,
    actor_role: actorRole,
    module,
    action,
    target_resource: targetResource,
    details,
    created_at: new Date().toISOString(),
  };

  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    const existing = JSON.parse(localStorage.getItem(LOCAL_AUDIT_KEY) || '[]') as AuditLogEntry[];
    localStorage.setItem(LOCAL_AUDIT_KEY, JSON.stringify([localEntry, ...existing].slice(0, 500)));
    return;
  }

  try {
    const { error } = await supabase.rpc('log_audit_event', {
      p_org_id: orgId,
      p_module: module,
      p_action: action,
      p_target_resource: targetResource || null,
      p_details: details,
    });

    if (error) {
      console.error('Audit log registration failed:', error.message);
    }
  } catch (err) {
    console.error('Audit logging error:', err);
  }
};

export const getLocalAuditLogs = (orgId: string): AuditLogEntry[] => {
  const existing = JSON.parse(localStorage.getItem(LOCAL_AUDIT_KEY) || '[]') as AuditLogEntry[];
  return existing.filter((entry) => entry.org_id === orgId);
};